// Static site build. Zero dependencies: node build.mjs → dist/
//
// Content is content/articles/*.json (written by scripts/write.mjs). A topic page
// exists only once it has at least one article, so the site never ships a page
// with nothing to read on it.

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { ADS, CATEGORIES, NAV_MAIN, SITE, TORAHTALE } from "./site.config.mjs";
import { ARTICLE_TYPES } from "./data/article-types.mjs";
import { TOPICS, topicById } from "./data/topics.mjs";
import { PHOTOS, articlePhoto, topicPhoto } from "./data/photos.mjs";

const ROOT = dirname(fileURLToPath(import.meta.url));
const DIST = join(ROOT, "dist");
const ARTICLES_DIR = join(ROOT, "content", "articles");
const TODAY = new Date().toISOString().slice(0, 10);
const TYPE_KEYS = Object.keys(ARTICLE_TYPES);

// ── helpers ─────────────────────────────────────────────────────────────────
const esc = (s = "") =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Article HTML comes from a model. Keep only plain prose tags and drop every
// attribute, so a stray script, style or off-site link can never reach the page.
const ALLOWED = new Set(["p", "h3", "ul", "ol", "li", "strong", "em", "b", "i", "blockquote", "br"]);
export const sanitize = (html = "") =>
  String(html)
    .replace(/<(script|style|iframe|object)[\s\S]*?<\/\1>/gi, "")
    .replace(/<\/?([a-z0-9]+)(\s[^>]*)?>/gi, (m, tag) => {
      const t = tag.toLowerCase();
      if (!ALLOWED.has(t)) return "";
      if (m.startsWith("</")) return `</${t}>`;
      const start = t === "ol" && /\sstart="(\d{1,3})"/.exec(m);
      return start ? `<ol start="${start[1]}">` : `<${t}>`;
    });

const textOf = (html) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const wordCount = (a) => textOf([a.intro, ...a.sections.map((s) => s.html)].join(" ")).split(" ").length;
const ttLink = (path, content) => `${TORAHTALE.url}${path}${path.includes("?") ? "&" : "?"}${TORAHTALE.utm(content)}`;
const fmtDate = (d) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
const hash = (s) => [...s].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);
const vt = (s) => `vt-${hash(s).toString(36)}`;

const img = (photo, { sizes = "(max-width: 760px) 100vw, 50vw", eager = false, cls = "", name = "" } = {}) =>
  photo
    ? `<img${cls ? ` class="${cls}"` : ""} src="/assets/img/${photo.key}-800.webp" srcset="/assets/img/${photo.key}-800.webp 800w, /assets/img/${photo.key}-1600.webp 1600w" sizes="${sizes}" alt="${esc(photo.alt)}" width="1600" height="1067"${eager ? ` fetchpriority="high"` : process.env.EAGER_IMAGES ? "" : ` loading="lazy" decoding="async"`}${name ? ` style="view-transition-name:${name}"` : ""}>`
    : "";

const icon = {
  arrow: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  out: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  search: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="m16 16 4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
  moon: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`,
  print: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 9V4h10v5M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2M7 14h10v6H7z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>`,
  link: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`,
  candle: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3c1.6 1.8 2 3 2 4a2 2 0 0 1-4 0c0-1 .4-2.2 2-4ZM9 11h6v10H9z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>`,
};

// The Torah Stories mark: an open book with a small flame above it.
const LOGO_MARK = `<svg class="mark" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="9" fill="var(--clay)"/><path d="M16 24c-2.6-1.7-5.6-2.3-9-2V9.5c3.4-.2 6.4.5 9 2.3 2.6-1.8 5.6-2.5 9-2.3V22c-3.4-.3-6.4.3-9 2Z" fill="none" stroke="var(--on-clay)" stroke-width="1.7" stroke-linejoin="round"/><path d="M16 11.8V24" stroke="var(--on-clay)" stroke-width="1.7"/><path d="M16 4.5c1.2 1.3 1.5 2.2 1.5 3a1.5 1.5 0 0 1-3 0c0-.8.3-1.7 1.5-3Z" fill="var(--on-clay)"/></svg>`;
const LOGO = `<a class="logo" href="/" aria-label="Torah Stories home">${LOGO_MARK}<span>Torah <em>Stories</em></span></a>`;

