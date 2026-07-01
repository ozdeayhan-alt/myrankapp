const { db } = require("../../lib/firestore");
const { GLOBAL_RANKING_SEGMENT } = require("../../lib/segmentKey");

const RANKING_LADDER_MAX_RUNGS = 100;

function ladderFetchLimit(myRank, maxRungs = null) {
  const cap =
    maxRungs != null && Number.isFinite(maxRungs) && maxRungs > 0
      ? Math.min(maxRungs, RANKING_LADDER_MAX_RUNGS)
      : RANKING_LADDER_MAX_RUNGS;
  return Math.min(Math.max(0, myRank - 1), cap);
}

function mergeRungsByRank(primary, extra) {
  const byRank = new Map();
  for (const rung of [...primary, ...extra]) {
    byRank.set(rung.rank, rung);
  }
  return [...byRank.values()];
}

function readRung(data) {
  const rank = typeof data.rank === "number" ? data.rank : null;
  const totalScore =
    typeof data.totalScore === "number" ? data.totalScore : null;
  if (rank === null || totalScore === null || rank <= 0) {
    return null;
  }
  return { rank, totalScore };
}

function immediateAheadFromEntry(entryData) {
  const aheadRank =
    typeof entryData.aheadRank === "number" ? entryData.aheadRank : null;
  const aheadTotalScore =
    typeof entryData.aheadTotalScore === "number"
      ? entryData.aheadTotalScore
      : null;
  if (aheadRank === null || aheadTotalScore === null || aheadRank <= 0) {
    return null;
  }
  return { rank: aheadRank, totalScore: aheadTotalScore };
}

function immediateBehindFromEntry(entryData) {
  const behindRank =
    typeof entryData.behindRank === "number" ? entryData.behindRank : null;
  const behindTotalScore =
    typeof entryData.behindTotalScore === "number"
      ? entryData.behindTotalScore
      : null;
  if (
    behindRank === null ||
    behindTotalScore === null ||
    behindRank <= 0
  ) {
    return null;
  }
  return { rank: behindRank, totalScore: behindTotalScore };
}

function buildSnapshotFromEntry(entryData) {
  if (!entryData) {
    return {
      snapshotScore: 0,
      myRank: null,
      aheadRungs: [],
      behindRungs: [],
    };
  }

  const snapshotScore =
    typeof entryData.totalScore === "number" ? entryData.totalScore : 0;
  const myRank = typeof entryData.rank === "number" ? entryData.rank : null;
  const aheadImmediate = immediateAheadFromEntry(entryData);
  const behindImmediate = immediateBehindFromEntry(entryData);

  return {
    snapshotScore,
    myRank,
    aheadRungs: aheadImmediate ? [aheadImmediate] : [],
    behindRungs: behindImmediate ? [behindImmediate] : [],
  };
}

async function readSegmentEntry(segmentKey, userId) {
  const snap = await db
    .collection("rankings")
    .doc(segmentKey)
    .collection("entries")
    .doc(userId)
    .get();
  return snap.exists ? snap.data() : null;
}

function entriesCollection(segmentKey) {
  return db.collection("rankings").doc(segmentKey).collection("entries");
}

async function fetchRungsByRank(segmentKey, myRank, direction, maxRungs = null) {
  const coll = entriesCollection(segmentKey);

  if (direction === "ahead") {
    const fetchLimit = ladderFetchLimit(myRank, maxRungs);
    if (fetchLimit <= 0) {
      return [];
    }
    const snap = await coll
      .where("rank", "<", myRank)
      .orderBy("rank", "desc")
      .limit(fetchLimit)
      .get();
    return snap.docs
      .map((docSnap) => readRung(docSnap.data()))
      .filter(Boolean);
  }

  const fetchLimit = ladderFetchLimit(myRank, maxRungs);
  const snap = await coll
    .where("rank", ">", myRank)
    .orderBy("rank", "asc")
    .limit(fetchLimit)
    .get();
  return snap.docs.map((docSnap) => readRung(docSnap.data())).filter(Boolean);
}

async function fetchRungsByTotalScoreOrder(
  segmentKey,
  myRank,
  direction,
  maxRungs = null
) {
  const coll = entriesCollection(segmentKey);

  if (direction === "ahead") {
    const fetchLimit = ladderFetchLimit(myRank, maxRungs);
    const snap = await coll.orderBy("totalScore", "desc").limit(myRank).get();
    return snap.docs
      .slice(0, Math.max(0, myRank - 1))
      .reverse()
      .map((docSnap) => readRung(docSnap.data()))
      .filter(Boolean)
      .slice(0, fetchLimit);
  }

  const fetchLimit = ladderFetchLimit(myRank, maxRungs);
  const snap = await coll
    .orderBy("totalScore", "desc")
    .limit(myRank + fetchLimit)
    .get();
  return snap.docs
    .slice(myRank)
    .map((docSnap) => readRung(docSnap.data()))
    .filter(Boolean)
    .slice(0, fetchLimit);
}

async function fetchRankingLadderFull(
  userId,
  segmentKey = GLOBAL_RANKING_SEGMENT,
  hintRank = null,
  maxRungs = null
) {
  const entryData = await readSegmentEntry(segmentKey, userId);
  const base = buildSnapshotFromEntry(entryData);

  const officialRank = base.myRank;
  const hint =
    hintRank != null && Number.isFinite(Number(hintRank)) && Number(hintRank) > 0
      ? Number(hintRank)
      : null;

  let ladderRank = officialRank;
  if (hint != null) {
    ladderRank = hint;
  }

  if (!entryData || ladderRank === null) {
    return base;
  }

  const useEntryNeighbors =
    officialRank != null && ladderRank === officialRank;

  let aheadRungs = [];
  let behindRungs = [];

  try {
    [aheadRungs, behindRungs] = await Promise.all([
      ladderRank > 1
        ? fetchRungsByRank(segmentKey, ladderRank, "ahead", maxRungs)
        : [],
      fetchRungsByRank(segmentKey, ladderRank, "behind", maxRungs),
    ]);
  } catch (error) {
    console.warn("[fetchRankingLadderFull] rank query failed:", error.message);
  }

  if (ladderRank > 1 && aheadRungs.length === 0) {
    try {
      aheadRungs = await fetchRungsByTotalScoreOrder(
        segmentKey,
        ladderRank,
        "ahead",
        maxRungs
      );
    } catch (error) {
      console.warn(
        "[fetchRankingLadderFull] ahead score fallback failed:",
        error.message
      );
      aheadRungs = useEntryNeighbors ? base.aheadRungs : [];
    }
  }

  if (behindRungs.length === 0) {
    try {
      behindRungs = await fetchRungsByTotalScoreOrder(
        segmentKey,
        ladderRank,
        "behind",
        maxRungs
      );
    } catch (error) {
      console.warn(
        "[fetchRankingLadderFull] behind score fallback failed:",
        error.message
      );
      behindRungs = useEntryNeighbors ? base.behindRungs : [];
    }
  }

  return {
    snapshotScore: base.snapshotScore,
    myRank: ladderRank,
    aheadRungs: mergeRungsByRank(
      aheadRungs,
      useEntryNeighbors ? base.aheadRungs : []
    ).sort((a, b) => b.rank - a.rank),
    behindRungs: mergeRungsByRank(
      behindRungs,
      useEntryNeighbors ? base.behindRungs : []
    ).sort((a, b) => a.rank - b.rank),
  };
}

module.exports = {
  fetchRankingLadderFull,
  RANKING_LADDER_MAX_RUNGS,
};
