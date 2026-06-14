const { FieldValue, Timestamp } = require("firebase-admin/firestore");
const { db } = require("../../lib/firestore");
const { buildSegmentKey } = require("../../lib/segmentKey");
const { postImageUrl } = require("./botPersonas");
const { toDate } = require("./botUtils");
const { invalidateFeedCachesForPost } = require("../feed/feedCache");
const { fanOutPostToFollowers } = require("../feed/userFeedService");

async function getUserPostContext(authorId) {
  const userSnap = await db.collection("users").doc(authorId).get();
  if (!userSnap.exists) {
    throw new Error(`Bot user not found: ${authorId}`);
  }

  const userData = userSnap.data();
  const metadata = userData.metadata ?? {};
  const displayName =
    typeof userData.displayName === "string" && userData.displayName.trim()
      ? userData.displayName.trim()
      : "Bot";
  const photoURL =
    typeof userData.photoURL === "string" && userData.photoURL.trim()
      ? userData.photoURL.trim()
      : null;

  return {
    authorId,
    authorDisplayName: displayName,
    authorPhotoURL: photoURL,
    metadata,
    segmentKey: buildSegmentKey(metadata),
  };
}

async function countPostsByAuthor(authorId) {
  const snap = await db
    .collection("posts")
    .where("authorId", "==", authorId)
    .count()
    .get();
  return snap.data().count;
}

async function createBotPost({
  authorId,
  contentType,
  content,
  mediaSeed,
  createdAt,
}) {
  const ctx = await getUserPostContext(authorId);
  const trimmedContent = String(content ?? "").trim();

  const payload = {
    authorId: ctx.authorId,
    authorDisplayName: ctx.authorDisplayName,
    metadata: ctx.metadata,
    segmentKey: ctx.segmentKey,
    postScore: 0,
    likeCount: 0,
    dislikeCount: 0,
    shareCount: 0,
    saveCount: 0,
    commentCount: 0,
    contentType,
    content: trimmedContent,
    createdAt: createdAt
      ? Timestamp.fromDate(createdAt)
      : FieldValue.serverTimestamp(),
  };

  if (ctx.authorPhotoURL) {
    payload.authorPhotoURL = ctx.authorPhotoURL;
  }

  if (contentType === "image") {
    const seed = mediaSeed || `${authorId}-${Date.now()}`;
    payload.mediaURL = postImageUrl(seed);
    payload.mediaWidth = 900;
    payload.mediaHeight = 600;
  }

  const ref = await db.collection("posts").add(payload);
  const createdAtMillis = payload.createdAt?.toMillis?.() ?? Date.now();

  void fanOutPostToFollowers({
    postId: ref.id,
    authorId: ctx.authorId,
    createdAtMillis,
  }).catch((error) => {
    console.error("[createBotPost] fan-out failed:", error.message ?? error);
  });

  invalidateFeedCachesForPost({
    authorId: ctx.authorId,
    segmentKey: ctx.segmentKey,
    hashtags: [],
  });

  return ref.id;
}

async function createInitialPostsForBots(personas) {
  const now = new Date();
  const created = [];

  for (const persona of personas) {
    const existingCount = await countPostsByAuthor(persona.uid);
    if (existingCount > 0) {
      continue;
    }

    const post = persona.initialPost;
    const postId = await createBotPost({
      authorId: persona.uid,
      contentType: post.contentType,
      content: post.content,
      mediaSeed: post.mediaSeed,
      createdAt: now,
    });

    created.push({ userId: persona.uid, postId });
  }

  return created;
}

async function findFirstPostId(authorId) {
  const snap = await db
    .collection("posts")
    .where("authorId", "==", authorId)
    .get();

  if (snap.empty) return null;

  let firstId = snap.docs[0].id;
  let firstTime = toDate(snap.docs[0].data().createdAt)?.getTime() ?? 0;

  for (const doc of snap.docs) {
    const time = toDate(doc.data().createdAt)?.getTime() ?? 0;
    if (time < firstTime) {
      firstTime = time;
      firstId = doc.id;
    }
  }

  return firstId;
}

async function findLatestPostId(authorId) {
  const snap = await db
    .collection("posts")
    .where("authorId", "==", authorId)
    .orderBy("createdAt", "desc")
    .limit(1)
    .get();

  if (snap.empty) return null;
  return snap.docs[0].id;
}

module.exports = {
  createBotPost,
  createInitialPostsForBots,
  countPostsByAuthor,
  findFirstPostId,
  findLatestPostId,
};
