const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { pickRandomPair } = require("./fetchDuelMatch");

function post(id, authorId) {
  return { id, authorId, mediaURL: "https://example.com/glow.jpg" };
}

describe("pickRandomPair", () => {
  it("never pairs two posts from the same author", () => {
    const candidates = [
      post("p1", "user_a"),
      post("p2", "user_a"),
      post("p3", "user_b"),
      post("p4", "user_c"),
    ];

    for (let i = 0; i < 40; i += 1) {
      const pair = pickRandomPair(candidates);
      assert.ok(pair);
      assert.notEqual(pair[0].authorId, pair[1].authorId);
    }
  });

  it("returns null when all posts share one author", () => {
    const candidates = [post("p1", "solo"), post("p2", "solo")];
    assert.equal(pickRandomPair(candidates), null);
  });

  it("respects excludeIds", () => {
    const candidates = [
      post("p1", "user_a"),
      post("p2", "user_b"),
      post("p3", "user_c"),
      post("p4", "user_d"),
    ];
    const pair = pickRandomPair(candidates, new Set(["p1", "p2"]));
    assert.ok(pair);
    assert.ok(!pair.some((entry) => entry.id === "p1" || entry.id === "p2"));
  });
});
