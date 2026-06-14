const CACHE_TTL_MS = 60_000;
const FOLLOWING_AUTHORS_TTL_MS = 5 * 60_000;

const cache = new Map();

function nowMs() {
  return Date.now();
}

function getCacheKey(parts) {
  return parts.filter(Boolean).join(":");
}

function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= nowMs()) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCached(key, data, ttlMs = CACHE_TTL_MS) {
  cache.set(key, {
    data,
    expiresAt: nowMs() + ttlMs,
  });
}

function invalidateCached(key) {
  cache.delete(key);
}

function getFollowingAuthorsCached(userId) {
  return getCached(getCacheKey(["followingAuthors", userId]));
}

function setFollowingAuthorsCached(userId, authorIds) {
  setCached(
    getCacheKey(["followingAuthors", userId]),
    authorIds,
    FOLLOWING_AUTHORS_TTL_MS
  );
}

function invalidateFollowingAuthors(userId) {
  invalidateCached(getCacheKey(["followingAuthors", userId]));
}

function invalidateMatchingFeedCache(matcher) {
  const prefix = getCacheKey(["feed"]);
  for (const key of cache.keys()) {
    if (
      (key === prefix || key.startsWith(`${prefix}:`)) &&
      matcher(key)
    ) {
      cache.delete(key);
    }
  }
}

/** Tüm feed API cache girdilerini temizler. */
function invalidateFeedCaches() {
  invalidateMatchingFeedCache(() => true);
}

function invalidateFeedCachesForPost({
  authorId,
  segmentKey,
  hashtags = [],
}) {
  invalidateMatchingFeedCache(
    (key) =>
      key.includes(":recent:") ||
      key.includes(":top:") ||
      key.includes(":following:") ||
      key.includes(":explore:")
  );

  if (authorId) {
    invalidateMatchingFeedCache((key) =>
      key.includes(`:author:`) && key.includes(`:${authorId}:`)
    );
  }

  for (const rawTag of hashtags) {
    const tag =
      typeof rawTag === "string" ? rawTag.trim().replace(/^#/, "").toLowerCase() : "";
    if (!tag) continue;
    invalidateMatchingFeedCache((key) =>
      key.includes(":hashtag:") && key.includes(`:${tag}:`)
    );
  }

  void segmentKey;
}

module.exports = {
  getCached,
  setCached,
  invalidateCached,
  invalidateFeedCaches,
  invalidateFeedCachesForPost,
  invalidateMatchingFeedCache,
  invalidateFollowingAuthors,
  getFollowingAuthorsCached,
  setFollowingAuthorsCached,
  getCacheKey,
};