// ── load content ────────────────────────────────────────────────────────────
const loadArticles = () => {
  if (!existsSync(ARTICLES_DIR)) return [];
  return readdirSync(ARTICLES_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(join(ARTICLES_DIR, f), "utf8")))
    .filter((a) => a.published <= TODAY && topicById(a.topic) && ARTICLE_TYPES[a.type])
    .map((a) => {
      const t = topicById(a.topic);
      return { ...a, topicObj: t, url: `/${a.slug}/`, kind: ARTICLE_TYPES[a.type], photo: articlePhoto(t, TYPE_KEYS.indexOf(a.type)) };
    })
    .sort((a, b) => (b.published + b.slug).localeCompare(a.published + a.slug));
};

// ── ads ─────────────────────────────────────────────────────────────────────
// Slots alternate between AdSense and a TorahTale house ad, so HOUSE_SHARE is an
// exact split. Which one comes first depends on the article. Until AdSense is
// approved every slot is a house ad. House ads are labelled as TorahTale's and
// never imitate Google's ads.
const adsenseOn = () => Boolean(ADS.ADSENSE_CLIENT);

const HOUSE = [
  (t) => ({
    title: t ? `${t.name}, starring your child` : "A Torah story starring your child",
    body: "Your child's face and name drawn into every page of a printed storybook.",
    cta: "Make their book",
    href: t?.hasTorahTalePage ? ttLink(TORAHTALE.orderPath(t.id), `house-order-${t.id}`) : ttLink("/", "house-order"),
    photo: t ? topicPhoto(t) : PHOTOS["book-fan"],
  }),
  () => ({ title: "Over 250 personalized Torah stories", body: "Tanach, Yamim Tovim, mitzvos, middos and tzaddikim, each with your child inside the story.", cta: "Browse stories", href: ttLink("/stories", "house-browse"), photo: PHOTOS["book-fan"] }),
  () => ({ title: "A new Torah story every month", body: "Personalized books delivered to your door, following the parsha and the Yamim Tovim.", cta: "See the plans", href: ttLink("/", "house-subscribe"), photo: PHOTOS["book-open"] }),
  () => ({ title: "The gift for an upsherin, birthday or Chanukah", body: "A storybook where the child is the hero, printed as a keepsake.", cta: "Find a gift", href: ttLink("/", "house-gift"), photo: PHOTOS.lanterns }),
];

const houseAd = (topic, seed) => {
  const c = HOUSE[hash(seed) % HOUSE.length](topic);
  return `<aside class="promo" aria-label="Sponsored by TorahTale">
  <a href="${esc(c.href)}" rel="sponsored noopener" target="_blank">
    <span class="promo-img">${img(c.photo, { sizes: "160px" })}</span>
    <span class="promo-text"><span class="promo-label">Sponsored · TorahTale</span><strong>${esc(c.title)}</strong><span>${esc(c.body)}</span></span>
    <span class="promo-cta">${esc(c.cta)} ${icon.out}</span>
  </a>
</aside>`;
};

const adsenseUnit = (slotId) => `<div class="ad"><span class="ad-label">Advertisement</span>
  <ins class="adsbygoogle" style="display:block" data-ad-client="${esc(ADS.ADSENSE_CLIENT)}"${slotId ? ` data-ad-slot="${esc(slotId)}"` : ""} data-ad-format="auto" data-full-width-responsive="true"></ins>
  <script>(adsbygoogle=window.adsbygoogle||[]).push({});</script>
</div>`;

const adSlot = (topic, seed, index, slotId = ADS.SLOTS.inArticle) => {
  if (!adsenseOn()) return houseAd(topic, seed);
  const period = Math.max(1, Math.round(1 / ADS.HOUSE_SHARE));
  const offset = hash(seed.split(":")[0]) % period;
  return (index + offset) % period === 0 ? houseAd(topic, seed) : adsenseUnit(slotId);
};

// ── layout ──────────────────────────────────────────────────────────────────
const CAT_LIST = Object.entries(CATEGORIES).map(([key, c]) => ({ key, ...c }));

const header = () => `<a class="skip" href="#main">Skip to content</a>
<header class="site-header">
  <div class="wrap header-row">
    ${LOGO}
    <nav class="nav" aria-label="Sections">
      ${NAV_MAIN.map((k) => `<a href="/${CATEGORIES[k].slug}/">${esc(CATEGORIES[k].short)}</a>`).join("")}
      <button class="nav-more" popovertarget="more-menu"><span class="on-wide">More</span><span class="on-narrow">Topics</span></button>
      <div id="more-menu" popover>
        ${CAT_LIST.map((c) => `<a href="/${c.slug}/"${NAV_MAIN.includes(c.key) ? ` class="pm-main"` : ""}>${esc(c.name)}</a>`).join("")}
        <hr>${TYPE_KEYS.slice(0, 6).map((k) => `<a href="/${k}/">${esc(ARTICLE_TYPES[k].plural)}</a>`).join("")}
      </div>
    </nav>
    <div class="header-actions">
      <button class="search-btn" data-search aria-label="Search">${icon.search}<span>Search</span><kbd>⌘K</kbd></button>
      <button class="icon-btn" data-theme-toggle aria-label="Switch light or dark">${icon.moon}</button>
    </div>
  </div>
</header>
<dialog class="search" id="search">
  <form method="dialog" class="search-box">
    ${icon.search}<input type="search" placeholder="Search parsha, Yom Tov, mitzvah…" aria-label="Search" autocomplete="off">
    <button class="esc" value="close" aria-label="Close">Esc</button>
  </form>
  <div class="search-results" role="listbox"></div>
</dialog>`;

