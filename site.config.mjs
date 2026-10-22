// Everything about the site that is a decision rather than code lives here.

export const SITE = {
  name: "Torah Stories",
  domain: "torah-stories.com",
  url: "https://torah-stories.com",
  tagline: "Torah stories, parsha ideas and Yom Tov activities for frum families",
  description:
    "Free Torah stories for kids, parsha summaries, Shabbos table questions, Yom Tov crafts and middos lessons, written for frum families and morahs.",
  language: "en",
  publisher: "Torah Stories, from the makers of TorahTale",
};

// The site exists to send families to TorahTale. Every link carries UTM tags so
// TorahTale's analytics can see exactly which article earned the visit.
export const TORAHTALE = {
  url: "https://torahtale.com",
  storyPath: (id) => `/stories/${id}`,
  orderPath: (id) => `/create?story=${encodeURIComponent(id)}`,
  utm: (content) =>
    `utm_source=torah-stories&utm_medium=referral&utm_campaign=content-site&utm_content=${encodeURIComponent(content)}`,
};

// Ads.
// - ADSENSE_CLIENT is filled once Google approves the site ("ca-pub-..."). Until
//   then every slot shows a TorahTale house ad, so nothing renders empty.
// - HOUSE_SHARE: fraction of slots given to TorahTale's own ads. The slots in
//   each article alternate, so the split is exact, not random.
// - House ads are labelled "From TorahTale" and never use Google's ad styling,
//   "Ads by Google" text or the AdChoices mark. AdSense policy forbids content
//   that imitates its ads; mixing our own ads in beside them is allowed.
export const ADS = {
  ADSENSE_CLIENT: process.env.ADSENSE_CLIENT || "",
  // Ad unit ids from the AdSense dashboard, once created. Empty = auto size unit.
  SLOTS: { inArticle: process.env.ADSENSE_SLOT_IN_ARTICLE || "", sidebar: process.env.ADSENSE_SLOT_SIDEBAR || "" },
  HOUSE_SHARE: 0.5,
  // An ad after every Nth section of the article body.
  EVERY_N_SECTIONS: 2,
  MAX_IN_ARTICLE: 4,
};

// URL segment and display name for each catalogue category.
export const CATEGORIES = {
  torah: { slug: "parsha", name: "The Weekly Parsha", short: "Parsha" },
  holidays: { slug: "yom-tov", name: "Yamim Tovim", short: "Yom Tov" },
  mitzvot: { slug: "mitzvos", name: "Mitzvos", short: "Mitzvos" },
  middos: { slug: "middos", name: "Middos", short: "Middos" },
  tzadikim: { slug: "tzaddikim", name: "Tzaddikim", short: "Tzaddikim" },
  neviim: { slug: "neviim", name: "Neviim", short: "Neviim" },
  ketuvim: { slug: "kesuvim", name: "Kesuvim", short: "Kesuvim" },
  midrash: { slug: "midrash", name: "Midrash Stories", short: "Midrash" },
  life: { slug: "jewish-life", name: "Jewish Life & Simchas", short: "Jewish Life" },
};
