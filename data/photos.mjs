// The site's photography: free Unsplash photos, each one checked by eye before
// it went in (no Magen David, nothing from another religion, modest people only).
// Files live in assets/img/<key>-1600.webp and <key>-800.webp.
//
// Every topic gets a short list of photos that fit its story. The articles on a
// topic take turns through the list, so a topic's pages don't all look alike.

import { readFileSync } from "node:fs";

export const PHOTOS = Object.fromEntries(
  readFileSync(new URL("./photos.tsv", import.meta.url), "utf8")
    .trim()
    .split("\n")
    .map((l) => l.split("\t"))
    .map(([key, id, alt]) => [key, { key, id, alt }]),
);

// Specific topics. Keys are topic ids from topics.json.
const BY_TOPIC = {
  // Bereishis
  bereishit: ["milky-way", "meadow-stream", "sunrise-sea"],
  noach: ["rainbow-field", "rainbow-sea", "rough-sea", "doves"],
  "lech-lecha": ["camels-walk", "milky-way", "caravan", "white-sands"],
  vayera: ["tents", "camp-dusk", "dune-sunrise"],
  "chayei-sarah": ["camels-rest", "caravan", "olive-tree"],
  toldot: ["wheat-field", "sheep-water", "desert-mountains"],
  vayetzei: ["stars-deep", "sheep-hill", "stars"],
  vayishlach: ["mountain-sunset", "sheep", "desert-mountains"],
  vayeshev: ["wheat-close", "stars", "sheep-hill"],
  miketz: ["wheat-field", "wheat-haze", "deep-sea"],
  vayigash: ["wheat-haze", "camels-walk", "tents"],
  vayechi: ["olive-tree", "sunrise-hills", "lion-face"],
  // Shemos
  shemot: ["meadow-stream", "fire", "sheep-hill"],
  vaera: ["deep-sea", "embers", "red-rocks"],
  bo: ["moon", "candle-one", "stars-deep"],
  beshalach: ["rough-sea", "wave", "dune-ripples"],
  yitro: ["desert-mountains", "mountain-sunset", "scroll"],
  mishpatim: ["scroll", "parchment", "sheep"],
  terumah: ["candles-silver", "olive-branch", "arches"],
  tetzaveh: ["olives", "candles-three", "pomegranates"],
  "ki-tisa": ["desert-mountains", "fire", "parchment"],
  vayakhel: ["clay-pot", "candles-silver", "tents"],
  pekudei: ["candles-silver", "arches", "camp-dusk"],
  // Vayikra
  vayikra: ["sheep", "fire", "doves"],
  tzav: ["embers", "fire", "candles-three"],
  shemini: ["doves", "embers", "sheep-water"],
  tazria: ["doves", "dove-sky", "door-light"],
  metzora: ["dove-sky", "doves", "door"],
  "acharei-mot": ["dunes", "candle-one", "white-sands"],
  kedoshim: ["wheat-field", "olive-tree", "coins"],
  emor: ["wheat-close", "moon", "esrog"],
  behar: ["olive-tree", "wheat-haze", "sheep-hill"],
  bechukotai: ["rainbow-mountains", "wheat-field", "pomegranate-tree"],
  // Bamidbar
  bamidbar: ["dunes", "tents", "camp-dusk"],
  naso: ["candles-three", "scroll", "sunrise-hills"],
  behaalotecha: ["candles-three", "dune-sunrise", "camp-dusk"],
  shelach: ["pomegranate-tree", "pomegranates", "red-rocks"],
  korach: ["red-rocks", "embers", "dunes"],
  chukat: ["deep-sea", "dune-ripples", "red-rocks"],
  balak: ["mountain-sunset", "tents", "red-rocks"],
  pinchas: ["tents", "sunrise-hills", "scroll"],
  matot: ["sheep-hill", "sheep-water", "wheat-haze"],
  masei: ["caravan", "camels-walk", "dunes"],
  // Devarim
  devarim: ["mountain-sunset", "desert-mountains", "parchment"],
  vaetchanan: ["scroll", "mountain-sunset", "door"],
  eikev: ["pomegranates", "wheat-field", "olives", "honey"],
  reeh: ["wheat-haze", "coins", "olive-tree"],
  shoftim: ["arches", "olive-tree", "scroll"],
  "ki-teitzei": ["nest", "wheat-close", "door"],
  "ki-tavo": ["pomegranate-tree", "wheat-field", "scroll"],
  nitzavim: ["sunrise-hills", "scroll", "honey"],
  vayelech: ["scroll", "parchment", "sunrise-sea"],
  haazinu: ["rainbow-mountains", "stars", "deep-sea"],
  "vezot-haberacha": ["scroll", "desert-mountains", "seforim"],

  // Yamim Tovim
  shabbos: ["challah-seeds", "candles-silver", "challah-rack"],
  pesach: ["moon", "candles-three", "rough-sea"],
  purim: ["hamantaschen", "hamantaschen-pile", "book-dark"],
  chanukah: ["menorah-glow", "menorah-donuts", "gelt", "olives"],
  sukkot: ["esrog", "lanterns", "stars"],
  shavuot: ["wheat-close", "desert-mountains", "scroll"],
  "rosh-hashana": ["honey", "pomegranates", "pomegranate-seeds"],
  "yom-kippur": ["candle-one", "sunrise-sea", "dove-sky"],
  "simchat-torah": ["scroll", "seforim", "lanterns"],
  "tu-bishvat": ["olive-tree", "pomegranate-tree", "olive-branch"],
  "lag-baomer": ["fire", "embers", "milky-way"],
  "tisha-bav": ["ancient-stones", "kosel", "candle-one"],
  "rosh-chodesh": ["moon", "moon-sea"],
  "kiddush-levana": ["moon", "moon-sea", "stars"],
  "tu-bav": ["olive-branch", "meadow-stream"],
  "sefiras-haomer": ["wheat-haze", "stars"],
  "three-weeks": ["ancient-stones", "kosel"],
  "nine-days": ["ancient-stones", "candle-one"],
  "tu-bishvat-seder": ["pomegranates", "olives", "olive-tree"],
  "elul-selichos": ["sunrise-hills", "candle-one"],
  "aseres-yemei-teshuvah": ["sunrise-sea", "candle-one"],
  "shemini-atzeres": ["scroll", "rainbow-mountains"],
  "hoshana-rabbah": ["esrog", "olive-branch"],
  "chol-hamoed": ["lanterns", "meadow-stream"],
  "shabbos-mevorchim": ["moon", "challah-board"],
  "shmita-year": ["olive-tree", "wheat-haze"],
  hakhel: ["scroll", "ancient-stones"],

  // Jewish life
  "bris-milah": ["nest", "candles-silver"],
  "first-day-cheder": ["book-open", "seforim"],
  "bar-mitzvah": ["scroll", "seforim"],
  "bas-mitzvah": ["candles-silver", "book-fan"],
  siyum: ["seforim", "library"],
  chasunah: ["lanterns", "candles-three"],
  "sheva-brachos": ["lanterns", "challah-sliced"],
  "chanukas-habayis": ["door", "door-light"],
  "hachnasas-sefer-torah": ["scroll", "parchment"],
  "melava-malka": ["candle-one", "stars"],
  "seudas-hodaah": ["challah-board", "lanterns"],

  // Mitzvos and middos
  "mitzvah-mezuzah": ["door", "door-light"],
  "mitzvah-shiluach-haken": ["nest", "nest-tree"],
  "mitzvah-tzaar-baalei-chaim": ["sheep", "sheep-hill"],
  "mitzvah-hachnasas-orchim": ["tents", "door", "challah-board"],
  "mitzvah-brachos": ["challah-sliced", "pomegranates"],
  "mitzvah-bentching": ["challah-board", "challah-sliced"],
  "mitzvah-netilas-yadayim": ["meadow-stream", "challah-seeds"],
  "mitzvah-davening": ["sunrise-hills", "kosel"],
  "mitzvah-modeh-ani": ["sunrise-sea", "sunrise-hills"],
  "mitzvah-shema": ["stars", "milky-way"],
  "mitzvah-talmud-torah": ["seforim", "book-open"],
  "mitzvah-kavod-sefarim": ["seforim", "library"],
  "mitzvah-brachos-nissim": ["rainbow-field", "rainbow-mountains"],
  "mitzvah-bitachon": ["milky-way", "small-boat"],
  "mitzvah-yiras-shamayim": ["stars-deep", "sunrise-sea"],
  "mitzvah-hashavas-aveidah": ["coin-jar", "door-light"],
  "mitzvah-lo-lignov": ["coin-jar", "coins"],
  "mitzvah-lashon-hara": ["doves", "dove-sky"],
  "edu-tzedakah": ["coins", "coin-jar"],
  "edu-shalom": ["doves", "olive-branch"],
  "edu-savlanus": ["olive-tree", "wheat-haze"],

  // Neviim and Kesuvim
  "yehoshua-jordan": ["meadow-stream", "sunrise-hills"],
  "yehoshua-jericho": ["ancient-stones", "arches"],
  "yehoshua-sun": ["sunrise-hills", "mountain-sunset"],
  devorah: ["olive-tree", "mountain-sunset"],
  shimshon: ["lion", "lion-face"],
  gidon: ["fire", "wheat-haze"],
  "david-goliath": ["sheep-hill", "desert-mountains"],
  "david-yonatan": ["olive-branch", "sunrise-hills"],
  "shlomo-wisdom": ["library", "seforim"],
  "eliyahu-carmel": ["fire", "embers"],
  "eliyahu-chariot": ["fire", "milky-way"],
  "elisha-miracles": ["olives", "meadow-stream"],
  "yeshayahu-peace": ["sheep", "lion"],
  "yeshayahu-coal": ["embers", "fire"],
  "yirmiyahu-potter": ["pottery", "clay-pot"],
  "yirmiyahu-pit": ["ancient-stones", "candle-one"],
  "yechezkel-bones": ["dunes", "white-sands"],
  "zechariah-menorah": ["olives", "candles-three"],
  yonah: ["rough-sea", "boat", "wave"],
  "amos-shepherd": ["sheep-hill", "olive-tree"],
  "tehillim-shepherd": ["sheep-water", "meadow-stream"],
  "tehillim-creation": ["milky-way", "rainbow-mountains"],
  "mishlei-ant": ["wheat-close", "nest"],
  iyov: ["rough-sea", "candle-one"],
  "iyov-storm": ["wave", "rough-sea"],
  "daniel-lions": ["lion", "lion-face"],
  "daniel-furnace": ["fire", "embers"],
  "daniel-writing": ["candles-three", "arches"],
  "ezra-return": ["caravan", "ancient-stones"],
  "ezra-mikdash": ["ancient-stones", "arches"],
  "ezra-torah": ["scroll", "parchment"],
  "nechemia-walls": ["ancient-stones", "kosel"],
  "nechemia-guard": ["moon", "ancient-stones"],
  esther: ["hamantaschen", "book-dark"],
  ruth: ["wheat-field", "wheat-close", "wheat-haze"],
  eicha: ["ancient-stones", "candle-one"],
  kohelet: ["sunrise-sea", "wheat-haze"],

  // Midrash
  "midrash-avraham-idols": ["clay-pot", "pottery"],
  "midrash-yaakov-stones": ["stars-deep", "desert-mountains"],
  "midrash-moshe-coal": ["embers", "fire"],
  "midrash-moshe-kid": ["sheep", "meadow-stream"],
  "midrash-aron-yosef": ["meadow-stream", "deep-sea"],
  "midrash-nachshon": ["rough-sea", "wave"],
  "midrash-miriam-well": ["meadow-stream", "dunes"],
  "midrash-sinai-mountains": ["desert-mountains", "mountain-sunset"],
  "midrash-silent-world": ["stars", "white-sands"],
  "midrash-shlomo-shamir": ["arches", "ancient-stones"],
  "midrash-hillel-roof": ["moon", "seforim"],
  "midrash-choni-carob": ["olive-tree", "sunrise-hills"],
  "midrash-chanina-stone": ["ancient-stones", "kosel"],
  "midrash-kosel": ["kosel", "ancient-stones"],
};

