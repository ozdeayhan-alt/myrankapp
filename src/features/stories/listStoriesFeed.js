const admin = require("../../../firebase-config");
const { db } = require("../../lib/firestore");
const { chunkArray } = require("../../lib/chunkArray");

const FIRESTORE_IN_LIMIT = 30;

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
    viewCount: data.viewCount ?? 0,
    heartLikeCount: data.heartLikeCount ?? 0,
    likeCount: data.likeCount ?? 0,
    dislikeCount: data.dislikeCount ?? 0,
    storyScore: data.storyScore ?? 0,
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

async function fetchStoriesForUserIds(userIds, now, perChunkLimit) {
  const chunks = chunkArray(userIds, FIRESTORE_IN_LIMIT);
  if (chunks.length === 0) {
    return [];
  }

  const snapshots = await Promise.all(
    chunks.map((chunk) =>
      db
        .collection("stories")
        .where("userId", "in", chunk)
        .where("expiresAt", ">", now)
        .orderBy("expiresAt")
        .orderBy("createdAt", "desc")
        .limit(perChunkLimit)
        .get()
    )
  );

  return snapshots.flatMap((snap) => snap.docs);
}

async function fetchStoriesGlobalFallback(now, fetchLimit) {
  const snap = await db
    .collection("stories")
    .where("expiresAt", ">", now)
    .orderBy("expiresAt")
    .orderBy("createdAt", "desc")
    .limit(fetchLimit)
    .get();

  return snap.docs;
}

/**
 * @param {string} userId
 * @param {{ limit?: number }} [options]
 */
async function listStoriesFeed(userId, options = {}) {
  const limit = Math.min(Math.max(Number(options.limit) || 30, 1), 50);
  const allowedUserIds = [...(await getFollowingUserIds(userId))];
  const now = admin.firestore.Timestamp.now();
  const perChunkLimit = Math.min(limit + 5, 50);

  let docs = [];
  try {
    docs = await fetchStoriesForUserIds(
      allowedUserIds,
      now,
      perChunkLimit
    );
  } catch (error) {
    console.warn(
      "[listStoriesFeed] following-scoped query failed, falling back:",
      error.message ?? error
    );
    const globalDocs = await fetchStoriesGlobalFallback(now, 100);
    const allowed = new Set(allowedUserIds);
    docs = globalDocs.filter((doc) => allowed.has(doc.data().userId));
  }

  const stories = docs
    .map(serializeStory)
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
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
