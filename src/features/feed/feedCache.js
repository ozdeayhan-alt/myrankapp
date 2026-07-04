const { getRedisClient, getRedisStatus } = require("../../lib/redis");

function parseEnvMs(name, fallbackMs) {
  const raw = process.env[name];
  if (raw == null || raw === "") {
    return fallbackMs;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 1_000) {
    return fallbackMs;
  }
  return Math.floor(parsed);
}

/** Varsayılan feed sayfası cache süresi (ms). */
const CACHE_TTL_MS = parseEnvMs("FEED_CACHE_TTL_MS", 240_000);

const FEED_RECENT_TTL_MS = parseEnvMs("FEED_RECENT_TTL_MS", 360_000);
const FEED_EXPLORE_TTL_MS = parseEnvMs("FEED_EXPLORE_TTL_MS", 600_000);
const FEED_FOLLOWING_TTL_MS = parseEnvMs("FEED_FOLLOWING_TTL_MS", 480_000);
const FEED_AUTHOR_TTL_MS = parseEnvMs("FEED_AUTHOR_TTL_MS", 360_000);
const FEED_HASHTAG_TTL_MS = parseEnvMs("FEED_HASHTAG_TTL_MS", 360_000);
const FEED_SAVED_TTL_MS = parseEnvMs("FEED_SAVED_TTL_MS", 240_000);

const FOLLOWING_AUTHORS_TTL_MS = parseEnvMs(
  "FEED_FOLLOWING_AUTHORS_TTL_MS",
  5 * 60_000
);

const CACHE_PREFIX = process.env.CACHE_REDIS_PREFIX?.trim() || "myrank:cache:";
const memoryCache = new Map();

function nowMs() {
  return Date.now();
}

function getCacheKey(parts) {
  return parts.filter(Boolean).join(":");
}

function redisKey(key) {
  return `${CACHE_PREFIX}${key}`;
}

function readMemoryEntry(key) {
  const entry = memoryCache.get(key);
  if (!entry) {
    return null;
  }
  if (entry.expiresAt <= nowMs()) {
    memoryCache.delete(key);
    return null;
  }
  return entry.data;
}

function writeMemoryEntry(key, data, ttlMs) {
  memoryCache.set(key, {
    data,
    expiresAt: nowMs() + ttlMs,
  });
}

function serializeForRedis(data) {
  if (data instanceof Set) {
    return { __type: "Set", values: [...data] };
  }
  return data;
}

function deserializeFromRedis(data) {
  if (
    data &&
    typeof data === "object" &&
    data.__type === "Set" &&
    Array.isArray(data.values)
  ) {
    return new Set(data.values);
  }
  return data;
}

async function getCached(key) {
  const memoryHit = readMemoryEntry(key);
  if (memoryHit !== null) {
    return memoryHit;
  }

  const redis = await getRedisClient();
  if (!redis) {
    return null;
  }

  try {
    const raw = await redis.get(redisKey(key));
    if (!raw) {
      return null;
    }

    const entry = JSON.parse(raw);
    if (!entry || typeof entry.expiresAt !== "number") {
      await redis.del(redisKey(key));
      return null;
    }

    if (entry.expiresAt <= nowMs()) {
      await redis.del(redisKey(key));
      return null;
    }

    const data = deserializeFromRedis(entry.data);
    writeMemoryEntry(key, data, entry.expiresAt - nowMs());
    return data;
  } catch (error) {
    console.warn("[feedCache] redis get failed:", error.message ?? error);
    return null;
  }
}

async function setCached(key, data, ttlMs = CACHE_TTL_MS) {
  writeMemoryEntry(key, data, ttlMs);

  const redis = await getRedisClient();
  if (!redis) {
    return;
  }

  try {
    const payload = JSON.stringify({
      data: serializeForRedis(data),
      expiresAt: nowMs() + ttlMs,
    });
    await redis.setEx(redisKey(key), Math.max(1, Math.ceil(ttlMs / 1000)), payload);
  } catch (error) {
    console.warn("[feedCache] redis set failed:", error.message ?? error);
  }
}

async function invalidateCached(key) {
  memoryCache.delete(key);

  const redis = await getRedisClient();
  if (!redis) {
    return;
  }

  try {
    await redis.del(redisKey(key));
  } catch (error) {
    console.warn("[feedCache] redis del failed:", error.message ?? error);
  }
}

async function getFollowingAuthorsCached(userId) {
  return getCached(getCacheKey(["followingAuthors", userId]));
}

async function setFollowingAuthorsCached(userId, authorIds) {
  await setCached(
    getCacheKey(["followingAuthors", userId]),
    authorIds,
    FOLLOWING_AUTHORS_TTL_MS
  );
}

async function invalidateFollowingAuthors(userId) {
  await invalidateCached(getCacheKey(["followingAuthors", userId]));
}

