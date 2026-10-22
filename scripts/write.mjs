/**
 * The article writer.
 *
 * Picks the next (topic, angle) pairs that have no article yet, has Claude write
 * each one, checks it, and saves it to content/articles/<slug>.json. Committing
 * the files triggers the Pages deploy, which rebuilds the sitemap and feeds.
 *
 * Order: the next few parshiyos and Yamim Tovim come first (that is what people
 * search for this week), then every topic's "story for kids" article, then the
 * other angles by priority.
 *
 *   node scripts/write.mjs --count 6          # write six articles
 *   node scripts/write.mjs --plan --count 20  # show what it would write, call nothing
 *   node scripts/write.mjs --topic noach --type quiz-for-kids
 *
 * Needs ANTHROPIC_API_KEY (or an `ant auth login` profile) and @anthropic-ai/sdk.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { ARTICLE_TYPES, typesFor } from "../data/article-types.mjs";
import { TOPICS, topicById } from "../data/topics.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "content", "articles");
mkdirSync(OUT, { recursive: true });

const MODEL = process.env.WRITER_MODEL || "claude-opus-5-5";
const EFFORT = process.env.WRITER_EFFORT || "medium";

const argv = process.argv.slice(2);
const flag = (n) => argv.includes(`--${n}`);
const value = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const COUNT = Math.max(1, parseInt(value("count", "1"), 10) || 1);
const PLAN = flag("plan");
const TODAY = value("date", new Date().toISOString().slice(0, 10));

const slugify = (s) => s.toLowerCase().replace(/['’]/g, "").replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const fill = (tpl, t) => tpl.replaceAll("{name}", t.name);

// ── what already exists ─────────────────────────────────────────────────────
const existing = readdirSync(OUT).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(readFileSync(join(OUT, f), "utf8")));
const done = new Set(existing.map((a) => `${a.topic}/${a.type}`));
const takenSlugs = new Set(existing.map((a) => a.slug));

// ── seasonal priority (Hebcal) ──────────────────────────────────────────────
const HEBCAL_TO_TOPIC = {
  "Rosh Hashana": "rosh-hashana", "Yom Kippur": "yom-kippur", Sukkot: "sukkot", "Shmini Atzeret": "shemini-atzeres",
  "Simchat Torah": "simchat-torah", Chanukah: "chanukah", "Tu BiShvat": "tu-bishvat", Purim: "purim",
  "Ta'anit Esther": "taanis-esther", "Shushan Purim": "shushan-purim", "Purim Katan": "purim-katan", Pesach: "pesach",
  "Pesach Sheni": "pesach-sheni", "Lag BaOmer": "lag-baomer", Shavuot: "shavuot", "Tzom Gedaliah": "tzom-gedaliah",
  "Asara B'Tevet": "asarah-bteves", "Tzom Tammuz": "shiva-asar-btammuz", "Tish'a B'Av": "tisha-bav", "Tu B'Av": "tu-bav",
};
const norm = (s) => s.toLowerCase().replace(/[^a-z]/g, "");
// Hebcal spells parshiyos the Israeli way ("Chayei Sara", "Vayera"); compare consonant skeletons.
const skel = (s) => norm(s).replace(/h$/, "").replace(/[aeiouy]/g, "");

const seasonal = async () => {
  const end = new Date(Date.parse(TODAY) + 50 * 86400000).toISOString().slice(0, 10);
  const url = `https://www.hebcal.com/hebcal?v=1&cfg=json&maj=on&min=on&mod=on&s=on&start=${TODAY}&end=${end}`;
  try {
    const j = await (await fetch(url, { signal: AbortSignal.timeout(8000) })).json();
    const ids = [];
    for (const it of j.items || []) {
      let id = null;
      if (it.category === "parashat") {
        const n = norm(it.title.replace(/^Parashat\s+/, ""));
        id = TOPICS.find((t) => t.category === "torah" && [t.id, t.name.replace(/^Parshas\s+/, "")].some((x) => skel(x) === skel(n)))?.id;
        // Only the next four parshiyos; further out is too early to rank.
        if (id && ids.filter((x) => topicById(x)?.category === "torah").length >= 4) id = null;
      } else {
        id = HEBCAL_TO_TOPIC[String(it.title).replace(/:.*$/, "").replace(/\s+\d.*$/, "").replace(/ [IVX]+$/, "").trim()];
      }
      if (id && topicById(id) && !ids.includes(id)) ids.push(id);
    }
    return ids;
  } catch (e) {
    console.warn(`writer: no seasonal boost today (${e.message})`);
    return [];
  }
};

const plan = async () => {
  const forcedTopic = value("topic", null);
  const forcedType = value("type", null);
  if (forcedTopic) {
    const t = topicById(forcedTopic);
    if (!t) throw new Error(`unknown topic ${forcedTopic}`);
    return (forcedType ? [forcedType] : typesFor(t)).filter((k) => !done.has(`${t.id}/${k}`)).map((type) => ({ topic: t, type })).slice(0, COUNT);
  }
  const queue = [];
  const push = (t, type) => { if (!done.has(`${t.id}/${type}`) && !queue.some((q) => q.topic.id === t.id && q.type === type)) queue.push({ topic: t, type }); };
  // 1. what people are searching this month: every angle of the coming parshiyos and Yamim Tovim
  for (const id of await seasonal()) for (const type of typesFor(topicById(id))) push(topicById(id), type);
  // 2. then each priority tier across the whole catalogue, in catalogue order
  for (let p = 1; p <= 5; p++)
    for (const t of TOPICS) for (const type of typesFor(t)) if (ARTICLE_TYPES[type].priority === p) push(t, type);
  return queue.slice(0, COUNT);
};

// ── the prompt ──────────────────────────────────────────────────────────────
const LESSONS = (() => {
  try {
    const raw = JSON.parse(readFileSync(join(ROOT, "data/lessons.json"), "utf8"));
    return (raw.lessons || []).map((l, i) => `${i + 1}. ${l.rule}`).join("\n");
  } catch { return ""; }
})();
const FACTS = readFileSync(join(ROOT, "data/product-facts.txt"), "utf8");

const SYSTEM = `You write articles for Torah Stories (torah-stories.com), a free library of Torah content for frum families, morahs and rebbeim. It is published by TorahTale, which makes personalized Torah storybooks with the child as the hero.

The reader is a frum (Orthodox) parent or teacher, mostly American, who searched Google for something they need tonight or this Shabbos. Give them exactly that, completely, so they never need another page.

Voice and hashkafa:
- Traditional Ashkenazi terms and transliteration throughout: Hashem, Torah, parsha, Shabbos, Yom Tov, cheder, Avraham Avinu, Moshe Rabbeinu, Yidden, middos, mitzvos, tefillah, tzedakah, Bereishis, Shemos.
- Teach it the way it is taught in a frum home: pshat, with well-known Rashi and Midrash. Label midrash as midrash ("Chazal tell us", "the Midrash relates") and pesukim as the Torah. When unsure of a source, say "the meforshim explain" rather than naming one.
- Never an academic, critical or comparative-religion angle. Never question whether events happened. Never describe Hashem physically. Nothing about any other religion.
- Tzniusdik: no romance, no description of women's appearance, nothing frightening told graphically.
- Never mention or suggest a Magen David / Star of David.
- Not practical halacha: where a halachic detail comes up, keep it general and add "ask your Rav".
- Writing, drawing, coloring, cutting and crafts are weekday activities. Never suggest them for Shabbos or Yom Tov; when an activity list sits near Shabbos or Yom Tov, say "during the week" or "before Shabbos". Shabbos-table ideas are talking, singing, questions and stories only.
- Songs and chants must be your own original words, never lyrics of existing songs.
- Warm, specific, practical. Short paragraphs of 2 to 4 sentences. No filler ("dive in", "in today's fast-paced world"), no stacked exclamation marks.
- Never use an em dash or en dash. Use a hyphen, a comma or a full stop.

SEO:
- The article targets the search phrase given. Use it naturally in the title, the first paragraph and one heading. Use related phrases people search (with and without "Parshas", the Hebrew name, "for kids", "for preschool", "Shabbos table", "printable") where they fit, never stuffed.
- Every section heading is something a parent would actually type or ask.
- The FAQ answers 3 to 5 real questions in 1 to 3 sentences each.

TorahTale:
- Do NOT sell inside the article body; the page adds its own TorahTale box after the article. You may mention TorahTale at most once in the body, only where it truly helps (for example, "a personalized book of this story" in a section about keeping the lesson alive).
- Anything you say about TorahTale must come from this fact sheet and nothing else:
${FACTS}

Mistakes earlier articles made. Never repeat any of these, and check your article against every one before finishing:
${LESSONS}

Format: return JSON only, matching the schema. HTML fields use only <p>, <h3>, <ul>, <ol>, <li>, <strong>, <em>, <blockquote>. No Markdown, no links, no images, no headings other than <h3> inside a section.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "description", "keywords", "intro", "sections", "faq"],
  properties: {
    title: { type: "string", description: "SEO title, 45-65 characters, contains the search phrase" },
    description: { type: "string", description: "Meta description, 130-158 characters" },
    keywords: { type: "array", items: { type: "string" }, description: "6-10 search phrases this article answers" },
    intro: { type: "string", description: "HTML: 1-2 short paragraphs that answer the search right away" },
    sections: {
      type: "array",
      items: {
        type: "object", additionalProperties: false, required: ["heading", "html"],
        properties: { heading: { type: "string" }, html: { type: "string" } },
      },
      description: "5-9 sections",
    },
    faq: {
      type: "array",
      items: { type: "object", additionalProperties: false, required: ["q", "a"], properties: { q: { type: "string" }, a: { type: "string" } } },
    },
  },
};

const userPrompt = (t, typeKey) => {
  const type = ARTICLE_TYPES[typeKey];
  const siblings = existing.filter((a) => a.topic === t.id).map((a) => `- ${a.title}`).join("\n");
  return `Topic: ${t.name} (${t.label}${t.he ? `, ${t.he}` : ""})
Collection: ${t.category}${t.book ? `, Sefer ${t.book}` : ""}
What the TorahTale story covers: ${t.summary}

Article: ${fill(type.title, t)}
Target search phrase: "${fill(type.keyword, t)}"
What it must give the reader: ${type.brief}
Length: ${type.words[0]} to ${type.words[1]} words across intro and sections.
${siblings ? `\nThe site already has these articles on this topic. Do not repeat their content; this one must stand on its own angle:\n${siblings}\n` : ""}
Today is ${TODAY}.`;
};

// ── checks ──────────────────────────────────────────────────────────────────
const textOf = (h) => h.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

const repair = (a) => {
  const fix = (s) => s.replace(/\s*[—–]\s*/g, " - ").replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  return {
    ...a,
    title: fix(a.title), description: fix(a.description), intro: fix(a.intro),
    sections: a.sections.map((s) => ({ heading: fix(s.heading), html: fix(s.html) })),
    faq: a.faq.map((f) => ({ q: fix(f.q), a: fix(f.a) })),
  };
};

