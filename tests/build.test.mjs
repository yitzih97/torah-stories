import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

process.env.ADSENSE_CLIENT = "ca-pub-0000000000000000";
const { build, sanitize } = await import("../build.mjs");
await build();
const DIST = new URL("../dist/", import.meta.url).pathname;
const ARTICLES = new URL("../content/articles/", import.meta.url).pathname;
const articles = readdirSync(ARTICLES).map((f) => JSON.parse(readFileSync(join(ARTICLES, f), "utf8")));
const page = (slug) => readFileSync(join(DIST, slug, "index.html"), "utf8");

test("sanitize keeps prose and drops scripts, links and attributes", () => {
  assert.equal(sanitize('<p class="x" onclick="y">Hi <a href="//evil">there</a></p><script>alert(1)</script>'), "<p>Hi there</p>");
  assert.equal(sanitize('<ol start="6" style="x"><li>a</li></ol>'), '<ol start="6"><li>a</li></ol>');
});

test("house ads take exactly half of the ad slots once AdSense is on", () => {
  let house = 0, google = 0;
  for (const a of articles) {
    const html = page(a.slug);
    house += (html.match(/class="promo"/g) || []).length;
    google += (html.match(/class="adsbygoogle"/g) || []).length;
  }
  assert.ok(house + google > 0);
  assert.ok(Math.abs(house - google) <= articles.length, `house ${house} vs google ${google}`);
  assert.ok(house >= google, "TorahTale gets at least half");
});

test("house ads never imitate Google ads", () => {
  for (const a of articles) {
    const houses = page(a.slug).match(/<aside class="promo"[\s\S]*?<\/aside>/g) || [];
    for (const h of houses) assert.doesNotMatch(h, /Ads by Google|AdChoices|adsbygoogle/i);
  }
});

test("every article ends with a TorahTale call to action carrying UTM tags", () => {
  for (const a of articles) {
    const html = page(a.slug);
    assert.match(html, /class="feature"/);
    assert.match(html, /https:\/\/torahtale\.com\/[^"]*utm_source=torah-stories/);
  }
});

test("article content has no long dashes and no Magen David", () => {
  for (const a of articles) {
    const s = JSON.stringify(a);
    assert.doesNotMatch(s, /[–—]/, a.slug);
    assert.doesNotMatch(s, /star of david|magen david/i, a.slug);
  }
});

test("ads.txt, sitemap and privacy policy exist", () => {
  assert.match(readFileSync(join(DIST, "ads.txt"), "utf8"), /pub-0000000000000000, DIRECT/);
  const sm = readFileSync(join(DIST, "sitemap.xml"), "utf8");
  for (const a of articles) assert.ok(sm.includes(`/${a.slug}/`));
  assert.match(readFileSync(join(DIST, "privacy/index.html"), "utf8"), /Google AdSense/);
});
