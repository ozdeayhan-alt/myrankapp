const admin = require("../../../firebase-config");
const { db } = require("../../lib/firestore");
const { StoryError } = require("./storyErrors");

async function getFollowingUserIds(userId) {
  const snap = await db
    .collection("follows")
    .where("followerId", "==", userId)
    .limit(200)
    .get();

  const ids = new Set([userId]);
  for (const doc of snap.docs) {
    const targetUserId = doc.data().targetUserId;
    if (targetUserId) {
      ids.add(targetUserId);
    }
  }
  return ids;
}

/**
 * @returns {Promise<{ ref: FirebaseFirestore.DocumentReference, data: Record<string, unknown>, id: string }>}
 */
async function loadAccessibleStory(actorId, storyId) {
  if (!storyId || typeof storyId !== "string") {
    throw new StoryError(400, "storyId gerekli");
  }

  const ref = db.collection("stories").doc(storyId);
  const doc = await ref.get();
  if (!doc.exists) {
    throw new StoryError(404, "Story bulunamadı");
  }

  const data = doc.data();
  const expiresAt = data.expiresAt;
  const expiresMs =
    expiresAt?.toMillis?.() ??
    (typeof expiresAt === "number" ? expiresAt : null);

  if (!expiresMs || expiresMs <= Date.now()) {
    throw new StoryError(404, "Story bulunamadı");
  }

  const allowedUserIds = await getFollowingUserIds(actorId);
  if (!allowedUserIds.has(data.userId)) {
    throw new StoryError(403, "Bu story'ye erişim yok");
  }

  return { ref, data, id: doc.id };
}

function actorStoryEngagementId(actorId, storyId) {
  return `${actorId}_${storyId}`;
}

module.exports = {
  loadAccessibleStory,
  actorStoryEngagementId,
  getFollowingUserIds,
};
