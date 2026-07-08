const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { hashNewsItem, normalizeTitle, titleOverlapRatio } = require("./characterNewsDedupe");
const { rankNewsItems, pickBestNewsItem } = require("./characterNewsRank");
const { CHARACTER_PERSONAS } = require("./characterPersonas");

describe("characterNewsDedupe", () => {
  it("normalizes titles consistently", () => {
    assert.equal(normalizeTitle("  Apple iPhone!  "), "apple iphone");
  });

  it("hashes url and title separately", () => {
    const a = hashNewsItem({ url: "https://example.com/a", title: "A" });
    const b = hashNewsItem({ url: "https://example.com/b", title: "A" });
    assert.notEqual(a, b);
  });

  it("detects high title overlap", () => {
    const ratio = titleOverlapRatio(
      "Apple yeni iPhone modelini tanıttı",
      "Apple yeni iPhone modelini duyurdu"
    );
    assert.ok(ratio > 0.5);
  });
});

describe("characterNewsRank", () => {
  const techPersona = CHARACTER_PERSONAS[0];

  it("prefers items matching trend keywords", () => {
    const items = [
      { title: "Random local news", description: "", feedLabel: "a" },
      {
        title: "Apple announces new iPhone with AI features",
        description: "Samsung also mentioned",
        feedLabel: "b",
      },
    ];
    const best = pickBestNewsItem(items, techPersona);
    assert.match(best.title.toLowerCase(), /apple|iphone|ai/);
  });

  it("sorts by trend score descending", () => {
    const ranked = rankNewsItems(
      [
        { title: "Unrelated", description: "" },
        { title: "Tesla unveils new model", description: "electric car" },
      ],
      techPersona
    );
    assert.ok(ranked[0].trendScore >= ranked[1].trendScore);
  });
});
