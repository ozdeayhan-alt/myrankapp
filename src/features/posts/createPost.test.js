const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  extractHashtags,
  extractMentionTokens,
} = require("./parsePostContent");

describe("parsePostContent", () => {
  it("extracts hashtags and mentions", () => {
    const content = "Merhaba @Ada nasılsın #istanbul";
    assert.deepEqual(extractHashtags(content), ["istanbul"]);
    assert.deepEqual(extractMentionTokens(content), ["Ada"]);
  });
});
