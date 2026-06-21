const admin = require("../../../firebase-config");
const { db } = require("../../lib/firestore");
const {
  MOOD_KEYS,
  LOCATION_KEYS,
  ACTION_KEYS,
} = require("./chipKeys");
const { resolveStoryScene } = require("./sceneMapper");
const { sanitizeCaption } = require("./sanitizeCaption");
const { AiStoryError } = require("./aiStoryErrors");
const { resolveUserPublic } = require("../messages/resolveUserPublic");

const STORY_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_STORIES_PER_DAY = 5;

function assertChipKey(value, allowed, label) {
  if (!value || typeof value !== "string" || !allowed.has(value)) {
    throw new AiStoryError(400, `Geçersiz ${label}`);
  }
}

async function countRecentStories(userId) {
  const since = admin.firestore.Timestamp.fromMillis(Date.now() - STORY_TTL_MS);
  const snap = await db
    .collection("ai_stories")
    .where("userId", "==", userId)
    .where("createdAt", ">=", since)
    .count()
    .get();

  return snap.data().count;
}

/**
 * @param {string} userId
 * @param {{ moodKey: string, locationKey: string, actionKey: string, caption?: string | null }} input
 */
async function createAiStory(userId, input) {
  assertChipKey(input.moodKey, MOOD_KEYS, "mood");
  assertChipKey(input.locationKey, LOCATION_KEYS, "location");
  assertChipKey(input.actionKey, ACTION_KEYS, "action");

  const caption = sanitizeCaption(input.caption);

  const recentCount = await countRecentStories(userId);
  if (recentCount >= MAX_STORIES_PER_DAY) {
    throw new AiStoryError(
      429,
      "24 saat içinde en fazla 5 story oluşturabilirsiniz"
    );
  }

  const { sceneId, template } = resolveStoryScene({
    moodKey: input.moodKey,
    locationKey: input.locationKey,
    actionKey: input.actionKey,
  });

  const profile = await resolveUserPublic(userId);
  const now = admin.firestore.Timestamp.now();
  const expiresAt = admin.firestore.Timestamp.fromMillis(
    Date.now() + STORY_TTL_MS
  );

  const doc = {
    userId,
    authorDisplayName: profile.displayName,
    authorPhotoURL: profile.photoURL ?? null,
    moodKey: input.moodKey,
    locationKey: input.locationKey,
    actionKey: input.actionKey,
    caption,
    sceneId,
    template,
    status: "completed",
    sharedPostId: null,
    createdAt: now,
    expiresAt,
  };

  const ref = await db.collection("ai_stories").add(doc);

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
  createAiStory,
  STORY_TTL_MS,
  MAX_STORIES_PER_DAY,
};
