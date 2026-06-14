const { db } = require("../../lib/firestore");
const { PostError } = require("./postErrors");

const TWEET_MAX_LENGTH = 280;
const CAPTION_MAX_LENGTH = 2000;

function normalizeContent(contentType, content) {
  if (typeof content !== "string") {
    throw new PostError(400, "content metin olmalı");
  }

  const trimmed = content.trim();

  if (contentType === "tweet") {
    if (!trimmed) {
      throw new PostError(400, "Tweet metni boş olamaz");
    }
    if (trimmed.length > TWEET_MAX_LENGTH) {
      throw new PostError(
        400,
        `Tweet en fazla ${TWEET_MAX_LENGTH} karakter olabilir`
      );
    }
    return trimmed;
  }

  if (trimmed.length > CAPTION_MAX_LENGTH) {
    throw new PostError(
      400,
      `Açıklama en fazla ${CAPTION_MAX_LENGTH} karakter olabilir`
    );
  }

  return trimmed;
}

async function updatePostContent(postId, userId, content) {
  if (!postId || typeof postId !== "string") {
    throw new PostError(400, "postId gerekli");
  }

  const ref = db.collection("posts").doc(postId);
  const snap = await ref.get();

  if (!snap.exists) {
    throw new PostError(404, "Gönderi bulunamadı");
  }

  const data = snap.data();
  if (data.authorId !== userId) {
    throw new PostError(403, "Bu gönderiyi düzenleme yetkiniz yok");
  }

  const contentType = data.contentType ?? "tweet";
  const nextContent = normalizeContent(contentType, content);

  await ref.update({
    content: nextContent,
    updatedAt: new Date(),
  });

  return { ok: true, postId, content: nextContent };
}

module.exports = { updatePostContent, TWEET_MAX_LENGTH, CAPTION_MAX_LENGTH };
