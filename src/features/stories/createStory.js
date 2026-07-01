const admin = require("../../../firebase-config");
const { db } = require("../../lib/firestore");
const { sanitizeCaption } = require("./sanitizeCaption");
const { StoryError } = require("./storyErrors");
const { resolveUserPublic } = require("../messages/resolveUserPublic");
const { assertAllowedMediaURL } = require("../../lib/validateMediaUrl");

const STORY_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_STORIES_PER_DAY = 5;

function assertMediaType(value) {
  if (value !== "image" && value !== "video") {
    throw new StoryError(400, "Geçersiz medya türü");
  }
}

function assertMediaUrl(value, label) {
  try {
    return assertAllowedMediaURL(value, label);
  } catch (error) {
    throw new StoryError(error.statusCode ?? 400, error.message);
  }
}

async function countRecentStories(userId) {
  const since = admin.firestore.Timestamp.fromMillis(Date.now() - STORY_TTL_MS);
  const snap = await db
    .collection("stories")
    .where("userId", "==", userId)
    .where("createdAt", ">=", since)
    .count()
    .get();

  return snap.data().count;
}

/**
 * @param {string} userId
 * @param {{ mediaType: 'image' | 'video', mediaURL: string, posterURL?: string | null, caption?: string | null }} input
 */
async function createStory(userId, input) {
  assertMediaType(input.mediaType);
  const mediaURL = assertMediaUrl(input.mediaURL, "mediaURL");
  const posterURL =
    input.posterURL && typeof input.posterURL === "string"
      ? assertMediaUrl(input.posterURL, "posterURL")
      : null;
  const caption = sanitizeCaption(input.caption);

  const recentCount = await countRecentStories(userId);
  if (recentCount >= MAX_STORIES_PER_DAY) {
    throw new StoryError(
      429,
      "24 saat içinde en fazla 5 story paylaşabilirsiniz"
    );
  }

  const profile = await resolveUserPublic(userId);
  const now = admin.firestore.Timestamp.now();
  const expiresAt = admin.firestore.Timestamp.fromMillis(
    Date.now() + STORY_TTL_MS
  );

  const doc = {
    userId,
    authorDisplayName: profile.displayName,
    authorPhotoURL: profile.photoURL ?? null,
    mediaType: input.mediaType,
    mediaURL,
    posterURL,
    caption,
    createdAt: now,
    expiresAt,
    viewCount: 0,
    heartLikeCount: 0,
    likeCount: 0,
    dislikeCount: 0,
    storyScore: 0,
  };

  const ref = await db.collection("stories").add(doc);

  return {
    ok: true,
    story: {
      id: ref.id,
      ...doc,
      createdAt: now.toMillis(),
      expiresAt: expiresAt.toMillis(),
    },
  };
}

module.exports = {
  createStory,
  STORY_TTL_MS,
  MAX_STORIES_PER_DAY,
};
