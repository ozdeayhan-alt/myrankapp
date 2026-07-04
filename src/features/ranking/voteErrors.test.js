const test = require("node:test");
const assert = require("node:assert/strict");
const { VoteError, mapVoteError } = require("./voteErrors");

test("VoteError carries status", () => {
  const error = new VoteError(400, "bad vote");
  assert.equal(error.status, 400);
  assert.equal(error.message, "bad vote");
});

test("mapVoteError maps VoteError to JSON response", () => {
  const error = new VoteError(403, "forbidden");
  const res = {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    body: null,
    json(payload) {
      this.body = payload;
      return this;
    },
  };

  mapVoteError(error, res, "fallback");

  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.body, { error: "forbidden" });
});
