const { db } = require("../../lib/firestore");
const { mapPostDoc } = require("../feed/mapPostDoc");
const { applyFeedContentTypeFilter } = require("../feed/feedContentType");
const { getBlockedUserIds } = require("../blocks/blockService");
const { DUEL_MATCH_POOL_SIZE } = require("./constants");

function pickRandomPair(candidates, excludeIds = new Set()) {
  const pool = candidates.filter(
    (post) => !excludeIds.has(post.id) && post.mediaURL
  );
  if (pool.length < 2) {
    return null;
  }

  const firstIndex = Math.floor(Math.random() * pool.length);
  let secondIndex = Math.floor(Math.random() * (pool.length - 1));
  if (secondIndex >= firstIndex) {
    secondIndex += 1;
  }

  return [pool[firstIndex], pool[secondIndex]];
}

/**
 * Returns two Glow posts for a duel match.
 * Single Firestore read (one query); no per-post engagement fetch.
 */
async function fetchDuelMatch({ viewerId, excludeIds = [] } = {}) {
  const excludeSet = new Set(
    Array.isArray(excludeIds)
      ? excludeIds.filter((id) => typeof id === "string" && id.length > 0)
      : []
  );

  const blocked =
    viewerId != null ? await getBlockedUserIds(viewerId) : new Set();

  let query = applyFeedContentTypeFilter(db.collection("posts"), "image");
  query = query.orderBy("createdAt", "desc").limit(DUEL_MATCH_POOL_SIZE);

  const snap = await query.get();
  const candidates = snap.docs
    .map((doc) => mapPostDoc(doc.id, doc.data()))
    .filter(
      (post) =>
        post.contentType !== "repost" &&
        !post.originalPostId &&
        Boolean(post.mediaURL)
    )
    .filter((post) => !blocked.has(post.authorId));

  const pair = pickRandomPair(candidates, excludeSet);
  if (!pair) {
    throw new Error("Not enough Glow posts for duel");
  }

  const [postA, postB] = pair;
  return {
    matchId: `${postA.id}_${postB.id}`,
    postA,
    postB,
  };
}

module.exports = { fetchDuelMatch, pickRandomPair };
