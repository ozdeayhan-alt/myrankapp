const { FieldValue } = require("firebase-admin/firestore");
const { db } = require("../../lib/firestore");
const {
  getRankingSegmentKeys,
  isMetadataComplete,
} = require("../../lib/segmentKey");
const { DEFAULT_DISPLAY_NAME } = require("../ranking/engine/updateRankings");

async function resolveAheadFields(coll, rank) {
  if (rank <= 1) {
    return { aheadRank: null, aheadTotalScore: null };
  }

  const snap = await coll.orderBy("totalScore", "desc").limit(rank).get();
  const aheadDoc = snap.docs[rank - 2];
  if (!aheadDoc) {
    return { aheadRank: null, aheadTotalScore: null };
  }

  const aheadData = aheadDoc.data();
  const aheadTotalScore =
    typeof aheadData.totalScore === "number" ? aheadData.totalScore : null;

  if (aheadTotalScore === null) {
    return { aheadRank: null, aheadTotalScore: null };
  }

  return { aheadRank: rank - 1, aheadTotalScore };
}

async function resolveBehindFields(coll, rank, segmentTotal) {
  if (rank >= segmentTotal) {
    return { behindRank: null, behindTotalScore: null };
  }

  const snap = await coll.orderBy("totalScore", "desc").limit(rank + 1).get();
  const behindDoc = snap.docs[rank];
  if (!behindDoc) {
    return { behindRank: null, behindTotalScore: null };
  }

  const behindData = behindDoc.data();
  const behindTotalScore =
    typeof behindData.totalScore === "number" ? behindData.totalScore : null;

  if (behindTotalScore === null) {
    return { behindRank: null, behindTotalScore: null };
  }

  return { behindRank: rank + 1, behindTotalScore };
}

/**
 * Kayıt / profil tamamlama sonrası kullanıcıyı ilgili segment sıralama listelerine ekler.
 * Yeni kullanıcı listenin sonuna (en düşük TP) yerleştirilir.
 */
async function ensureUserRankingEntries(userId) {
  const userSnap = await db.collection("users").doc(userId).get();
  if (!userSnap.exists) {
    throw new Error("User not found");
  }

  const userData = userSnap.data();
  const metadata = userData.metadata;

  if (!isMetadataComplete(metadata)) {
    return { ensured: false, reason: "metadata_incomplete", segments: [] };
  }

  const totalScore =
    typeof userData.totalScore === "number" ? userData.totalScore : 0;
  const displayName =
    typeof userData.displayName === "string" && userData.displayName.trim()
      ? userData.displayName.trim()
      : DEFAULT_DISPLAY_NAME;

  const segmentKeys = getRankingSegmentKeys(metadata);
  const segments = [];

  for (const segmentKey of segmentKeys) {
    const coll = db.collection("rankings").doc(segmentKey).collection("entries");
    const entryRef = coll.doc(userId);
    const entrySnap = await entryRef.get();

    if (entrySnap.exists) {
      const existing = entrySnap.data();
      let rank =
        typeof existing.rank === "number" ? existing.rank : null;
      let segmentTotal =
        typeof existing.segmentTotal === "number" ? existing.segmentTotal : null;

      if (rank === null || segmentTotal === null) {
        const totalSnap = await coll.count().get();
        segmentTotal = totalSnap.data().count;
        const higherSnap = await coll
          .where("totalScore", ">", totalScore)
          .count()
          .get();
        rank = higherSnap.data().count + 1;
      }

      const existingAheadRank =
        typeof existing.aheadRank === "number" ? existing.aheadRank : null;
      const existingAheadTotalScore =
        typeof existing.aheadTotalScore === "number"
          ? existing.aheadTotalScore
          : null;
      const existingBehindRank =
        typeof existing.behindRank === "number" ? existing.behindRank : null;
      const existingBehindTotalScore =
        typeof existing.behindTotalScore === "number"
          ? existing.behindTotalScore
          : null;

      // totalScore yalnızca gece rebuild ile güncellenir; canlı TP yazılmaz.
      await entryRef.set(
        {
          userId,
          displayName,
          metadata,
          rank,
          segmentTotal,
          aheadRank: existingAheadRank,
          aheadTotalScore: existingAheadTotalScore,
          behindRank: existingBehindRank,
          behindTotalScore: existingBehindTotalScore,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      segments.push({
        segmentKey,
        rank,
        segmentTotal,
        created: false,
      });
      continue;
    }

    const countSnap = await coll.count().get();
    const existingCount = countSnap.data().count;
    const segmentTotal = existingCount + 1;
    const rank = segmentTotal;
    const ahead = await resolveAheadFields(coll, rank);
    const behind = await resolveBehindFields(coll, rank, segmentTotal);

    await entryRef.set({
      userId,
      totalScore,
      displayName,
      metadata,
      rank,
      segmentTotal,
      aheadRank: ahead.aheadRank,
      aheadTotalScore: ahead.aheadTotalScore,
      behindRank: behind.behindRank,
      behindTotalScore: behind.behindTotalScore,
      updatedAt: FieldValue.serverTimestamp(),
    });

    segments.push({
      segmentKey,
      rank,
      segmentTotal,
      created: true,
    });
  }

  return { ensured: true, segments };
}

module.exports = { ensureUserRankingEntries };
