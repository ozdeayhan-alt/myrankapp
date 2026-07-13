const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  extractNewsHint,
  summarizeNewsSeed,
  looksMostlyEnglish,
  looksMostlyTurkish,
  containsEnglishSentence,
} = require("./characterNewsHint");

describe("extractNewsHint", () => {
  const techPersona = {
    trendKeywords: ["apple", "iphone", "ai", "teknoloji"],
  };

  it("matches trend keyword from English headline", () => {
    assert.equal(
      extractNewsHint("Apple unveils new iPhone with AI features", techPersona),
      "Apple"
    );
  });

  it("returns Turkish snippet for Turkish headline", () => {
    assert.equal(
      extractNewsHint("Yeni iPhone fiyatları açıklandı", techPersona),
      "Yeni iPhone fiyatları açıklandı"
    );
  });

  it("returns null when no keyword match and no short proper nouns", () => {
    assert.equal(
      extractNewsHint("The foundational elements of architecture", techPersona),
      null
    );
  });
});

describe("summarizeNewsSeed", () => {
  const techPersona = {
    trendKeywords: ["apple", "iphone", "teknoloji"],
  };

  it("uses Turkish headline when feed is Turkish", () => {
    const lead = summarizeNewsSeed(
      {
        title: "Samsung yeni telefonunu tanıttı: işte özellikler",
        description: "ignored english description should not appear",
      },
      techPersona
    );
    assert.ok(looksMostlyTurkish(lead));
    assert.equal(lead.includes("ignored"), false);
  });

  it("never pastes English description for English headline", () => {
    const lead = summarizeNewsSeed(
      {
        title: "Apple unveils new iPhone with AI features",
        description:
          "The company announced major updates to its smartphone lineup today.",
      },
      techPersona
    );
    assert.ok(looksMostlyTurkish(lead));
    assert.equal(lead.includes("announced"), false);
    assert.equal(lead.includes("Apple"), true);
  });
});

describe("language helpers", () => {
  it("detects English sentences", () => {
    assert.equal(
      looksMostlyEnglish("The US has launched strikes on Iran in response"),
      true
    );
    assert.equal(looksMostlyTurkish("Galatasaray yeni transferi resmen açıkladı"), true);
    assert.equal(
      containsEnglishSentence(
        "Apple gündemde. The US has launched strikes on Iran in response."
      ),
      true
    );
  });
});
