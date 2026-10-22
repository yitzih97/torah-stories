# Torah Stories (torah-stories.com)

Free Torah stories, parsha summaries, Shabbos table questions and Yom Tov activities for frum families. Built to rank in search and send readers to [TorahTale](https://torahtale.com).

- `node build.mjs` builds `dist/` (zero dependencies). `npm run serve` previews it on :4321. `npm test` checks the build.
- `content/articles/*.json`: one file per article, written by `scripts/write.mjs` (Claude Opus 5.5).
- `data/topics.json`: TorahTale's story catalogue snapshot. Refresh with `node scripts/sync-topics.mjs ../torahtale-review`. Also re-copy `data/lessons.json` from the TorahTale blog so the writer learns the same corrections.
- `data/article-types.mjs`: the angles each topic is written from (about 1,900 articles in total).
- Ads (`site.config.mjs`): until the `ADSENSE_CLIENT` repo variable is set, every slot is a TorahTale house ad. After that, slots alternate exactly 50/50. House ads are labelled "From TorahTale" and never use Google's ad look.
- Every article ends with a TorahTale box linking to that story's book. Every link to TorahTale carries `utm_source=torah-stories`.

Workflows: `write.yml` (Sun to Thu, 6am New York, `ARTICLES_PER_DAY` variable, needs the `ANTHROPIC_API_KEY` secret) and `deploy.yml` (push, daily, manual).
