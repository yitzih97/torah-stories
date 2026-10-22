// Static site build. Zero dependencies: node build.mjs → dist/
//
// Content is content/articles/*.json (written by scripts/write.mjs). A topic or
// category page exists only once it has at least one article, so the site never
// ships a page with nothing to read on it.

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { ADS, CATEGORIES, SITE, TORAHTALE } from "./site.config.mjs";
import { ARTICLE_TYPES } from "./data/article-types.mjs";
import { TOPICS, topicById } from "./data/topics.mjs";

const ROOT = dirname(fileURLToPath(import.meta.url));
const DIST = join(ROOT, "dist");
const ARTICLES_DIR = join(ROOT, "content", "articles");
const TODAY = new Date().toISOString().slice(0, 10);

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
const words = (a) => textOf([a.intro, ...a.sections.map((s) => s.html)].join(" ")).split(" ").length;
const ttLink = (path, content) => `${TORAHTALE.url}${path}${path.includes("?") ? "&" : "?"}${TORAHTALE.utm(content)}`;
const coverUrl = (t) => (t?.cover ? `/assets/covers/${t.cover}` : "/assets/og-default.jpg");
const fmtDate = (d) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

// Stable 32-bit hash, used to pick house-ad creatives deterministically.
const hash = (s) => [...s].reduce((h, c) => (Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0), 2166136261);

// ── load content ────────────────────────────────────────────────────────────
const loadArticles = () => {
  if (!existsSync(ARTICLES_DIR)) return [];
  return readdirSync(ARTICLES_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(join(ARTICLES_DIR, f), "utf8")))
    .filter((a) => a.published <= TODAY && topicById(a.topic))
    .map((a) => ({ ...a, topicObj: topicById(a.topic), url: `/${a.slug}/` }))
    .sort((a, b) => (b.published + b.slug).localeCompare(a.published + a.slug));
};

// ── ads ─────────────────────────────────────────────────────────────────────
// Slots alternate between AdSense and a TorahTale house ad, so HOUSE_SHARE is an
// exact split. Which one comes first depends on the article, so across the site
// both kinds appear in every position. Until AdSense is approved every slot is a
// house ad.
const adsenseOn = () => Boolean(ADS.ADSENSE_CLIENT);

const HOUSE_CREATIVES = [
  (t) => ({
    kicker: "From TorahTale",
    title: t ? `${t.name}, starring your child` : "A Torah story starring your child",
    body: "Your child's face and name drawn into every page of a printed storybook.",
    cta: "Make my child's book",
    href: t?.hasTorahTalePage ? ttLink(TORAHTALE.orderPath(t.id), `house-order-${t.id}`) : ttLink("/", "house-order"),
    img: t?.cover ? coverUrl(t) : null,
  }),
  () => ({
    kicker: "From TorahTale",
    title: "Over 250 personalized Torah stories",
    body: "Tanach, Yamim Tovim, Mitzvos and Middos, Tzaddikim and family simchas, each one with your child inside the story.",
    cta: "Browse the stories",
    href: ttLink("/stories", "house-browse"),
    img: null,
  }),
  () => ({
    kicker: "From TorahTale",
    title: "A new Torah story arrives every month",
    body: "A personalized book delivered to your door, following the parsha and the Yamim Tovim through the year.",
    cta: "See the plans",
    href: ttLink("/", "house-subscribe"),
    img: null,
  }),
  () => ({
    kicker: "From TorahTale",
    title: "The gift for an upsherin, birthday or Chanukah",
    body: "A storybook where the child is the hero, printed and shipped as a keepsake.",
    cta: "Find a gift",
    href: ttLink("/", "house-gift"),
    img: null,
  }),
];

const houseAd = (topic, seed) => {
  const c = HOUSE_CREATIVES[hash(seed) % HOUSE_CREATIVES.length](topic);
  return `<aside class="house-ad" aria-label="From TorahTale">
  <a href="${esc(c.href)}" rel="sponsored">
    ${c.img ? `<img src="${esc(c.img)}" alt="" loading="lazy" width="96" height="96">` : `<img src="/assets/brand-mark.png" alt="" loading="lazy" width="56" height="56" class="mark">`}
    <span class="ha-text"><span class="ha-kicker">${esc(c.kicker)}</span><strong>${esc(c.title)}</strong><span>${esc(c.body)}</span></span>
    <span class="ha-cta">${esc(c.cta)}</span>
  </a>
</aside>`;
};

