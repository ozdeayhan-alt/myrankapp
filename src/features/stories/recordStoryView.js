const { FieldValue } = require("firebase-admin/firestore");
const { db } = require("../../lib/firestore");
const { resolveUserPublic } = require("../messages/resolveUserPublic");
const { loadAccessibleStory } = require("./storyAccess");
const { StoryError } = require("./storyErrors");

/**
 * @param {string} actorId
 * @param {string} storyId
 */
async function recordStoryView(actorId, storyId) {
  const { ref, data } = await loadAccessibleStory(actorId, storyId);
  const ownerId = data.userId;

  if (ownerId === actorId) {
    return {
      storyId,
      viewCount: data.viewCount ?? 0,
      recorded: false,
    };
  }

  const viewRef = ref.collection("views").doc(actorId);
  const viewSnap = await viewRef.get();
  if (viewSnap.exists) {
    return {
      storyId,
      viewCount: data.viewCount ?? 0,
      recorded: false,
    };
  }

  const profile = await resolveUserPublic(actorId);

  await db.runTransaction(async (transaction) => {
    const freshSnap = await transaction.get(ref);
    if (!freshSnap.exists) {
      throw new StoryError(404, "Story bulunamadı");
    }

    const viewDoc = await transaction.get(viewRef);
    if (viewDoc.exists) {
      return;
    }

    transaction.set(viewRef, {
      actorId,
      displayName: profile.displayName,
      photoURL: profile.photoURL ?? null,
      viewedAt: FieldValue.serverTimestamp(),
    });

    transaction.update(ref, {
      viewCount: FieldValue.increment(1),
    });
  });

  const updated = await ref.get();
  return {
    storyId,
    viewCount: updated.data()?.viewCount ?? 1,
    recorded: true,
  };
}

module.exports = { recordStoryView };
