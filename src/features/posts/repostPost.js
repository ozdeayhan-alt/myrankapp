const { FieldValue } = require("firebase-admin/firestore");
const { db } = require("../../lib/firestore");
const { buildSegmentKey, EMPTY_METADATA } = require("../../lib/segmentKey");
const { applyInteraction } = require("../ranking/engine/applyInteraction");
const { afterAuthorScoreChange } = require("../ranking/rankingScoreSync");
const { invalidateFeedCachesForPost } = require("../feed/feedCache");
const { enqueueFanOut } = require("../../lib/jobQueue");
const { PostError } = require("./postErrors");
const { CAPTION_MAX_LENGTH } = require("./updatePostContent");

function normalizeCaption(caption) {
  if (caption == null || caption === "") {
    return "";
  }
  if (typeof caption !== "string") {
    throw new PostError(400, "caption metin olmalı");
  }
  const trimmed = caption.trim();
  if (trimmed.length > CAPTION_MAX_LENGTH) {
    throw new PostError(
      400,
      `Alıntı metni en fazla ${CAPTION_MAX_LENGTH} karakter olabilir`
    );
  }
  return trimmed;
}

function parseMetadata(data) {
  const metadata = data?.metadata;
  if (!metadata || typeof metadata !== "object") {
    return { ...EMPTY_METADATA };
  }
  return {
    country: String(metadata.country ?? ""),
    city: String(metadata.city ?? ""),
    gender: String(metadata.gender ?? ""),
    age: typeof metadata.age === "number" ? metadata.age : null,
    profession: String(metadata.profession ?? ""),
    maritalStatus: String(metadata.maritalStatus ?? ""),
  };
}

function buildOriginalSnapshot(original) {
  const snapshot = {
    authorId: String(original.authorId ?? ""),
    contentType: original.contentType ?? "tweet",
  };

  if (original.authorDisplayName) {
    snapshot.authorDisplayName = String(original.authorDisplayName);
  }
  if (original.authorPhotoURL) {
    snapshot.authorPhotoURL = String(original.authorPhotoURL);
  }
  if (original.content) {
    snapshot.content = String(original.content);
  }
  if (original.mediaURL) {
    snapshot.mediaURL = String(original.mediaURL);
  }
  if (original.hlsURL) {
    snapshot.hlsURL = String(original.hlsURL);
  }
  if (original.posterURL) {
    snapshot.posterURL = String(original.posterURL);
  }
  if (typeof original.mediaWidth === "number") {
    snapshot.mediaWidth = original.mediaWidth;
  }
  if (typeof original.mediaHeight === "number") {
    snapshot.mediaHeight = original.mediaHeight;
  }

  return snapshot;
}

async function repostPost(originalPostId, actorId, caption) {
  if (!originalPostId || typeof originalPostId !== "string") {
    throw new PostError(400, "postId gerekli");
  }

  const repostCaption = normalizeCaption(caption);

  const originalRef = db.collection("posts").doc(originalPostId);
  const originalSnap = await originalRef.get();

  if (!originalSnap.exists) {
    throw new PostError(404, "Gönderi bulunamadı");
  }

  const original = originalSnap.data();
  const originalAuthorId = String(original.authorId ?? "");

  if (originalAuthorId === actorId) {
    throw new PostError(400, "Kendi gönderinizi akışa paylaşamazsınız");
  }

  if (original.contentType === "repost") {
    throw new PostError(400, "Alıntı gönderiler tekrar paylaşılamaz");
  }

  const actorSnap = await db.collection("users").doc(actorId).get();
  const actorData = actorSnap.exists ? actorSnap.data() : {};
  const metadata = parseMetadata(actorData);
  const segmentKey = buildSegmentKey(metadata);

  const authorDisplayName =
    String(actorData.displayName ?? "").trim() || "Kullanıcı";
  const authorPhotoURL = actorData.photoURL
    ? String(actorData.photoURL)
    : undefined;

  const originalSnapshot = buildOriginalSnapshot(original);
  const repostRef = db.collection("posts").doc();

  await repostRef.set({
    authorId: actorId,
    authorDisplayName,
    ...(authorPhotoURL ? { authorPhotoURL } : {}),
    metadata,
    segmentKey,
    postScore: 0,
    likeCount: 0,
    dislikeCount: 0,
    shareCount: 0,
    saveCount: 0,
    commentCount: 0,
    contentType: "repost",
    originalPostId,
    repostCaption,
    originalSnapshot,
    createdAt: FieldValue.serverTimestamp(),
  });

  let shareResult = null;
  try {
    shareResult = await applyInteraction({
      postId: originalPostId,
      actorId,
      type: "share",
    });
    afterAuthorScoreChange(shareResult.authorId, shareResult.scoreDelta);
  } catch (err) {
    console.error("[repostPost] share interaction failed:", err.message ?? err);
  }

  void enqueueFanOut(repostRef.id).catch((error) => {
    console.error("[repostPost] fan-out failed:", error.message ?? error);
  });

  await invalidateFeedCachesForPost({
    authorId: actorId,
    segmentKey,
    hashtags: [],
  });

  return {
    ok: true,
    repostId: repostRef.id,
    originalPostId,
    repostCaption,
    originalAuthorId,
    shareInteraction: shareResult
      ? {
          postScore: shareResult.postScore,
          scoreDelta: shareResult.scoreDelta,
        }
      : null,
  };
}

module.exports = { repostPost, buildOriginalSnapshot };
