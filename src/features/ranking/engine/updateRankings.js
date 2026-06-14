const { FieldValue } = require("firebase-admin/firestore");
const { db } = require("../../../lib/firestore");
const { getRankingSegmentKeys } = require("../../../lib/segmentKey");

const DEFAULT_DISPLAY_NAME = "İsimsiz Kullanıcı";

/**
 * Denormalize author into rankings/{segmentKey}/entries/{userId} for each segment variant.
 */
function upsertAuthorRankings(transaction, { userId, userData, totalScore }) {
  const metadata = userData?.metadata;
  if (!metadata) return;

  const displayName =
    typeof userData.displayName === "string" && userData.displayName.trim()
      ? userData.displayName.trim()
      : DEFAULT_DISPLAY_NAME;

  const photoURL =
    typeof userData.photoURL === "string" && userData.photoURL.trim()
      ? userData.photoURL.trim()
      : "";

  const segmentKeys = getRankingSegmentKeys(metadata);

  for (const segmentKey of segmentKeys) {
    const entryRef = db
      .collection("rankings")
      .doc(segmentKey)
      .collection("entries")
      .doc(userId);

    transaction.set(
      entryRef,
      {
        userId,
        totalScore,
        displayName,
        photoURL,
        metadata,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }
}

/**
 * Fire-and-forget ranking denorm (outside hot tap transaction).
 */
async function upsertAuthorRankingsAsync({ userId, userData, totalScore }) {
  const metadata = userData?.metadata;
  if (!metadata) return;

  const displayName =
    typeof userData.displayName === "string" && userData.displayName.trim()
      ? userData.displayName.trim()
      : DEFAULT_DISPLAY_NAME;

  const photoURL =
    typeof userData.photoURL === "string" && userData.photoURL.trim()
      ? userData.photoURL.trim()
      : "";

  const segmentKeys = getRankingSegmentKeys(metadata);
  const batch = db.batch();

  for (const segmentKey of segmentKeys) {
    const entryRef = db
      .collection("rankings")
      .doc(segmentKey)
      .collection("entries")
      .doc(userId);

    batch.set(
      entryRef,
      {
        userId,
        totalScore,
        displayName,
        photoURL,
        metadata,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }

  await batch.commit();
}

module.exports = {
  upsertAuthorRankings,
  upsertAuthorRankingsAsync,
  DEFAULT_DISPLAY_NAME,
};
