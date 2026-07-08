const { db } = require("../../lib/firestore");
const { mapPostDoc } = require("../feed/mapPostDoc");
const { applyFeedContentTypeFilter } = require("../feed/feedContentType");
const { getBlockedUserIds } = require("../blocks/blockService");
const {
  DUEL_BOT_GLOW_POOL_SIZE,
  DUEL_MATCH_POOL_SIZE,
} = require("./constants");

function isDuelEligiblePost(post, blocked) {
  return (
    post.contentType !== "repost" &&
    !post.originalPostId &&
    Boolean(post.mediaURL) &&
    typeof post.authorId === "string" &&
    post.authorId.length > 0 &&
    !blocked.has(post.authorId)
  );
}

function mapEligiblePosts(docs, blocked) {
  return docs
    .map((doc) => mapPostDoc(doc.id, doc.data()))
    .filter((post) => isDuelEligiblePost(post, blocked));
}

function pickRandomPair(candidates, excludeIds = new Set()) {
  const pool = candidates.filter(
    (post) =>
      !excludeIds.has(post.id) &&
      post.mediaURL &&
      typeof post.authorId === "string" &&
      post.authorId.length > 0
  );
  if (pool.length < 2) {
    return null;
  }

  const maxAttempts = Math.min(pool.length * 3, 48);
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const firstIndex = Math.floor(Math.random() * pool.length);
    const first = pool[firstIndex];
    const others = pool.filter(
      (post, index) =>
        index !== firstIndex && post.authorId !== first.authorId
    );
    if (others.length === 0) {
      continue;
    }
    const second = others[Math.floor(Math.random() * others.length)];
    return [first, second];
  }

  return null;
}

async function fetchBotGlowCandidates(blocked) {
  const botsSnap = await db.collection("users").where("isBot", "==", true).get();
  const botIds = botsSnap.docs
    .map((doc) => doc.id)
    .filter((id) => !blocked.has(id));

  if (botIds.length === 0) {
    return [];
  }

  const snap = await applyFeedContentTypeFilter(db.collection("posts"), "image")
    .where("authorId", "in", botIds.slice(0, 30))
    .orderBy("createdAt", "desc")
    .limit(DUEL_BOT_GLOW_POOL_SIZE)
    .get();

  return mapEligiblePosts(snap.docs, blocked);
}

/**
 * Returns two Glow posts for a duel match.
 * Merges recent global Glow posts with bot Glow posts; authors must differ.
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

  const [globalSnap, botCandidates] = await Promise.all([
    query.get(),
    fetchBotGlowCandidates(blocked),
  ]);

  const globalCandidates = mapEligiblePosts(globalSnap.docs, blocked);
  const byId = new Map();
  for (const post of [...globalCandidates, ...botCandidates]) {
    byId.set(post.id, post);
  }
  const candidates = [...byId.values()];

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

module.exports = {
  fetchDuelMatch,
  pickRandomPair,
  isDuelEligiblePost,
};