const footer = () => `<footer class="site-footer">
  <div class="wrap">
    <div class="footer-top">
      <div class="footer-brand">${LOGO}<p>Free Torah stories, parsha ideas and Yom Tov activities for frum families, morahs and rebbeim.</p></div>
      <nav aria-label="Topics"><h2>Topics</h2>${CAT_LIST.map((c) => `<a href="/${c.slug}/">${esc(c.name)}</a>`).join("")}</nav>
      <nav aria-label="Ideas"><h2>Ideas</h2>${TYPE_KEYS.map((k) => `<a href="/${k}/">${esc(ARTICLE_TYPES[k].plural)}</a>`).join("")}</nav>
      <nav aria-label="About"><h2>Torah Stories</h2><a href="/about/">About</a><a href="/contact/">Contact</a><a href="/privacy/">Privacy</a><a href="/terms/">Terms</a><a href="/rss.xml">RSS</a></nav>
    </div>
    <div class="footer-bottom"><span>© ${new Date().getFullYear()} Torah Stories</span><span>Photography from Unsplash</span></div>
  </div>
</footer>`;

const layout = ({ title, description, path, body, photo, jsonLd = [], type = "website", bodyClass = "" }) => {
  const canonical = `${SITE.url}${path}`;
  const og = `${SITE.url}/assets/img/${(photo || PHOTOS.scroll).key}-1600.webp`;
  return `<!doctype html>
<html lang="${SITE.language}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${canonical}">
<meta name="theme-color" content="#f6f1e9" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#131210" media="(prefers-color-scheme: dark)">
<meta property="og:type" content="${type}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${og}">
<meta property="og:site_name" content="${esc(SITE.name)}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">
<link rel="alternate" type="application/rss+xml" title="${esc(SITE.name)}" href="/rss.xml">
<link rel="preload" href="/assets/fonts/instrument-serif.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/assets/fonts/geist.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/assets/site.css">
<script>try{const t=localStorage.getItem("theme");if(t)document.documentElement.dataset.theme=t}catch{}</script>
${adsenseOn() ? `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${esc(ADS.ADSENSE_CLIENT)}" crossorigin="anonymous"></script>` : ""}
${jsonLd.map((j) => `<script type="application/ld+json">${JSON.stringify(j).replace(/</g, "\\u003c")}</script>`).join("\n")}
<script src="/assets/app.js" defer></script>
</head>
<body${bodyClass ? ` class="${bodyClass}"` : ""}>
${header()}
<main id="main">
${body}
</main>
${footer()}
</body>
</html>`;
};

const breadcrumbs = (items) => ({
  html: `<nav class="crumbs" aria-label="Breadcrumb">${items
    .map((it, i) => (i < items.length - 1 ? `<a href="${it.path}">${esc(it.name)}</a>` : `<span aria-current="page">${esc(it.name)}</span>`))
    .join(`<span class="sep">/</span>`)}</nav>`,
  ld: {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: `${SITE.url}${it.path}` })),
  },
});

const card = (a, { size = "" } = {}) => `<a class="card ${size}" href="${a.url}">
  <span class="card-img">${img(a.photo, { sizes: "(max-width: 760px) 100vw, 33vw", name: vt(a.slug) })}<span class="chip">${esc(a.kind.label)}</span></span>
  <span class="card-body">
    <span class="card-kicker">${esc(a.topicObj.name)}</span>
    <strong>${esc(a.title)}</strong>
    <span class="card-desc">${esc(a.description)}</span>
    <span class="card-meta">${esc(a.kind.ages)} · ${Math.max(2, Math.round(wordCount(a) / 220))} min</span>
  </span>
</a>`;

// ── article ─────────────────────────────────────────────────────────────────
const articlePage = (a, all) => {
  const t = a.topicObj;
  const cat = CATEGORIES[t.category];
  const crumbs = breadcrumbs([
    { name: "Home", path: "/" },
    { name: cat.name, path: `/${cat.slug}/` },
    { name: t.name, path: `/${cat.slug}/${t.id}/` },
    { name: a.kind.label, path: a.url },
  ]);

  let adIndex = 0;
  const sectionsHtml = a.sections
    .map((s, i) => {
      const block = `<section id="s${i + 1}"><h2>${esc(s.heading)}</h2>${sanitize(s.html)}</section>`;
      const ad = (i + 1) % ADS.EVERY_N_SECTIONS === 0 && i < a.sections.length - 1 && adIndex < ADS.MAX_IN_ARTICLE
        ? adSlot(t, `${a.slug}:${adIndex}`, adIndex++)
        : "";
      return block + ad;
    })
    .join("\n");

  const faqHtml = a.faq?.length
    ? `<section class="faq" id="faq"><h2>Questions parents ask</h2>${a.faq.map((f) => `<details><summary>${esc(f.q)}</summary><div class="faq-a"><p>${esc(f.a)}</p></div></details>`).join("")}</section>`
    : "";

  const siblings = all.filter((x) => x.topic === a.topic && x.slug !== a.slug);
  const related = [...siblings, ...all.filter((x) => x.topic !== a.topic && x.topicObj.category === t.category), ...all.filter((x) => x.topic !== a.topic)]
    .filter((x, i, arr) => arr.indexOf(x) === i)
    .slice(0, 3);

  const ctaHref = t.hasTorahTalePage ? ttLink(TORAHTALE.orderPath(t.id), `cta-${a.slug}`) : ttLink("/", `cta-${a.slug}`);
  const cta = `<aside class="feature" aria-label="Sponsored by TorahTale">
  <div class="feature-img">${img(PHOTOS["book-fan"], { sizes: "(max-width: 760px) 100vw, 420px" })}</div>
  <div class="feature-body">
    <span class="promo-label">Sponsored · TorahTale</span>
    <h2>Turn ${esc(t.name)} into your child's own storybook</h2>
    <p>TorahTale makes a personalized book of this story with your child drawn into every page, from one photo, with their own name in the story. A lesson they hear tonight becomes the book they ask for again and again.</p>
    <a class="btn" href="${esc(ctaHref)}" rel="sponsored noopener" target="_blank">Create the book ${icon.out}</a>
  </div>
</aside>`;

  const toc = `<nav class="toc" aria-label="On this page"><span class="toc-title">On this page</span><ol>${a.sections.map((s, i) => `<li><a href="#s${i + 1}">${esc(s.heading)}</a></li>`).join("")}${a.faq?.length ? `<li><a href="#faq">Questions parents ask</a></li>` : ""}</ol></nav>`;

  const ld = [
    crumbs.ld,
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: a.title,
      description: a.description,
      image: `${SITE.url}/assets/img/${a.photo.key}-1600.webp`,
      datePublished: a.published,
      dateModified: a.updated || a.published,
      author: { "@type": "Organization", name: SITE.name, url: SITE.url },
      publisher: { "@type": "Organization", name: SITE.name, logo: { "@type": "ImageObject", url: `${SITE.url}/assets/apple-touch-icon.png` } },
      mainEntityOfPage: `${SITE.url}${a.url}`,
      keywords: (a.keywords || []).join(", "),
      inLanguage: "en",
    },
  ];
  if (a.faq?.length)
    ld.push({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: a.faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) });

  const minutes = Math.max(2, Math.round(wordCount(a) / 220));
  const body = `<div class="progress" aria-hidden="true"></div>
<article class="article">
  <header class="wrap article-head">
    ${crumbs.html}
    <p class="eyebrow"><a href="/${cat.slug}/">${esc(cat.name)}</a><span>·</span><a href="/${a.type}/">${esc(a.kind.plural)}</a></p>
    <h1>${esc(a.title)}</h1>
    <p class="deck">${esc(a.description)}</p>
    <div class="meta-row">
      <span class="meta"><span class="pill">${esc(a.kind.ages)}</span>${minutes} min read · ${fmtDate(a.updated || a.published)}${t.he ? ` · <span lang="he" dir="rtl">${esc(t.he)}</span>` : ""}</span>
      <span class="actions"><button class="icon-btn" data-print aria-label="Print">${icon.print}</button><button class="icon-btn" data-copy aria-label="Copy link">${icon.link}</button></span>
    </div>
  </header>
  <figure class="wrap hero">${img(a.photo, { eager: true, sizes: "(max-width: 1200px) 100vw, 1200px", name: vt(a.slug) })}<figcaption>${esc(a.photo.alt)}</figcaption></figure>
  <div class="wrap article-grid">
    <div class="prose">
      <div class="intro">${sanitize(a.intro)}</div>
      <details class="toc-mobile"><summary>On this page</summary>${toc}</details>
      ${sectionsHtml}
      ${faqHtml}
      ${cta}
    </div>
    <aside class="rail">${toc}${adSlot(t, `${a.slug}:${adIndex}`, adIndex, ADS.SLOTS.sidebar)}</aside>
  </div>
  ${siblings.length ? `<section class="wrap more-topic"><h2>More on ${esc(t.name)}</h2><div class="chips">${siblings.map((s) => `<a class="chip-link" href="${s.url}">${esc(s.kind.label)}</a>`).join("")}<a class="chip-link ghost" href="/${cat.slug}/${t.id}/">All ${esc(t.name)} ${icon.arrow}</a></div></section>` : ""}
  ${related.length ? `<section class="wrap related"><div class="section-head"><h2>Keep reading</h2></div><div class="grid">${related.map((r) => card(r)).join("")}</div></section>` : ""}
</article>`;

  return layout({ title: `${a.title} | ${SITE.name}`, description: a.description, path: a.url, body, photo: a.photo, jsonLd: ld, type: "article", bodyClass: "is-article" });
};

// ── hubs ────────────────────────────────────────────────────────────────────
const hubHead = ({ crumbs, eyebrow, title, lede, photo }) => `<header class="hub-head wrap${photo ? "" : " no-img"}">
  <div class="hub-text">${crumbs}<p class="eyebrow">${eyebrow}</p><h1>${title}</h1><p class="lede">${lede}</p></div>
  ${photo ? `<div class="hub-img">${img(photo, { eager: true, sizes: "(max-width: 760px) 100vw, 45vw" })}</div>` : ""}
</header>`;

const topicPage = (t, list) => {
  const cat = CATEGORIES[t.category];
  const path = `/${cat.slug}/${t.id}/`;
  const crumbs = breadcrumbs([{ name: "Home", path: "/" }, { name: cat.name, path: `/${cat.slug}/` }, { name: t.name, path }]);
  const ordered = TYPE_KEYS.map((k) => list.find((a) => a.type === k)).filter(Boolean);
  const body = `${hubHead({ crumbs: crumbs.html, eyebrow: `${esc(cat.name)}${t.he ? ` · <span lang="he" dir="rtl">${esc(t.he)}</span>` : ""}`, title: `${esc(t.name)} <em>for kids</em>`, lede: esc(t.summary), photo: topicPhoto(t) })}
<div class="wrap"><div class="grid">${ordered.map((a) => card(a)).join("")}</div>${adSlot(t, `topic-${t.id}:0`, 0)}</div>`;
  return layout({
    title: `${t.name} for Kids: Stories, Questions and Activities | ${SITE.name}`,
    description: `${t.name} for children: ${t.summary}`.slice(0, 158),
    path, body, photo: topicPhoto(t), jsonLd: [crumbs.ld],
  });
};

const categoryPage = (key, cat, byTopic) => {
  const path = `/${cat.slug}/`;
  const crumbs = breadcrumbs([{ name: "Home", path: "/" }, { name: cat.name, path }]);
  const topics = TOPICS.filter((t) => t.category === key);
  const live = topics.filter((t) => byTopic.has(t.id));
  const soon = topics.filter((t) => !byTopic.has(t.id));
  const body = `${hubHead({ crumbs: crumbs.html, eyebrow: `${topics.length} topics`, title: `${esc(cat.name)} <em>for kids</em>`, lede: `${esc(cat.blurb)} Stories, Shabbos table questions, activities and lessons for every one.`, photo: PHOTOS[cat.photo] })}
<div class="wrap">
  ${live.length ? `<div class="topic-grid">${live.map((t) => `<a class="topic" href="/${cat.slug}/${t.id}/"><span class="topic-img">${img(topicPhoto(t), { sizes: "(max-width: 760px) 50vw, 25vw" })}</span><strong>${esc(t.name)}</strong><span>${byTopic.get(t.id).length} ${byTopic.get(t.id).length === 1 ? "article" : "articles"}</span></a>`).join("")}</div>` : ""}
  ${soon.length ? `<section class="soon"><h2>Coming soon</h2><p class="muted">New articles are added every week, starting with the parsha and Yamim Tovim coming up.</p><ul>${soon.map((t) => `<li>${esc(t.name)}</li>`).join("")}</ul></section>` : ""}
</div>`;
  return layout({ title: `${cat.name} for Kids: Stories and Ideas | ${SITE.name}`, description: `${cat.blurb} Free stories, questions and activities for frum families.`, path, body, photo: PHOTOS[cat.photo], jsonLd: [crumbs.ld] });
};

const typePage = (key, list) => {
  const k = ARTICLE_TYPES[key];
  const path = `/${key}/`;
  const crumbs = breadcrumbs([{ name: "Home", path: "/" }, { name: k.plural, path }]);
  const body = `${hubHead({ crumbs: crumbs.html, eyebrow: `${list.length} ${list.length === 1 ? "article" : "articles"}`, title: `${esc(k.plural)} <em>for kids</em>`, lede: `Every ${esc(k.label.toLowerCase())} on Torah Stories, for each parsha, Yom Tov, mitzvah and middah.`, photo: list[0]?.photo })}
<div class="wrap"><div class="grid">${list.map((a) => card(a)).join("")}</div></div>`;
  return layout({ title: `${k.plural} for Kids: Parsha and Yom Tov | ${SITE.name}`, description: `Free ${k.plural.toLowerCase()} for Jewish children, for every parsha and Yom Tov.`, path, body, photo: list[0]?.photo, jsonLd: [crumbs.ld] });
};

// ── home ────────────────────────────────────────────────────────────────────
const homePage = (articles, week) => {
  const weekly = week?.topic ? articles.filter((a) => a.topic === week.topic.id) : [];
  const feature = weekly[0] || articles[0];
  const latest = articles.slice(0, 6);
  const heroPhotos = [feature?.photo || PHOTOS.caravan, PHOTOS["challah-seeds"], PHOTOS["candles-three"]];

  const shabbosCard = week?.candles
    ? `<div class="glass-card">${icon.candle}<span><strong>Shabbos${week.topic ? ` ${esc(week.topic.name.replace(/^Parshas /, ""))}` : ""}</strong><span>Candles ${esc(week.candles)} · New York</span></span></div>`
    : "";

  const body = `<section class="home-hero">
  <div class="wrap hero-grid">
    <div class="hero-copy">
      ${week?.topic ? `<a class="eyebrow-chip" href="/${CATEGORIES.torah.slug}/${week.topic.id}/"><span class="dot"></span>This week · ${esc(week.topic.name)}</a>` : ""}
      <h1>Torah stories for the <em>Shabbos table,</em> bedtime and every day between</h1>
      <p class="lede">Read-aloud parsha stories, table questions, Yom Tov activities and middos lessons, written for frum families and morahs. Free, every week.</p>
      <div class="hero-actions">
        ${feature ? `<a class="btn" href="${feature.url}">Read this week's story ${icon.arrow}</a>` : ""}
        <a class="btn ghost" href="/${CATEGORIES.holidays.slug}/">Yamim Tovim</a>
      </div>
    </div>
    <div class="hero-art" aria-hidden="true">
      <div class="art art-a">${img(heroPhotos[0], { eager: true, sizes: "(max-width: 760px) 90vw, 34vw" })}</div>
      <div class="art art-b">${img(heroPhotos[1], { sizes: "20vw" })}</div>
      <div class="art art-c">${img(heroPhotos[2], { sizes: "20vw" })}</div>
      ${shabbosCard}
    </div>
  </div>
</section>

${weekly.length ? `<section class="wrap band">
  <div class="section-head"><h2>This week: ${esc(week.topic.name)}</h2><a class="more-link" href="/${CATEGORIES.torah.slug}/${week.topic.id}/">Everything for this parsha ${icon.arrow}</a></div>
  <div class="grid">${weekly.map((a) => card(a)).join("")}</div>
</section>` : ""}

<section class="wrap band">
  <div class="section-head"><h2>Explore by topic</h2></div>
  <div class="bento">${CAT_LIST.map((c, i) => {
    const n = TOPICS.filter((t) => t.category === c.key).length;
    return `<a class="tile tile-${i}" href="/${c.slug}/">${img(PHOTOS[c.photo], { sizes: i === 0 ? "(max-width: 760px) 100vw, 50vw" : "(max-width: 760px) 50vw, 25vw" })}<span class="tile-body"><span class="tile-count">${n} topics</span><strong>${esc(c.name)}</strong><span class="tile-blurb">${esc(c.blurb)}</span></span></a>`;
  }).join("")}</div>
</section>

${latest.length > weekly.length ? `<section class="wrap band">
  <div class="section-head"><h2>New on Torah Stories</h2></div>
  <div class="grid">${latest.map((a) => card(a)).join("")}</div>
</section>` : ""}

<section class="wrap band">
  <div class="section-head"><h2>Ideas for every moment</h2></div>
  <div class="ideas">${TYPE_KEYS.map((k, i) => `<a href="/${k}/"><span class="idea-n">${String(i + 1).padStart(2, "0")}</span><strong>${esc(ARTICLE_TYPES[k].plural)}</strong><span>${esc(ARTICLE_TYPES[k].ages)}</span></a>`).join("")}<a href="#" class="idea-search" data-search><span class="idea-n">→</span><strong>Search everything</strong><span>Press ⌘K anytime</span></a></div>
</section>

<section class="wrap band">${houseAd(week?.topic || null, "home:band")}</section>`;

  return layout({
    title: `${SITE.name}: Parsha Stories, Yom Tov Ideas and Middos for Kids`,
    description: SITE.description, path: "/", body, photo: heroPhotos[0], bodyClass: "is-home",
    jsonLd: [{ "@context": "https://schema.org", "@type": "WebSite", name: SITE.name, url: SITE.url }],
  });
};

const staticPage = (path, title, html) =>
  layout({ title: `${title} | ${SITE.name}`, description: `${title}, ${SITE.name}`, path, body: `<div class="wrap page"><h1>${esc(title)}</h1><div class="prose">${html}</div></div>` });

const STATIC = {
  "/about/": ["About Torah Stories", `<p>Torah Stories is a free library of Torah stories, parsha summaries, Shabbos table questions, Yom Tov activities and middos lessons for frum families, morahs and rebbeim.</p>
<p>Every article is written the way these stories are taught in a frum home and classroom: pshat, with well-known Rashi and Midrash, and always with a lesson a child can carry into their week.</p>
<p>Torah Stories is supported by advertising, including ads for <a href="${ttLink("/", "about")}">TorahTale</a>, which makes personalized Torah storybooks.</p>
<p>Found something that should be corrected? Please tell us on the <a href="/contact/">contact page</a> and we will fix it.</p>`],
  "/contact/": ["Contact", `<p>Questions, corrections or ideas for an article? Email <a href="mailto:help@torahtale.com">help@torahtale.com</a> and a person on our team will reply.</p>`],
  "/privacy/": ["Privacy Policy", `<p>Last updated ${fmtDate(TODAY)}.</p>
<h3>What we collect</h3><p>Torah Stories has no accounts and no forms. We do not ask for or store personal information. Your light or dark theme choice is saved only in your own browser.</p>
<h3>Advertising and cookies</h3><p>We use Google AdSense to show ads. Google and its partners use cookies to serve ads based on your prior visits to this and other websites. Google's use of advertising cookies enables it and its partners to serve ads based on your visits to this site and/or other sites on the Internet. You may opt out of personalized advertising by visiting <a href="https://adssettings.google.com">Google Ads Settings</a>, or opt out of third-party vendors' use of cookies for personalized advertising at <a href="https://www.aboutads.info/choices/">aboutads.info</a>. See <a href="https://policies.google.com/technologies/partner-sites">how Google uses information from sites that use its services</a>.</p>
<p>Some ad spaces show ads for TorahTale. Those links carry tags that tell TorahTale which article you came from; they do not identify you.</p>
<h3>Children</h3><p>This site is written for parents and teachers. We do not knowingly collect information from children.</p>
<h3>Contact</h3><p><a href="mailto:help@torahtale.com">help@torahtale.com</a></p>`],
  "/terms/": ["Terms of Use", `<p>You are welcome to read, print and share these articles for use at home, in shul and in the classroom. Please do not republish them on another website. The content is for education and inspiration and is not a source of practical halacha; ask your Rav.</p><p>Photographs are from Unsplash and used under the Unsplash License.</p>`],
};

// ── feeds ───────────────────────────────────────────────────────────────────
const sitemap = (urls) => `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `<url><loc>${SITE.url}${u.path}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ""}</url>`).join("\n")}
</urlset>`;

const rss = (articles) => `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
<title>${esc(SITE.name)}</title><link>${SITE.url}</link><description>${esc(SITE.description)}</description>
${articles.slice(0, 50).map((a) => `<item><title>${esc(a.title)}</title><link>${SITE.url}${a.url}</link><guid>${SITE.url}${a.url}</guid><pubDate>${new Date(`${a.published}T12:00:00Z`).toUTCString()}</pubDate><description>${esc(a.description)}</description></item>`).join("\n")}
</channel></rss>`;

// This week's parsha and candle lighting, from Hebcal. The build still succeeds offline.
const thisWeek = async () => {
  try {
    const r = await fetch("https://www.hebcal.com/shabbat?cfg=json&geonameid=5128581&M=on", { signal: AbortSignal.timeout(8000) });
    const j = await r.json();
    const p = j.items.find((i) => i.category === "parashat");
    const c = j.items.find((i) => i.category === "candles");
    const skel = (x) => x.toLowerCase().replace(/[^a-z]/g, "").replace(/h$/, "").replace(/[aeiouy]/g, "");
    const want = p ? skel(p.title.replace(/^Parashat\s+/, "")) : null;
    const topic = want ? TOPICS.find((t) => t.category === "torah" && [t.id, t.name.replace(/^Parshas\s+/, "")].some((x) => skel(x) === want)) || null : null;
    const candles = c ? new Date(c.date).toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" }) : null;
    return { topic, candles };
  } catch {
    return null;
  }
};

// ── build ───────────────────────────────────────────────────────────────────
const write = (path, html) => {
  const file = path.endsWith("/") ? join(DIST, path, "index.html") : join(DIST, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, html);
};

export const build = async () => {
  rmSync(DIST, { recursive: true, force: true });
  mkdirSync(DIST, { recursive: true });
  cpSync(join(ROOT, "assets"), join(DIST, "assets"), { recursive: true });

  const articles = loadArticles();
  const urls = [{ path: "/", lastmod: articles[0]?.published }];

  for (const a of articles) {
    write(a.url, articlePage(a, articles));
    urls.push({ path: a.url, lastmod: a.updated || a.published });
  }

  const byTopic = new Map();
  for (const a of articles) byTopic.set(a.topic, [...(byTopic.get(a.topic) || []), a]);

  for (const [key, cat] of Object.entries(CATEGORIES)) {
    write(`/${cat.slug}/`, categoryPage(key, cat, byTopic));
    urls.push({ path: `/${cat.slug}/` });
    for (const t of TOPICS.filter((x) => x.category === key && byTopic.has(x.id))) {
      write(`/${cat.slug}/${t.id}/`, topicPage(t, byTopic.get(t.id)));
      urls.push({ path: `/${cat.slug}/${t.id}/`, lastmod: byTopic.get(t.id)[0].published });
    }
  }
  for (const key of TYPE_KEYS) {
    const list = articles.filter((a) => a.type === key);
    if (!list.length) continue;
    write(`/${key}/`, typePage(key, list));
    urls.push({ path: `/${key}/` });
  }

  write("/", homePage(articles, await thisWeek()));
  for (const [path, [title, html]] of Object.entries(STATIC)) {
    write(path, staticPage(path, title, html));
    urls.push({ path });
  }
  write("/404.html", layout({ title: `Page not found | ${SITE.name}`, description: "Page not found", path: "/404.html", body: `<div class="wrap page"><h1>We couldn't find that page</h1><p class="lede">Try searching, or <a href="/">go back to all the stories</a>.</p></div>` }));

  // Search index for the ⌘K box.
  write("/search.json", JSON.stringify([
    ...articles.map((a) => ({ t: a.title, u: a.url, k: a.kind.label, c: CATEGORIES[a.topicObj.category].short, s: `${a.topicObj.name} ${a.topicObj.he || ""} ${(a.keywords || []).join(" ")}` })),
    ...[...byTopic.keys()].map((id) => { const t = topicById(id); return { t: `${t.name} for kids`, u: `/${t.categorySlug}/${t.id}/`, k: "Topic", c: CATEGORIES[t.category].short, s: `${t.he || ""} ${t.label}` }; }),
    ...CAT_LIST.map((c) => ({ t: `${c.name} for kids`, u: `/${c.slug}/`, k: "Section", c: c.short, s: c.blurb })),
  ]));

  write("/sitemap.xml", sitemap(urls));
  write("/rss.xml", rss(articles));
  write("/robots.txt", `User-agent: *\nAllow: /\n\nSitemap: ${SITE.url}/sitemap.xml\n`);
  write("/CNAME", `${SITE.domain}\n`);
  write("/.nojekyll", "");
  if (adsenseOn()) write("/ads.txt", `google.com, ${ADS.ADSENSE_CLIENT.replace(/^ca-/, "")}, DIRECT, f08c47fec0942fa0\n`);

  console.log(`built ${articles.length} articles, ${byTopic.size} topics, ${urls.length} urls`);
  return { articles: articles.length, topics: byTopic.size };
};

if (process.argv[1] === fileURLToPath(import.meta.url)) await build();
