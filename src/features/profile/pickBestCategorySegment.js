const {
  GLOBAL_RANKING_SEGMENT,
  METADATA_FIELDS,
  EMPTY_METADATA,
  buildSegmentKey,
} = require("../../lib/segmentKey");

const CATEGORY_PRIORITY = {
  profession: 0,
  city: 1,
  age: 2,
  gender: 3,
  maritalStatus: 4,
  country: 5,
};

function hasMetadataValue(metadata, key) {
  if (key === "age") {
    return metadata.age !== null && Number(metadata.age) > 0;
  }
  const value = metadata[key];
  return typeof value === "string" && value.trim().length > 0;
}

function buildCategorySegmentKey(metadata, field) {
  return buildSegmentKey({ ...EMPTY_METADATA, [field]: metadata[field] });
}

function compareRankings(a, b) {
  if (a.rank !== b.rank) {
    return a.rank - b.rank;
  }
  if (a.isOfficial !== b.isOfficial) {
    return a.isOfficial ? -1 : 1;
  }
  return CATEGORY_PRIORITY[a.key] - CATEGORY_PRIORITY[b.key];
}

async function readCategoryRank(db, userId, metadata, key) {
  const segmentKey = buildCategorySegmentKey(metadata, key);
  const snap = await db
    .collection("rankings")
    .doc(segmentKey)
    .collection("entries")
    .doc(userId)
    .get();

  if (!snap.exists) {
    return null;
  }

  const data = snap.data();
  const rank = typeof data.rank === "number" ? data.rank : null;
  if (rank === null || rank <= 0) {
    return null;
  }

  const segmentTotal =
    typeof data.segmentTotal === "number" ? data.segmentTotal : 0;

  return {
    key,
    rank,
    isOfficial: segmentTotal > 0,
    segmentKey,
  };
}

/**
 * Gauge için en iyi kategori segmenti (global hariç).
 */
async function pickBestCategorySegment(db, userId, metadata) {
  if (!metadata) {
    return GLOBAL_RANKING_SEGMENT;
  }

  const activeKeys = METADATA_FIELDS.filter((key) =>
    hasMetadataValue(metadata, key)
  );

  if (activeKeys.length === 0) {
    return GLOBAL_RANKING_SEGMENT;
  }

  const rankings = (
    await Promise.all(
      activeKeys.map((key) => readCategoryRank(db, userId, metadata, key))
    )
  ).filter(Boolean);

  if (rankings.length === 0) {
    return GLOBAL_RANKING_SEGMENT;
  }

  const official = rankings.filter((item) => item.isOfficial);
  const pool = official.length > 0 ? official : rankings;

  const withRoomAbove = pool.filter((item) => item.rank > 1);
  const candidatePool = withRoomAbove.length > 0 ? withRoomAbove : pool;
  const best = [...candidatePool].sort(compareRankings)[0];

  return best?.segmentKey ?? GLOBAL_RANKING_SEGMENT;
}

module.exports = {
  pickBestCategorySegment,
};
