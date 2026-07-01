const { db } = require("../../lib/firestore");
const { actorStoryEngagementId, loadAccessibleStory } = require("./storyAccess");

/**
 * @param {string} actorId
 * @param {string} storyId
 */
async function getStoryEngagement(actorId, storyId) {
  await loadAccessibleStory(actorId, storyId);

  const engRef = db
    .collection("actorStoryEngagements")
    .doc(actorStoryEngagementId(actorId, storyId));
  const snap = await engRef.get();
  const data = snap.exists ? snap.data() : {};

  return {
    storyId,
    liked: Boolean(data.liked),
    voteNet: typeof data.voteNet === "number" ? data.voteNet : 0,
  };
}

module.exports = { getStoryEngagement };
