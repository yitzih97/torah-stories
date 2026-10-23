# Torah Stories (torah-stories.com)

Free Torah stories, parsha summaries, Shabbos table questions and Yom Tov activities for frum families. Built to rank in search and send readers to [TorahTale](https://torahtale.com), but with its own brand: Instrument Serif and Geist type, a paper, ink and terracotta palette, and Unsplash photography. Nothing visual is shared with TorahTale.

- `node build.mjs` builds `dist/` (zero dependencies). `npm run serve` previews it on :4321. `npm test` checks the build.
- `content/articles/*.json`: one file per article, written by `scripts/write.mjs` (Claude Opus 5.5).
- `data/topics.json`: TorahTale's story catalogue snapshot. Refresh with `node scripts/sync-topics.mjs ../torahtale-review`. Also re-copy `data/lessons.json` from the TorahTale blog so the writer learns the same corrections.
- `data/photos.tsv` + `data/photos.mjs`: the vetted Unsplash photos (no Magen David, nothing from another religion, modest people only) and which topic uses which. Files are in `assets/img/<key>-{800,1600}.webp`. Add a photo: append a row to the TSV, download it to both sizes, check it by eye.
- `data/article-types.mjs`: the angles each topic is written from (about 1,900 articles in total).
- Ads (`site.config.mjs`): until the `ADSENSE_CLIENT` repo variable is set, every slot is a TorahTale ad. After that, slots alternate 50/50. TorahTale ads are labelled "Sponsored · TorahTale" and never use Google's ad look.
- Every article ends with a TorahTale box linking to that story's book; every TorahTale link carries `utm_source=torah-stories`.
- `EAGER_IMAGES=1 node build.mjs` turns off lazy loading, for full-page screenshots.

Workflows: `write.yml` (Sun to Thu, 6am New York, `ARTICLES_PER_DAY` variable, needs the `ANTHROPIC_API_KEY` secret) and `deploy.yml` (push, daily, manual).