const problems = (a, type) => {
  const all = textOf([a.title, a.intro, ...a.sections.map((s) => s.heading + " " + s.html), ...a.faq.map((f) => f.q + " " + f.a)].join(" "));
  const n = textOf([a.intro, ...a.sections.map((s) => s.html)].join(" ")).split(" ").length;
  const out = [];
  if (n < type.words[0] * 0.8) out.push(`too short (${n} words)`);
  if (a.sections.length < 4) out.push("fewer than 4 sections");
  if (/star of david|magen david|mogen dovid/i.test(all)) out.push("mentions a Magen David");
  if (/\bjesus|christ|church\b/i.test(all)) out.push("mentions another religion");
  if (/<(a|img|script|iframe|h1|h2)\b/i.test(JSON.stringify(a))) out.push("disallowed HTML");
  if (/free shipping|free standard shipping/i.test(all)) out.push("claims free shipping");
  return out;
};

// ── run ─────────────────────────────────────────────────────────────────────
const queue = await plan();
if (!queue.length) { console.log("writer: nothing left to write"); process.exit(0); }
if (PLAN) { for (const q of queue) console.log(`${q.topic.id} / ${q.type}  →  ${fill(ARTICLE_TYPES[q.type].title, q.topic)}`); process.exit(0); }

const { default: Anthropic } = await import("@anthropic-ai/sdk");
const client = new Anthropic();
let wrote = 0, inTok = 0, outTok = 0;

