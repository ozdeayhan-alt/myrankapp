const { db } = require("../../lib/firestore");
const { mapPostDoc } = require("./mapPostDoc");

const DEFAULT_LIMIT = 50;

async function fetchSavedPostsPage({ userId, limit = DEFAULT_LIMIT }) {
  const pageSize = Math.min(Math.max(Number(limit) || DEFAULT_LIMIT, 1), 100);

  const engagementSnap = await db
    .collection("actorEngagements")
    .where("actorId", "==", userId)
    .where("saved", "==", true)
    .limit(pageSize)
    .get();

  const postIds = engagementSnap.docs
    .map((doc) => doc.data().postId)
    .filter((id) => typeof id === "string" && id.trim().length > 0);

  if (postIds.length === 0) {
    return { posts: [], hasMore: false };
  }

  const postRefs = postIds.map((postId) => db.collection("posts").doc(postId));
  const postSnaps = await db.getAll(...postRefs);
  const posts = postSnaps
    .filter((snap) => snap.exists)
    .map((snap) => mapPostDoc(snap.id, snap.data()))
    .sort((a, b) => b.postScore - a.postScore);

  return {
    posts,
    hasMore: engagementSnap.size === pageSize,
  };
}

module.exports = {
  fetchSavedPostsPage,
};
