const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  resolveFeedContentType,
  parseFeedContentTypeQuery,
} = require("./feedContentType");

describe("resolveFeedContentType", () => {
  it("uses snapshot type for reposts", () => {
    assert.equal(
      resolveFeedContentType({
        contentType: "repost",
        originalSnapshot: { contentType: "image" },
      }),
      "image"
    );
  });

  it("maps native content types", () => {
    assert.equal(resolveFeedContentType({ contentType: "tweet" }), "tweet");
    assert.equal(resolveFeedContentType({ contentType: "image" }), "image");
    assert.equal(resolveFeedContentType({ contentType: "video" }), "video");
  });
});

describe("parseFeedContentTypeQuery", () => {
  it("defaults to all", () => {
    assert.equal(parseFeedContentTypeQuery(undefined), "all");
    assert.equal(parseFeedContentTypeQuery(""), "all");
    assert.equal(parseFeedContentTypeQuery("all"), "all");
  });

  it("maps whisp and glow", () => {
    assert.equal(parseFeedContentTypeQuery("whisp"), "tweet");
    assert.equal(parseFeedContentTypeQuery("glow"), "image");
  });
});
