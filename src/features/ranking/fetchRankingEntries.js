const { db } = require("../../lib/firestore");
const {
  hasActiveSegmentFilters,
  buildSingleFieldSegmentKey,
  entryMatchesSegmentFilters,
  isMetadataComplete,
  GLOBAL_RANKING_SEGMENT,
} = require("../../lib/segmentFilters");
const { buildSegmentKey } = require("../../lib/segmentKey");
const { mapRankingEntryDoc } = require("./mapRankingEntry");
const { enrichRankingPhotos } = require("./enrichRankingPhotos");

const DEFAULT_MAX = 500;
const ABSOLUTE_MAX = 500;

async function fetchRankingsFromSegment(segmentKey, max) {
  const snap = await db
    .collection("rankings")
    .doc(segmentKey)
    .collection("entries")
    .orderBy("totalScore", "desc")
    .limit(max)
    .get();

  return snap.docs.map((docSnap, index) => mapRankingEntryDoc(docSnap, index + 1));
}

async function fetchRankingEntries(filters, max = DEFAULT_MAX) {
  const limit = Math.min(Math.max(Number(max) || DEFAULT_MAX, 1), ABSOLUTE_MAX);

  let entries;
  if (!filters || !hasActiveSegmentFilters(filters)) {
    entries = await fetchRankingsFromSegment(GLOBAL_RANKING_SEGMENT, limit);
  } else if (isMetadataComplete(filters)) {
    entries = await fetchRankingsFromSegment(buildSegmentKey(filters), limit);
  } else {
    const singleKey = buildSingleFieldSegmentKey(filters);
    if (singleKey) {
      entries = await fetchRankingsFromSegment(singleKey, limit);
    } else {
      const globalRows = await fetchRankingsFromSegment(
        GLOBAL_RANKING_SEGMENT,
        limit
      );
      entries = globalRows
        .filter((row) => entryMatchesSegmentFilters(row.metadata, filters))
        .slice(0, limit)
        .map((row, index) => ({
          ...row,
          rank: index + 1,
          rankChange: null,
          trendLabel: null,
        }));
    }
  }

  return enrichRankingPhotos(entries);
}

module.exports = {
  fetchRankingEntries,
  DEFAULT_MAX,
  ABSOLUTE_MAX,
};