for (const { topic: t, type: typeKey } of queue) {
  const type = ARTICLE_TYPES[typeKey];
  try {
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 32000,
      output_config: { effort: EFFORT, format: { type: "json_schema", schema: SCHEMA } },
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: userPrompt(t, typeKey) }],
    });
    const msg = await stream.finalMessage();
    inTok += msg.usage.input_tokens + (msg.usage.cache_read_input_tokens || 0) + (msg.usage.cache_creation_input_tokens || 0);
    outTok += msg.usage.output_tokens;
    if (msg.stop_reason === "refusal") { console.warn(`skip ${t.id}/${typeKey}: refusal`); continue; }
    if (msg.stop_reason === "max_tokens") { console.warn(`skip ${t.id}/${typeKey}: hit max_tokens`); continue; }
    const text = msg.content.find((b) => b.type === "text")?.text;
    const a = repair(JSON.parse(text));
    const bad = problems(a, type);
    if (bad.length) { console.warn(`skip ${t.id}/${typeKey}: ${bad.join("; ")}`); continue; }

    let slug = slugify(fill(type.title, t));
    if (takenSlugs.has(slug)) slug = `${slug}-${t.id}`;
    takenSlugs.add(slug);
    const article = { slug, topic: t.id, type: typeKey, published: TODAY, updated: TODAY, model: MODEL, ...a };
    writeFileSync(join(OUT, `${slug}.json`), JSON.stringify(article, null, 2) + "\n");
    existing.push(article);
    wrote++;
    console.log(`wrote ${slug}`);
  } catch (e) {
    console.warn(`skip ${t.id}/${typeKey}: ${e.message}`);
  }
}

// Opus 5.5: $4 / $20 per million tokens (cache reads are cheaper, so this is an upper bound).
const cost = (inTok * 4 + outTok * 20) / 1e6;
console.log(`writer: ${wrote}/${queue.length} written, ~${inTok} in / ${outTok} out tokens, about $${cost.toFixed(2)}`);
if (process.env.GITHUB_STEP_SUMMARY) writeFileSync(process.env.GITHUB_STEP_SUMMARY, `Wrote ${wrote} of ${queue.length} articles, about $${cost.toFixed(2)}\n`, { flag: "a" });
if (!wrote) process.exit(1);
