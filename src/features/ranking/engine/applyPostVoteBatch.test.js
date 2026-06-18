const test = require("node:test");
const assert = require("node:assert/strict");
const { applyVoteDeltaToCounts } = require("./applyPostVoteBatch");

test("applyVoteDeltaToCounts adds positive delta to likeCount", () => {
  const counts = {
    likeCount: 5,
    dislikeCount: 2,
    shareCount: 0,
    saveCount: 0,
    commentCount: 1,
  };
  assert.deepEqual(applyVoteDeltaToCounts(counts, 10), {
    likeCount: 15,
    dislikeCount: 2,
    shareCount: 0,
    saveCount: 0,
    commentCount: 1,
  });
});

test("applyVoteDeltaToCounts adds negative delta to dislikeCount", () => {
  const counts = {
    likeCount: 5,
    dislikeCount: 2,
    shareCount: 0,
    saveCount: 0,
    commentCount: 1,
  };
  assert.deepEqual(applyVoteDeltaToCounts(counts, -3), {
    likeCount: 5,
    dislikeCount: 5,
    shareCount: 0,
    saveCount: 0,
    commentCount: 1,
  });
});
