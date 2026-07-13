const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  shouldAttachCharacterLink,
  buildLinkTitleFromNews,
  resolveCharacterLink,
} = require("./characterLink");
const { CHARACTER_CONTENT_TYPES } = require("./characterContentTypes");

describe("characterLink", () => {
  it("only attaches on news with https url", () => {
    assert.equal(
      shouldAttachCharacterLink({
        contentType: CHARACTER_CONTENT_TYPES.EVERGREEN,
        newsItem: { url: "https://example.com" },
      }),
      false
    );
  });

  it("builds Turkish link title from Turkish headline", () => {
    const title = buildLinkTitleFromNews({
      title: "Galatasaray'da yeni transfer açıklandı",
    });
    assert.equal(title, "Galatasaray'da yeni transfer açıklandı");
  });

  it("resolveCharacterLink returns null when chance disabled", () => {
    const original = process.env.CHARACTER_LINK_CHANCE;
    process.env.CHARACTER_LINK_CHANCE = "0";
    try {
      assert.equal(
        resolveCharacterLink({
          contentType: CHARACTER_CONTENT_TYPES.NEWS,
          newsItem: {
            url: "https://example.com/haber",
            title: "Test haberi",
          },
        }),
        null
      );
    } finally {
      if (original === undefined) {
        delete process.env.CHARACTER_LINK_CHANCE;
      } else {
        process.env.CHARACTER_LINK_CHANCE = original;
      }
    }
  });

  it("resolveCharacterLink returns link when chance forced", () => {
    const original = process.env.CHARACTER_LINK_CHANCE;
    process.env.CHARACTER_LINK_CHANCE = "1";
    try {
      const link = resolveCharacterLink({
        contentType: CHARACTER_CONTENT_TYPES.NEWS,
        newsItem: {
          url: "https://example.com/haber",
          title: "Test haberi açıklandı",
        },
      });
      assert.equal(link?.linkUrl, "https://example.com/haber");
      assert.ok(link?.linkTitle);
    } finally {
      if (original === undefined) {
        delete process.env.CHARACTER_LINK_CHANCE;
      } else {
        process.env.CHARACTER_LINK_CHANCE = original;
      }
    }
  });
});
