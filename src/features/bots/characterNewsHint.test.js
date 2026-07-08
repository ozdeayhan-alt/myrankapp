const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { extractNewsHint } = require("./characterNewsHint");

describe("extractNewsHint", () => {
  const techPersona = {
    trendKeywords: ["apple", "iphone", "ai"],
  };

  it("matches trend keyword from English headline", () => {
    assert.equal(
      extractNewsHint("Apple unveils new iPhone with AI features", techPersona),
      "Apple"
    );
  });

  it("returns null when no keyword match and no short proper nouns", () => {
    assert.equal(
      extractNewsHint("The foundational elements of architecture", techPersona),
      null
    );
  });
});
