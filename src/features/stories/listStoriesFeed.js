const admin = require("../../../firebase-config");
const { db } = require("../../lib/firestore");

function serializeStory(doc) {
  const data = doc.data();
  return {
    id: doc.id,
    userId: data.userId,
    authorDisplayName: data.authorDisplayName ?? "",
    authorPhotoURL: data.authorPhotoURL ?? null,
    mediaType: data.mediaType,
    mediaURL: data.mediaURL,
    posterURL: data.posterURL ?? null,
    caption: data.caption ?? null,
    createdAt: data.createdAt?.toMillis?.() ?? null,
    expiresAt: data.expiresAt?.toMillis?.() ?? null,
  };
}

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
 * @param {string} userId
 * @param {{ limit?: number }} [options]
 */
async function listStoriesFeed(userId, options = {}) {
  const limit = Math.min(Math.max(Number(options.limit) || 30, 1), 50);
  const allowedUserIds = await getFollowingUserIds(userId);
  const now = admin.firestore.Timestamp.now();

  const snap = await db
    .collection("stories")
    .where("expiresAt", ">", now)
    .orderBy("expiresAt")
    .orderBy("createdAt", "desc")
    .limit(100)
    .get();

  const stories = snap.docs
    .map(serializeStory)
    .filter((story) => allowedUserIds.has(story.userId))
    .slice(0, limit);

  return { ok: true, stories };
}

/**
 * @param {string} userId
 * @param {string} storyId
 */
async function getStoryById(userId, storyId) {
  const ref = db.collection("stories").doc(storyId);
  const doc = await ref.get();
  if (!doc.exists) {
    return null;
  }

  const story = serializeStory(doc);
  const nowMs = Date.now();
  if (!story.expiresAt || story.expiresAt <= nowMs) {
    return null;
  }

  const allowedUserIds = await getFollowingUserIds(userId);
  if (!allowedUserIds.has(story.userId)) {
    return null;
  }

  return story;
}

module.exports = {
  listStoriesFeed,
  getStoryById,
  serializeStory,
};
