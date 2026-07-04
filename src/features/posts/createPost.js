const { FieldValue } = require("firebase-admin/firestore");
const { db } = require("../../lib/firestore");
const {
  buildSegmentKey,
  EMPTY_METADATA,
  isMetadataComplete,
} = require("../../lib/segmentKey");
const { assertAllowedMediaURL } = require("../../lib/validateMediaUrl");
const { parseFirebaseStorageUrl } = require("./parseFirebaseStorageUrl");
const { PostError } = require("./postErrors");
const { resolveMentions } = require("./resolveMentions");
const { notifyMentions } = require("./notifyMentions");
const {
  extractHashtags,
  extractMentionTokens,
} = require("./parsePostContent");
const { TWEET_MAX_LENGTH, CAPTION_MAX_LENGTH } = require("./updatePostContent");
const { invalidateFeedCachesForPost } = require("../feed/feedCache");
const { resolveFeedContentType } = require("../feed/feedContentType");
const { enqueueFanOutDirect } = require("../../lib/jobQueue");

const POST_CONTENT_TYPES = new Set(["tweet", "image", "video"]);
const DEFAULT_VIDEO_WIDTH = 1280;
const DEFAULT_VIDEO_HEIGHT = 720;
const DEFAULT_IMAGE_WIDTH = 1080;
const DEFAULT_IMAGE_HEIGHT = 1080;

function mapUserMetadata(userData) {
  const metadata = userData?.metadata;
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

function normalizeContentType(raw) {
  const contentType = String(raw ?? "tweet").trim().toLowerCase();
  if (!POST_CONTENT_TYPES.has(contentType)) {
    throw new PostError(400, "Geçersiz contentType");
  }
  return contentType;
}

function normalizeCreateContent(contentType, content) {
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

function parseMediaObjectPath(url) {
  const firebasePath = parseFirebaseStorageUrl(url);
  if (firebasePath) {
    return firebasePath;
  }

  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/\/o\/(.+)$/);
    if (match?.[1]) {
      return decodeURIComponent(match[1]);
    }
  } catch {
    return null;
  }

  return null;
}

function assertAuthorPostMediaURL(url, authorId, label) {
  let trimmed;
  try {
    trimmed = assertAllowedMediaURL(url, label);
  } catch (error) {
    throw new PostError(error.statusCode ?? 400, error.message);
  }

  const objectPath = parseMediaObjectPath(trimmed);
  if (objectPath && !objectPath.startsWith(`posts/${authorId}/`)) {
    throw new PostError(403, "Medya bu kullanıcıya ait değil");
  }

  return trimmed;
}

function resolveMediaDimensions(contentType, input) {
  const mediaWidth = input.mediaWidth;
  const mediaHeight = input.mediaHeight;

  if (
    typeof mediaWidth === "number" &&
    typeof mediaHeight === "number" &&
    mediaWidth > 0 &&
    mediaHeight > 0
  ) {
    return { mediaWidth, mediaHeight };
  }

  if (contentType === "video") {
    return {
      mediaWidth: DEFAULT_VIDEO_WIDTH,
      mediaHeight: DEFAULT_VIDEO_HEIGHT,
    };
  }

  if (contentType === "image") {
    return {
      mediaWidth: DEFAULT_IMAGE_WIDTH,
      mediaHeight: DEFAULT_IMAGE_HEIGHT,
    };
  }

  return {};
}

async function createPost(authorId, input = {}) {
  if (!authorId || typeof authorId !== "string") {
    throw new PostError(400, "authorId gerekli");
  }

  const contentType = normalizeContentType(input.contentType);
  const trimmedContent = normalizeCreateContent(contentType, input.content ?? "");

  const userSnap = await db.collection("users").doc(authorId).get();
  if (!userSnap.exists) {
    throw new PostError(404, "Kullanıcı bulunamadı");
  }

  const userData = userSnap.data();
  const metadata = mapUserMetadata(userData);
  if (!isMetadataComplete(metadata)) {
    throw new PostError(400, "Profil tamamlanmadan gönderi paylaşılamaz");
  }

  const segmentKey = buildSegmentKey(metadata);
  const authorDisplayName =
    typeof userData.displayName === "string" && userData.displayName.trim()
      ? userData.displayName.trim()
      : "İsimsiz Kullanıcı";
  const authorPhotoURL =
    typeof userData.photoURL === "string" && userData.photoURL.trim()
      ? userData.photoURL.trim()
      : "";

  let mediaURL;
  let hlsURL;
  let posterURL;

  if (contentType === "image" || contentType === "video") {
    mediaURL = assertAuthorPostMediaURL(input.mediaURL, authorId, "mediaURL");
  } else if (input.mediaURL) {
    throw new PostError(400, "Tweet gönderilerinde mediaURL kullanılamaz");
  }

  if (input.hlsURL) {
    hlsURL = assertAuthorPostMediaURL(input.hlsURL, authorId, "hlsURL");
  }
  if (input.posterURL) {
    posterURL = assertAuthorPostMediaURL(input.posterURL, authorId, "posterURL");
  }

  const hashtags = extractHashtags(trimmedContent);
  const mentionTokens = extractMentionTokens(trimmedContent);
  let mentionUserIds = [];

  if (mentionTokens.length > 0) {
    try {
      const resolved = await resolveMentions(mentionTokens, authorId);
      mentionUserIds = [
        ...new Set(
          (resolved.mentions ?? [])
            .map((entry) => entry.userId)
            .filter(Boolean)
        ),
      ];
    } catch (error) {
      console.warn(
        "[createPost] mention resolution failed:",
        error.message ?? error
      );
    }
  }

  const mediaDimensions = resolveMediaDimensions(contentType, input);

  const payload = {
    authorId,
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
    contentType,
    feedContentType: resolveFeedContentType({ contentType }),
    content: trimmedContent,
    ...(hashtags.length > 0 ? { hashtags } : {}),
    ...(mentionUserIds.length > 0 ? { mentionUserIds } : {}),
    ...(mediaURL ? { mediaURL } : {}),
    ...(hlsURL ? { hlsURL } : {}),
    ...(posterURL ? { posterURL } : {}),
    ...mediaDimensions,
    createdAt: FieldValue.serverTimestamp(),
  };

  const ref = await db.collection("posts").add(payload);
  const createdAtMillis = Date.now();

  void enqueueFanOutDirect({
    postId: ref.id,
    authorId,
    createdAtMillis,
    feedContentType: resolveFeedContentType({ contentType }),
  }).catch((error) => {
    console.error("[createPost] fan-out failed:", error.message ?? error);
  });

  await invalidateFeedCachesForPost({
    authorId,
    segmentKey,
    hashtags,
  });

  if (mentionUserIds.length > 0) {
    void notifyMentions(authorId, ref.id, mentionUserIds).catch((error) => {
      console.error("[createPost] mention notify failed:", error.message ?? error);
    });
  }

  return {
    ok: true,
    id: ref.id,
    mentionUserIds,
    fanOutQueued: true,
  };
}

module.exports = { createPost };