async function invalidateMatchingFeedCache(matcher) {
  for (const key of [...memoryCache.keys()]) {
    if (matcher(key)) {
      memoryCache.delete(key);
    }
  }

  const redis = await getRedisClient();
  if (!redis) {
    return;
  }

  try {
    let cursor = 0;
    do {
      const result = await redis.scan(cursor, {
        MATCH: `${CACHE_PREFIX}*`,
        COUNT: 100,
      });
      cursor = result.cursor;
      const keysToDelete = [];

      for (const fullKey of result.keys) {
        const key = fullKey.slice(CACHE_PREFIX.length);
        if (matcher(key)) {
          keysToDelete.push(fullKey);
        }
      }

      if (keysToDelete.length > 0) {
        await redis.del(keysToDelete);
      }
    } while (cursor !== 0);
  } catch (error) {
    console.warn("[feedCache] redis scan failed:", error.message ?? error);
  }
}

/** Tüm feed API cache girdilerini temizler. */
async function invalidateFeedCaches() {
  await invalidateMatchingFeedCache(
    (key) => key === "feed" || key.startsWith("feed:")
  );
}

/** Yalnızca belirli kullanıcının feed cache girdilerini temizler. */
async function invalidateFeedCachesForUser(userId) {
  if (!userId) {
    return;
  }
  const needle = `:${userId}:`;
  await invalidateMatchingFeedCache(
    (key) =>
      (key === "feed" || key.startsWith("feed:")) && key.includes(needle)
  );
  await invalidateMatchingFeedCache((key) =>
    key.startsWith(`engagements:${userId}:`)
  );
  await invalidateMatchingFeedCache((key) =>
    key.startsWith(`profile:summary:${userId}:`) ||
    key.startsWith(`profile:gauge-bootstrap:${userId}:`)
  );
}

async function invalidateFeedCachesForPost({
  authorId,
  segmentKey,
  hashtags = [],
}) {
  await invalidateMatchingFeedCache(
    (key) =>
      key.includes(":recent:") ||
      key.includes(":following:") ||
      key.includes(":explore:")
  );

  if (authorId) {
    await invalidateMatchingFeedCache((key) =>
      key.includes(`:author:`) && key.includes(`:${authorId}:`)
    );
  }

  for (const rawTag of hashtags) {
    const tag =
      typeof rawTag === "string" ? rawTag.trim().replace(/^#/, "").toLowerCase() : "";
    if (!tag) continue;
    await invalidateMatchingFeedCache((key) =>
      key.includes(":hashtag:") && key.includes(`:${tag}:`)
    );
  }

  void segmentKey;
}

async function getCacheStats() {
  const now = nowMs();
  let totalEntries = 0;
  let feedEntries = 0;
  let expiredPending = 0;
  const feedByKind = {};

  for (const [key, entry] of memoryCache.entries()) {
    totalEntries += 1;
    if (entry.expiresAt <= now) {
      expiredPending += 1;
    }
    if (key === "feed" || key.startsWith("feed:")) {
      feedEntries += 1;
      const kind = key.split(":")[1] ?? "unknown";
      feedByKind[kind] = (feedByKind[kind] ?? 0) + 1;
    }
  }

  const redis = await getRedisClient();
  let redisKeys = null;
  if (redis) {
    try {
      redisKeys = await redis.dbSize();
    } catch {
      redisKeys = null;
    }
  }

  return {
    backend: redis ? "redis" : "memory",
    redisStatus: getRedisStatus(),
    redisKeys,
    memoryEntries: totalEntries,
    totalEntries,
    feedEntries,
    expiredPending,
    feedByKind,
    ttlMs: {
      default: CACHE_TTL_MS,
      recent: FEED_RECENT_TTL_MS,
      explore: FEED_EXPLORE_TTL_MS,
      following: FEED_FOLLOWING_TTL_MS,
      author: FEED_AUTHOR_TTL_MS,
      hashtag: FEED_HASHTAG_TTL_MS,
      saved: FEED_SAVED_TTL_MS,
      followingAuthors: FOLLOWING_AUTHORS_TTL_MS,
    },
  };
}

module.exports = {
  getCached,
  setCached,
  invalidateCached,
  invalidateFeedCaches,
  invalidateFeedCachesForUser,
  invalidateFeedCachesForPost,
  invalidateMatchingFeedCache,
  invalidateFollowingAuthors,
  getFollowingAuthorsCached,
  setFollowingAuthorsCached,
  getCacheKey,
  getCacheStats,
  CACHE_TTL_MS,
  FEED_RECENT_TTL_MS,
  FEED_EXPLORE_TTL_MS,
  FEED_FOLLOWING_TTL_MS,
  FEED_AUTHOR_TTL_MS,
  FEED_HASHTAG_TTL_MS,
  FEED_SAVED_TTL_MS,
  FOLLOWING_AUTHORS_TTL_MS,
};
