const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { getCacheKey } = require("../../feed/feedCache");

describe("engagement cache key", () => {
  it("sorts post ids for stable cache keys", () => {
    const keyA = getCacheKey(["engagements", "user1", ["b", "a"].sort().join(",")]);
    const keyB = getCacheKey(["engagements", "user1", ["a", "b"].sort().join(",")]);
    assert.equal(keyA, keyB);
    assert.equal(keyA, "engagements:user1:a,b");
  });
});
