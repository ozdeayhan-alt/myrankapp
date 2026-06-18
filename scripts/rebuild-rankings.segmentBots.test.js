const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  GLOBAL_RANKING_SEGMENT,
  buildSegmentKey,
  getRankingSegmentKeys,
} = require("../src/lib/segmentKey");

const SAMPLE_METADATA = {
  country: "Türkiye",
  city: "Ankara",
  gender: "Kadın",
  age: 29,
  profession: "Mühendis",
  maritalStatus: "Bekar",
};

function buildSegmentBuckets(users) {
  const buckets = new Map();

  function addToSegment(segmentKey, entry) {
    if (!buckets.has(segmentKey)) {
      buckets.set(segmentKey, new Map());
    }
    const map = buckets.get(segmentKey);
    const existing = map.get(entry.userId);
    if (!existing || entry.totalScore > existing.totalScore) {
      map.set(entry.userId, entry);
    }
  }

  for (const user of users) {
    const base = {
      userId: user.userId,
      totalScore: user.totalScore,
      displayName: user.displayName,
      photoURL: user.photoURL,
      metadata: user.metadata,
    };

    if (user.isBot && user.botRole === "segment") {
      if (user.metadata) {
        for (const segmentKey of getRankingSegmentKeys(user.metadata)) {
          addToSegment(segmentKey, {
            ...base,
            metadata: user.metadata,
          });
        }
      }
      continue;
    }

    addToSegment(GLOBAL_RANKING_SEGMENT, {
      ...base,
      metadata: user.metadata ?? {},
    });

    if (user.metadata) {
      for (const segmentKey of getRankingSegmentKeys(user.metadata)) {
        addToSegment(segmentKey, {
          ...base,
          metadata: user.metadata,
        });
      }
    }
  }

  return buckets;
}

describe("segment bot ranking buckets", () => {
  it("places segment bots in global and partial segment keys", () => {
    const segmentKey = buildSegmentKey(SAMPLE_METADATA);
    const users = [
      {
        userId: "bot_seg_abc_01",
        totalScore: 100,
        displayName: "Test Bot",
        photoURL: "",
        metadata: SAMPLE_METADATA,
        isBot: true,
        botRole: "segment",
      },
    ];

    const buckets = buildSegmentBuckets(users);
    const expectedKeys = getRankingSegmentKeys(SAMPLE_METADATA);

    assert.ok(buckets.has(GLOBAL_RANKING_SEGMENT));
    for (const key of expectedKeys) {
      assert.ok(buckets.has(key), `missing segment: ${key}`);
      assert.equal(buckets.get(key).get("bot_seg_abc_01").totalScore, 100);
    }
  });
});
