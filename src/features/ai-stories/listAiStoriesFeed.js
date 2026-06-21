const admin = require("../../../firebase-config");
const { db } = require("../../lib/firestore");

function serializeStory(doc) {
  const data = doc.data();
  return {
    id: doc.id,
    userId: data.userId,
    authorDisplayName: data.authorDisplayName ?? "",
    authorPhotoURL: data.authorPhotoURL ?? null,
    moodKey: data.moodKey,
    locationKey: data.locationKey,
    actionKey: data.actionKey,
    caption: data.caption ?? null,
    sceneId: data.sceneId,
    template: data.template,
    status: data.status,
    sharedPostId: data.sharedPostId ?? null,
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
 * Active stories from people the user follows (including self).
 * @param {string} userId
 * @param {{ limit?: number }} [options]
 */
async function listAiStoriesFeed(userId, options = {}) {
  const limit = Math.min(Math.max(Number(options.limit) || 30, 1), 50);
  const allowedUserIds = await getFollowingUserIds(userId);
  const now = admin.firestore.Timestamp.now();

  const snap = await db
    .collection("ai_stories")
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
async function getAiStoryById(userId, storyId) {
  const ref = db.collection("ai_stories").doc(storyId);
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
  if (!allowedUserIds.has(story.userId) && story.userId !== userId) {
    return null;
  }

  return story;
}

module.exports = {
  listAiStoriesFeed,
  getAiStoryById,
  serializeStory,
};
