const { FieldValue } = require("firebase-admin/firestore");
const { db } = require("../../lib/firestore");
const { resolveUserPublic } = require("../messages/resolveUserPublic");
const {
  actorStoryEngagementId,
  loadAccessibleStory,
} = require("./storyAccess");
const { StoryError } = require("./storyErrors");

/**
 * @param {string} actorId
 * @param {string} storyId
 */
async function toggleStoryLike(actorId, storyId) {
  const { ref, data } = await loadAccessibleStory(actorId, storyId);
  const ownerId = data.userId;

  if (ownerId === actorId) {
    throw new StoryError(400, "Kendi story'nize beğeni bırakamazsınız");
  }

  const likeRef = ref.collection("likes").doc(actorId);
  const engRef = db
    .collection("actorStoryEngagements")
    .doc(actorStoryEngagementId(actorId, storyId));

  const profile = await resolveUserPublic(actorId);

  const result = await db.runTransaction(async (transaction) => {
    const storySnap = await transaction.get(ref);
    if (!storySnap.exists) {
      throw new StoryError(404, "Story bulunamadı");
    }

    const likeSnap = await transaction.get(likeRef);
    const currentlyLiked = likeSnap.exists;
    const nextLiked = !currentlyLiked;
    const currentHeartLikeCount = storySnap.data()?.heartLikeCount ?? 0;
    const nextHeartLikeCount = nextLiked
      ? currentHeartLikeCount + 1
      : Math.max(0, currentHeartLikeCount - 1);

    if (nextLiked) {
      transaction.set(likeRef, {
        actorId,
        displayName: profile.displayName,
        photoURL: profile.photoURL ?? null,
        likedAt: FieldValue.serverTimestamp(),
      });
      transaction.update(ref, { heartLikeCount: FieldValue.increment(1) });
    } else {
      transaction.delete(likeRef);
      transaction.update(ref, { heartLikeCount: FieldValue.increment(-1) });
    }

    transaction.set(
      engRef,
      {
        actorId,
        storyId,
        liked: nextLiked,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return {
      liked: nextLiked,
      heartLikeCount: nextHeartLikeCount,
    };
  });

  return {
    storyId,
    ...result,
  };
}

module.exports = { toggleStoryLike };
