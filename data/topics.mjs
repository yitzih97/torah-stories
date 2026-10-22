// The topic catalogue, snapshotted from TorahTale's story catalogue (see
// scripts/sync-topics.mjs). One topic = one TorahTale story, so every article can
// point at the exact book a parent can order.

import { readFileSync } from "node:fs";
import { CATEGORIES } from "../site.config.mjs";

const RAW = JSON.parse(readFileSync(new URL("./topics.json", import.meta.url), "utf8"));

// Double parshiyos ("Chukas-Balak") are a calendar arrangement, not a story of
// their own. Writing about them too would only duplicate the single parshiyos.
const isDoubleParsha = (t) => t.category === "torah" && /-/.test(t.label.replace(/^Parshas /, ""));

/** The phrase people actually search for: "Parshas Noach", "Dovid and Golyas", "Chanukah". */
export const searchName = (t) => {
  let n = t.label;
  if (/^(Sefer|Megillas)\s.+\s-\s/.test(n) || /^Tehillim\s-\s/.test(n)) n = n.split(" - ").slice(1).join(" - ");
  n = n.replace(/^(A|An)\s+/, "").replace(/\s&\s/g, " and ").replace(/[’]/g, "'");
  return n;
};

export const TOPICS = RAW.filter((t) => !isDoubleParsha(t) && CATEGORIES[t.category]).map((t) => ({
  ...t,
  name: searchName(t),
  categorySlug: CATEGORIES[t.category].slug,
}));

export const topicById = (id) => TOPICS.find((t) => t.id === id) || null;
