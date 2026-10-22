// Re-snapshot the topic list and covers from a local TorahTale checkout, so new
// TorahTale stories become new topics here.
//
//   node scripts/sync-topics.mjs ../torahtale-review

import { copyFileSync, existsSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const TT = resolve(process.argv[2] || "../torahtale-review");
const imp = (p) => import(pathToFileURL(join(TT, p)).href);

const { TORAH_PORTIONS_DATA } = await imp("src/components/wizard/torahData.mjs");
const { STORY_SUMMARIES } = await imp("src/data/storySummaries.mjs");
const { STORY_PAGES } = await imp("src/data/storyPages.mjs");
const pages = new Set(STORY_PAGES.map((p) => p.slug));
const ROOT = new URL("..", import.meta.url).pathname;

const out = TORAH_PORTIONS_DATA.filter((t) => STORY_SUMMARIES[t.value]).map((t) => {
  const src = join(TT, "public/blog/story-covers", `${t.value}.webp`);
  const cover = existsSync(src) ? `${t.value}.webp` : null;
  if (cover) copyFileSync(src, join(ROOT, "assets/covers", cover));
  return {
    id: t.value, label: t.label, he: t.sub, category: t.category, book: t.book || null,
    summary: STORY_SUMMARIES[t.value], hasTorahTalePage: pages.has(t.value), cover,
  };
});

writeFileSync(join(ROOT, "data/topics.json"), JSON.stringify(out, null, 1));
console.log(`${out.length} topics`);
