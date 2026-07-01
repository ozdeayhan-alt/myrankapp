const { FieldValue } = require("firebase-admin/firestore");
const { db } = require("../../../lib/firestore");

const READ_PAGE = 500;
const WRITE_BATCH = 400;

function computeTrendLabel(rankChange) {
  if (rankChange == null) return null;
  if (rankChange >= 20) return "rising";
  if (rankChange <= -20) return "falling";
  return "stable";
}

function computeMomentum(existingData, currentRank, currentTotalScore) {
  const previousRank =
    typeof existingData?.rank === "number" ? existingData.rank : null;
  const previousTotalScore =
    typeof existingData?.totalScore === "number"
      ? existingData.totalScore
      : null;

  const rankChange =
    previousRank != null ? previousRank - currentRank : null;
  const tpChange =
    previousTotalScore != null
      ? currentTotalScore - previousTotalScore
      : null;

  return {
    previousRank,
    rankChange,
    previousTotalScore,
    tpChange,
    trendLabel: computeTrendLabel(rankChange),
  };
}

async function listSegmentKeys() {
  const refs = await db.collection("rankings").listDocuments();
  return refs.map((ref) => ref.id);
}

async function fetchSegmentEntriesOrdered(segmentKey) {
  const coll = db.collection("rankings").doc(segmentKey).collection("entries");
  const entries = [];
  let lastDoc = null;

  while (true) {
    let query = coll.orderBy("totalScore", "desc").limit(READ_PAGE);
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }

    const snap = await query.get();
    if (snap.empty) {
      break;
    }

    for (const doc of snap.docs) {
      entries.push({
        userId: doc.id,
        ...doc.data(),
      });
    }

    lastDoc = snap.docs[snap.docs.length - 1];
    if (snap.size < READ_PAGE) {
      break;
    }
  }

  return entries;
}

async function writeRankedSegmentEntries(segmentKey, sortedEntries) {
  const segmentTotal = sortedEntries.length;
  if (segmentTotal === 0) {
    return 0;
  }

  let written = 0;

  for (let index = 0; index < sortedEntries.length; index += WRITE_BATCH) {
    const chunk = sortedEntries.slice(index, index + WRITE_BATCH);
    const entryRefs = chunk.map((entry) =>
      db
        .collection("rankings")
        .doc(segmentKey)
        .collection("entries")
        .doc(entry.userId)
    );
    const existingSnaps = await db.getAll(...entryRefs);
    const existingByUserId = new Map();
    for (const snap of existingSnaps) {
      if (snap.exists) {
        existingByUserId.set(snap.id, snap.data());
      }
    }

    const batch = db.batch();

    chunk.forEach((entry, chunkIndex) => {
      const globalIndex = index + chunkIndex;
      const currentRank = globalIndex + 1;
      const aheadEntry = globalIndex > 0 ? sortedEntries[globalIndex - 1] : null;
      const behindEntry =
        globalIndex < sortedEntries.length - 1
          ? sortedEntries[globalIndex + 1]
          : null;
      const existing = existingByUserId.get(entry.userId);
      const momentum = computeMomentum(
        existing,
        currentRank,
        entry.totalScore ?? 0
      );

      batch.set(
        entryRefs[chunkIndex],
        {
          userId: entry.userId,
          totalScore:
            typeof entry.totalScore === "number" ? entry.totalScore : 0,
          displayName: entry.displayName ?? "İsimsiz Kullanıcı",
          photoURL: entry.photoURL ?? "",
          metadata: entry.metadata ?? {},
          rank: currentRank,
          segmentTotal,
          aheadRank: aheadEntry ? currentRank - 1 : null,
          aheadTotalScore: aheadEntry ? aheadEntry.totalScore ?? 0 : null,
          behindRank: behindEntry ? currentRank + 1 : null,
          behindTotalScore: behindEntry ? behindEntry.totalScore ?? 0 : null,
          ...momentum,
          momentumUpdatedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    });

    await batch.commit();
    written += chunk.length;
  }

  return written;
}

async function recalculateSegmentRanks(segmentKey) {
  const entries = await fetchSegmentEntriesOrdered(segmentKey);
  const sorted = [...entries].sort(
    (a, b) => (b.totalScore ?? 0) - (a.totalScore ?? 0)
  );
  return writeRankedSegmentEntries(segmentKey, sorted);
}

async function recalculateAllSegmentRanks() {
  const segmentKeys = await listSegmentKeys();
  let totalEntries = 0;
  const perSegment = {};

  for (const segmentKey of segmentKeys) {
    const count = await recalculateSegmentRanks(segmentKey);
    perSegment[segmentKey] = count;
    totalEntries += count;
  }

  return { segmentKeys, perSegment, totalEntries };
}

module.exports = {
  computeTrendLabel,
  computeMomentum,
  listSegmentKeys,
  fetchSegmentEntriesOrdered,
  recalculateSegmentRanks,
  recalculateAllSegmentRanks,
  writeRankedSegmentEntries,
};
