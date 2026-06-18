const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  SEGMENT_BOT_COUNT,
  buildSegmentBotPersonas,
  buildSegmentBotUid,
  segmentKeyHash,
} = require("./segmentBotPersonas");
const { buildSegmentKey } = require("../../lib/segmentKey");

const SAMPLE_METADATA = {
  country: "Türkiye",
  city: "Ankara",
  gender: "Kadın",
  age: 29,
  profession: "Mühendis",
  maritalStatus: "Bekar",
};

describe("segmentBotPersonas", () => {
  it("builds 7 deterministic personas per segment", () => {
    const segmentKey = buildSegmentKey(SAMPLE_METADATA);
    const first = buildSegmentBotPersonas(SAMPLE_METADATA, segmentKey);
    const second = buildSegmentBotPersonas(SAMPLE_METADATA, segmentKey);

    assert.equal(first.length, SEGMENT_BOT_COUNT);
    assert.equal(second.length, SEGMENT_BOT_COUNT);
    assert.equal(first[0].uid, second[0].uid);
    assert.equal(first[6].totalScore, 250);
  });

  it("uses stable bot_seg uid format", () => {
    const segmentKey = buildSegmentKey(SAMPLE_METADATA);
    const hash = segmentKeyHash(segmentKey);
    const uid = buildSegmentBotUid(hash, 0);
    assert.match(uid, /^bot_seg_[a-f0-9]{12}_01$/);
  });
});