// Everything else falls back to its collection's pool.
const BY_CATEGORY = {
  torah: ["scroll", "parchment", "desert-mountains", "dunes"],
  holidays: ["candles-silver", "challah-seeds", "lanterns", "candles-three"],
  mitzvot: ["book-open", "candles-silver", "door", "sunrise-hills"],
  middos: ["olive-branch", "doves", "meadow-stream", "sunrise-hills"],
  tzadikim: ["seforim", "library", "book-dark", "parchment", "candle-one", "sefer"],
  neviim: ["ancient-stones", "desert-mountains", "scroll", "olive-tree"],
  ketuvim: ["book-dark", "parchment", "seforim", "olive-tree"],
  midrash: ["stars", "book-fan", "ancient-stones"],
  life: ["lanterns", "candles-silver", "door-light", "challah-board"],
};

const hash = (s) => [...s].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);

/** The photos that fit a topic, best first. */
export const photosFor = (topic) => {
  const list = (BY_TOPIC[topic.id] || []).filter((k) => PHOTOS[k]);
  if (list.length) return list;
  const pool = BY_CATEGORY[topic.category] || BY_CATEGORY.torah;
  const start = hash(topic.id) % pool.length;
  return [...pool.slice(start), ...pool.slice(0, start)];
};

/** The topic's main photo. */
export const topicPhoto = (topic) => PHOTOS[photosFor(topic)[0]];

/** A photo for one article: the topic's list, taken in turn by article type. */
export const articlePhoto = (topic, typeIndex = 0) => {
  const list = photosFor(topic);
  return PHOTOS[list[typeIndex % list.length]];
};