const adsenseUnit = (slotId) => `<div class="ad-slot"><span class="ad-label">Advertisement</span>
  <ins class="adsbygoogle" style="display:block" data-ad-client="${esc(ADS.ADSENSE_CLIENT)}"${slotId ? ` data-ad-slot="${esc(slotId)}"` : ""} data-ad-format="auto" data-full-width-responsive="true"></ins>
  <script>(adsbygoogle=window.adsbygoogle||[]).push({});</script>
</div>`;

const adSlot = (topic, seed, index, slotId = ADS.SLOTS.inArticle) => {
  if (!adsenseOn()) return houseAd(topic, seed);
  // Every 1/HOUSE_SHARE-th slot is ours; at 0.5 that is every other slot.
  const period = Math.max(1, Math.round(1 / ADS.HOUSE_SHARE));
  const offset = hash(seed.split(":")[0]) % period;
  return (index + offset) % period === 0 ? houseAd(topic, seed) : adsenseUnit(slotId);
};

// ── layout ──────────────────────────────────────────────────────────────────
const NAV = Object.values(CATEGORIES);

const layout = ({ title, description, path, body, image, jsonLd = [], type = "website" }) => {
  const canonical = `${SITE.url}${path}`;
  const img = `${SITE.url}${image || "/assets/og-default.jpg"}`;
  return `<!doctype html>
<html lang="${SITE.language}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="${type}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${img}">
<meta property="og:site_name" content="${esc(SITE.name)}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/assets/favicon.png">
<link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">
<link rel="alternate" type="application/rss+xml" title="${esc(SITE.name)}" href="/rss.xml">
<link rel="preload" href="/assets/fonts/TorahTale-Regular.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/assets/site.css">
${adsenseOn() ? `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${esc(ADS.ADSENSE_CLIENT)}" crossorigin="anonymous"></script>` : ""}
${jsonLd.map((j) => `<script type="application/ld+json">${JSON.stringify(j).replace(/</g, "\\u003c")}</script>`).join("\n")}
</head>
<body>
<header class="site-header">
  <div class="wrap header-row">
    <a class="logo" href="/"><span class="logo-word">Torah Stories</span></a>
    <nav class="nav" aria-label="Sections">${NAV.map((c) => `<a href="/${c.slug}/">${esc(c.short)}</a>`).join("")}</nav>
  </div>
</header>
<main>
${body}
</main>
<footer class="site-footer">
  <div class="wrap">
    <div class="footer-cta">
      <img src="/assets/brand-mark.png" alt="" width="44" height="44">
      <p><strong>Torah Stories is made by TorahTale.</strong> TorahTale turns these stories into personalized storybooks with your child as the hero.
      <a href="${esc(ttLink("/", "footer"))}">Visit TorahTale</a></p>
    </div>
    <nav class="footer-nav">${NAV.map((c) => `<a href="/${c.slug}/">${esc(c.name)}</a>`).join("")}</nav>
    <nav class="footer-nav small"><a href="/about/">About</a><a href="/contact/">Contact</a><a href="/privacy/">Privacy</a><a href="/terms/">Terms</a><a href="/rss.xml">RSS</a></nav>
    <p class="small">© ${new Date().getFullYear()} ${esc(SITE.publisher)}.</p>
  </div>
</footer>
</body>
</html>`;
};

const breadcrumbs = (items) => {
  const html = `<nav class="crumbs" aria-label="Breadcrumb">${items
    .map((it, i) => (i < items.length - 1 ? `<a href="${it.path}">${esc(it.name)}</a><span>›</span>` : `<span aria-current="page">${esc(it.name)}</span>`))
    .join("")}</nav>`;
  const ld = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: `${SITE.url}${it.path}` })),
  };
  return { html, ld };
};

const card = (a) => `<a class="card" href="${a.url}">
  <img src="${coverUrl(a.topicObj)}" alt="" loading="lazy" width="400" height="400">
  <span class="card-kicker">${esc(CATEGORIES[a.topicObj.category].short)}</span>
  <strong>${esc(a.title)}</strong>
  <span class="card-desc">${esc(a.description)}</span>
</a>`;

// ── pages ───────────────────────────────────────────────────────────────────
const articlePage = (a, all) => {
  const t = a.topicObj;
  const cat = CATEGORIES[t.category];
  const crumbs = breadcrumbs([
    { name: "Home", path: "/" },
    { name: cat.name, path: `/${cat.slug}/` },
    { name: t.name, path: `/${cat.slug}/${t.id}/` },
    { name: a.title, path: a.url },
  ]);

  let adIndex = 0;
  const sectionsHtml = a.sections
    .map((s, i) => {
      const block = `<section><h2 id="s${i + 1}">${esc(s.heading)}</h2>${sanitize(s.html)}</section>`;
      const ad = (i + 1) % ADS.EVERY_N_SECTIONS === 0 && i < a.sections.length - 1 && adIndex < ADS.MAX_IN_ARTICLE
        ? adSlot(t, `${a.slug}:${adIndex}`, adIndex++)
        : "";
      return block + ad;
    })
    .join("\n");

  const faqHtml = a.faq?.length
    ? `<section class="faq"><h2>Questions parents ask</h2>${a.faq.map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join("")}</section>`
    : "";

  const siblings = all.filter((x) => x.topic === a.topic && x.slug !== a.slug).slice(0, 6);
  const related = all.filter((x) => x.topic !== a.topic && x.topicObj.category === t.category).slice(0, 6 - Math.min(siblings.length, 3));
  const more = [...siblings.slice(0, 3), ...related].slice(0, 6);

  const ctaHref = t.hasTorahTalePage ? ttLink(TORAHTALE.orderPath(t.id), `cta-${a.slug}`) : ttLink("/", `cta-${a.slug}`);
  const storyHref = t.hasTorahTalePage ? ttLink(TORAHTALE.storyPath(t.id), `cta-story-${a.slug}`) : null;

  const cta = `<section class="tt-cta">
  ${t.cover ? `<img src="${coverUrl(t)}" alt="The TorahTale ${esc(t.name)} book cover" width="220" height="220" loading="lazy">` : ""}
  <div>
    <p class="tt-kicker">Make it their own story</p>
    <h2>${esc(t.name)}, with your child inside it</h2>
    <p>TorahTale turns ${esc(t.name)} into a personalized storybook. Your child appears on every page, drawn from a photo, with their own name in the story, so the lesson they hear tonight is one they will ask for again and again.</p>
    <p class="tt-actions"><a class="btn" href="${esc(ctaHref)}">Create your child's ${esc(t.name)} book</a>${storyHref ? `<a class="link" href="${esc(storyHref)}">See this story on TorahTale</a>` : ""}</p>
  </div>
</section>`;

  const ld = [
    crumbs.ld,
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: a.title,
      description: a.description,
      image: `${SITE.url}${coverUrl(t)}`,
      datePublished: a.published,
      dateModified: a.updated || a.published,
      author: { "@type": "Organization", name: SITE.name, url: SITE.url },
      publisher: { "@type": "Organization", name: SITE.name, logo: { "@type": "ImageObject", url: `${SITE.url}/assets/brand-mark.png` } },
      mainEntityOfPage: `${SITE.url}${a.url}`,
      keywords: (a.keywords || []).join(", "),
      inLanguage: "en",
    },
  ];
  if (a.faq?.length)
    ld.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: a.faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    });

  const minutes = Math.max(2, Math.round(words(a) / 220));
  const body = `<article class="wrap article">
  ${crumbs.html}
  <header class="article-head">
    <p class="kicker"><a href="/${cat.slug}/">${esc(cat.name)}</a> · ${esc(t.he || "")}</p>
    <h1>${esc(a.title)}</h1>
    <p class="meta">${fmtDate(a.published)} · ${minutes} min read</p>
  </header>
  ${t.cover ? `<figure class="hero"><img src="${coverUrl(t)}" alt="${esc(t.name)} illustration" width="800" height="800"></figure>` : ""}
  <div class="prose">
    ${sanitize(a.intro)}
    ${a.sections.length > 3 ? `<nav class="toc" aria-label="On this page"><strong>On this page</strong><ol>${a.sections.map((s, i) => `<li><a href="#s${i + 1}">${esc(s.heading)}</a></li>`).join("")}</ol></nav>` : ""}
    ${sectionsHtml}
    ${faqHtml}
  </div>
  ${cta}
  ${more.length ? `<section class="more"><h2>Keep reading</h2><div class="grid">${more.map(card).join("")}</div></section>` : ""}
</article>`;

  return layout({ title: `${a.title} | ${SITE.name}`, description: a.description, path: a.url, body, image: coverUrl(t), jsonLd: ld, type: "article" });
};

const topicPage = (t, list) => {
  const cat = CATEGORIES[t.category];
  const path = `/${cat.slug}/${t.id}/`;
  const crumbs = breadcrumbs([{ name: "Home", path: "/" }, { name: cat.name, path: `/${cat.slug}/` }, { name: t.name, path }]);
  const ordered = Object.keys(ARTICLE_TYPES).map((k) => list.find((a) => a.type === k)).filter(Boolean);
  const body = `<div class="wrap">
  ${crumbs.html}
  <header class="topic-head">
    ${t.cover ? `<img src="${coverUrl(t)}" alt="${esc(t.name)}" width="260" height="260">` : ""}
    <div><p class="kicker">${esc(cat.name)} · ${esc(t.he || "")}</p><h1>${esc(t.name)} for Kids</h1><p class="lede">${esc(t.summary)}</p></div>
  </header>
  <div class="grid">${ordered.map(card).join("")}</div>
  ${adSlot(t, `topic-${t.id}:0`, 0)}
</div>`;
  return layout({
    title: `${t.name} for Kids: Stories, Questions and Activities | ${SITE.name}`,
    description: `${t.name} for children: ${t.summary}`.slice(0, 158),
    path, body, image: coverUrl(t), jsonLd: [crumbs.ld],
  });
};

const categoryPage = (cat, topics, articles) => {
  const path = `/${cat.slug}/`;
  const crumbs = breadcrumbs([{ name: "Home", path: "/" }, { name: cat.name, path }]);
  const body = `<div class="wrap">
  ${crumbs.html}
  <header class="page-head"><h1>${esc(cat.name)} for Kids</h1><p class="lede">Stories, Shabbos table questions, activities and lessons for every ${esc(cat.short.toLowerCase())} topic.</p></header>
  <div class="topic-grid">${topics
    .map((t) => `<a class="topic" href="/${cat.slug}/${t.id}/"><img src="${coverUrl(t)}" alt="" loading="lazy" width="200" height="200"><strong>${esc(t.name)}</strong><span>${articles.filter((a) => a.topic === t.id).length} articles</span></a>`)
    .join("")}</div>
</div>`;
  return layout({ title: `${cat.name} for Kids | ${SITE.name}`, description: `${cat.name} stories, activities and Shabbos table ideas for frum families.`, path, body, jsonLd: [crumbs.ld] });
};

const homePage = (articles, weekly) => {
  const latest = articles.slice(0, 12);
  const weeklyList = weekly ? articles.filter((a) => a.topic === weekly.id) : [];
  const body = `<section class="home-hero"><div class="wrap">
  <h1>Torah stories for kids, for every parsha and Yom Tov</h1>
  <p class="lede">${esc(SITE.description)}</p>
</div></section>
<div class="wrap">
  ${weekly && weeklyList.length ? `<section class="weekly"><h2>This week: ${esc(weekly.name)}</h2><div class="grid">${weeklyList.slice(0, 6).map(card).join("")}</div></section>` : ""}
  <section><h2>New on Torah Stories</h2><div class="grid">${latest.map(card).join("")}</div></section>
  ${adSlot(null, "home:0", 0)}
  <section><h2>Browse by topic</h2><div class="cat-grid">${NAV.map((c) => `<a href="/${c.slug}/">${esc(c.name)}</a>`).join("")}</div></section>
</div>`;
  return layout({
    title: `${SITE.name}: Parsha Stories, Yom Tov Activities and Middos for Kids`,
    description: SITE.description, path: "/", body,
    jsonLd: [{ "@context": "https://schema.org", "@type": "WebSite", name: SITE.name, url: SITE.url, publisher: { "@type": "Organization", name: SITE.name } }],
  });
};

const staticPage = (path, title, html) =>
  layout({ title: `${title} | ${SITE.name}`, description: `${title} - ${SITE.name}`, path, body: `<div class="wrap prose page"><h1>${esc(title)}</h1>${html}</div>` });

const STATIC = {
  "/about/": ["About Torah Stories", `<p>Torah Stories is a free library of Torah stories, parsha summaries, Shabbos table questions, Yom Tov activities and middos lessons for frum families, morahs and rebbeim.</p>
<p>It is made by <a href="${ttLink("/", "about")}">TorahTale</a>, which creates personalized Torah storybooks where the child is the hero of the story. Every article here is written the way these stories are taught in a frum home and classroom: pshat, with well-known Rashi and Midrash, and always with a lesson a child can carry into their week.</p>
<p>Found something that should be corrected? Please tell us on the <a href="/contact/">contact page</a> and we will fix it.</p>`],
  "/contact/": ["Contact", `<p>Questions, corrections or ideas for an article? Email <a href="mailto:help@torahtale.com">help@torahtale.com</a> and a person on our team will reply.</p>`],
  "/privacy/": ["Privacy Policy", `<p>Last updated ${fmtDate(TODAY)}.</p>
<h3>What we collect</h3><p>Torah Stories has no accounts and no forms. We do not ask for or store personal information.</p>
<h3>Advertising and cookies</h3><p>We use Google AdSense to show ads. Google and its partners use cookies to serve ads based on your prior visits to this and other websites. Google's use of advertising cookies enables it and its partners to serve ads based on your visits to this site and/or other sites on the Internet. You may opt out of personalized advertising by visiting <a href="https://adssettings.google.com">Google Ads Settings</a>, or opt out of third-party vendors' use of cookies for personalized advertising at <a href="https://www.aboutads.info/choices/">aboutads.info</a>. See <a href="https://policies.google.com/technologies/partner-sites">how Google uses information from sites that use its services</a>.</p>
<p>Some ad spaces show our own ads for TorahTale. Those links carry tags that tell TorahTale which article you came from; they do not identify you.</p>
<h3>Children</h3><p>This site is written for parents and teachers. We do not knowingly collect information from children.</p>
<h3>Contact</h3><p><a href="mailto:help@torahtale.com">help@torahtale.com</a></p>`],
  "/terms/": ["Terms of Use", `<p>You are welcome to read, print and share these articles for use at home, in shul and in the classroom. Please do not republish them on another website. The content is for education and inspiration and is not a source of practical halacha; ask your Rav.</p>`],
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

// This week's parsha, from Hebcal. The build still succeeds offline.
const weeklyParsha = async () => {
  try {
    const r = await fetch("https://www.hebcal.com/shabbat?cfg=json&geonameid=5128581&M=on", { signal: AbortSignal.timeout(8000) });
    const j = await r.json();
    const p = j.items.find((i) => i.category === "parashat");
    if (!p) return null;
    const skel = (x) => x.toLowerCase().replace(/[^a-z]/g, "").replace(/h$/, "").replace(/[aeiouy]/g, "");
    const want = skel(p.title.replace(/^Parashat\s+/, ""));
    return TOPICS.find((t) => t.category === "torah" && [t.id, t.name.replace(/^Parshas\s+/, "")].some((x) => skel(x) === want)) || null;
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
    const topics = TOPICS.filter((t) => t.category === key && byTopic.has(t.id));
    if (!topics.length) continue;
    write(`/${cat.slug}/`, categoryPage(cat, topics, articles));
    urls.push({ path: `/${cat.slug}/` });
    for (const t of topics) {
      write(`/${cat.slug}/${t.id}/`, topicPage(t, byTopic.get(t.id)));
      urls.push({ path: `/${cat.slug}/${t.id}/`, lastmod: byTopic.get(t.id)[0].published });
    }
  }

  write("/", homePage(articles, await weeklyParsha()));
  for (const [path, [title, html]] of Object.entries(STATIC)) {
    write(path, staticPage(path, title, html));
    urls.push({ path });
  }
  write("/404.html", layout({ title: `Page not found | ${SITE.name}`, description: "Page not found", path: "/404.html", body: `<div class="wrap prose page"><h1>We couldn't find that page</h1><p><a href="/">Back to all Torah stories</a></p></div>` }));

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
