const { db } = require("../../lib/firestore");
const { AiStoryError } = require("./aiStoryErrors");

/**
 * Link an existing post created by the user to a story (optional share to feed).
 * @param {string} userId
 * @param {string} storyId
 * @param {string} postId
 */
async function linkStoryToPost(userId, storyId, postId) {
  if (!postId || typeof postId !== "string") {
    throw new AiStoryError(400, "postId gerekli");
  }

  const ref = db.collection("ai_stories").doc(storyId);
  const doc = await ref.get();
  if (!doc.exists) {
    throw new AiStoryError(404, "Story bulunamadı");
  }

  const data = doc.data();
  if (data.userId !== userId) {
    throw new AiStoryError(403, "Bu story size ait değil");
  }

  const postSnap = await db.collection("posts").doc(postId).get();
  if (!postSnap.exists) {
    throw new AiStoryError(404, "Gönderi bulunamadı");
  }
  if (postSnap.data()?.authorId !== userId) {
    throw new AiStoryError(403, "Bu gönderi size ait değil");
  }

  await ref.update({ sharedPostId: postId });

  return { ok: true, storyId, sharedPostId: postId };
}

module.exports = {
  linkStoryToPost,
};
