const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { normalizeWhispLinkFields } = require("./normalizeWhispLink");
const { PostError } = require("./postErrors");

describe("normalizeWhispLinkFields", () => {
  it("accepts https link on tweet", () => {
    const fields = normalizeWhispLinkFields("tweet", {
      linkUrl: "https://example.com/haber",
      linkTitle: "Örnek haber",
    });
    assert.equal(fields.linkUrl, "https://example.com/haber");
    assert.equal(fields.linkTitle, "Örnek haber");
  });

  it("accepts bare domain without scheme", () => {
    const fields = normalizeWhispLinkFields("tweet", {
      linkUrl: "example.com/haber",
    });
    assert.equal(fields.linkUrl, "https://example.com/haber");
  });

  it("rejects http link", () => {
    assert.throws(
      () =>
        normalizeWhispLinkFields("tweet", {
          linkUrl: "http://example.com/haber",
        }),
      PostError
    );
  });

  it("rejects host without a dot", () => {
    assert.throws(
      () =>
        normalizeWhispLinkFields("tweet", {
          linkUrl: "localhost",
        }),
      PostError
    );
  });

  it("rejects link on image posts", () => {
    assert.throws(
      () =>
        normalizeWhispLinkFields("image", {
          linkUrl: "https://example.com/haber",
        }),
      PostError
    );
  });

  it("returns empty when link omitted", () => {
    assert.deepEqual(normalizeWhispLinkFields("tweet", {}), {});
  });
});
