const test = require("node:test");
const assert = require("node:assert/strict");
const { clampDuelDelta } = require("./clampDuelDelta");
const { MAX_DUEL_DELTA_PER_MATCH } = require("./constants");

test("clampDuelDelta returns zero for invalid values", () => {
  assert.equal(clampDuelDelta(0), 0);
  assert.equal(clampDuelDelta(NaN), 0);
  assert.equal(clampDuelDelta(undefined), 0);
});

test("clampDuelDelta passes through values within limit", () => {
  assert.equal(clampDuelDelta(10), 10);
  assert.equal(clampDuelDelta(-15), -15);
});

test("clampDuelDelta clamps values above limit", () => {
  assert.equal(clampDuelDelta(MAX_DUEL_DELTA_PER_MATCH + 50), MAX_DUEL_DELTA_PER_MATCH);
  assert.equal(clampDuelDelta(-(MAX_DUEL_DELTA_PER_MATCH + 50)), -MAX_DUEL_DELTA_PER_MATCH);
});
