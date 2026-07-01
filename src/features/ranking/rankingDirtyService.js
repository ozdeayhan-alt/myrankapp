const { FieldValue } = require("firebase-admin/firestore");
const { db } = require("../../lib/firestore");

const COLLECTION = "rankingDirty";

async function markRankingDirty(userId) {
  if (!userId || typeof userId !== "string") {
    return;
  }

  await db
    .collection(COLLECTION)
    .doc(userId)
    .set({ updatedAt: FieldValue.serverTimestamp() }, { merge: true });
}

async function getDirtyUserIds() {
  const snap = await db.collection(COLLECTION).select().get();
  return snap.docs.map((doc) => doc.id);
}

async function clearRankingDirty(userIds = null) {
  if (Array.isArray(userIds) && userIds.length > 0) {
    for (let index = 0; index < userIds.length; index += 400) {
      const batch = db.batch();
      const chunk = userIds.slice(index, index + 400);
      for (const userId of chunk) {
        batch.delete(db.collection(COLLECTION).doc(userId));
      }
      await batch.commit();
    }
    return;
  }

  const snap = await db.collection(COLLECTION).select().get();
  if (snap.empty) {
    return;
  }

  for (let index = 0; index < snap.docs.length; index += 400) {
    const batch = db.batch();
    const chunk = snap.docs.slice(index, index + 400);
    for (const doc of chunk) {
      batch.delete(doc.ref);
    }
    await batch.commit();
  }
}

module.exports = {
  markRankingDirty,
  getDirtyUserIds,
  clearRankingDirty,
};
