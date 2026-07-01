const test = require("node:test");
const assert = require("node:assert/strict");
const { VoteError, assertNotSelfVote } = require("./voteErrors");

test("assertNotSelfVote rejects matching actor and target", () => {
  assert.throws(
    () => assertNotSelfVote("user_a", "user_a"),
    (error) => {
      assert.ok(error instanceof VoteError);
      assert.equal(error.status, 403);
      return true;
    }
  );
});

test("assertNotSelfVote allows different actor and target", () => {
  assert.doesNotThrow(() => assertNotSelfVote("user_a", "user_b"));
});
