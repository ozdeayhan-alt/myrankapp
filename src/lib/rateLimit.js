/**
 * Rate limiter with Redis backing (shared across PM2 instances).
 * Falls back to in-memory when Redis is unavailable.
 */

const { getRedisClient } = require("./redis");

const RATE_LIMIT_PREFIX =
  process.env.RATE_LIMIT_REDIS_PREFIX?.trim() || "myrank:rl:";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * POST routes that only read state (excluded from write limit bucket).
 * Still counted by the global /api limiter.
 */
const WRITE_LIMIT_SKIP_PATHS = new Set([
  "/interactions/engagements/batch",
  "/posts/mentions/resolve",
]);

function normalizePath(path) {
  if (!path || path === "/") {
    return "/";
  }
  return path.replace(/\/+$/, "") || "/";
}

function shouldSkipWriteLimit(req) {
  return WRITE_LIMIT_SKIP_PATHS.has(normalizePath(req.path));
}

/** Self-vote (core product loop) — no per-minute cap on profile TP votes to own uid. */
function shouldSkipVoteRateLimit(req) {
  const uid = req.user?.uid;
  if (!uid) {
    return false;
  }

  const path = normalizePath(req.path);
  if (path === "/profile-votes/batch" && req.body?.targetUserId === uid) {
    return true;
  }

  return false;
}

function createMemoryRateLimiter({ windowMs, max, message, methods, skip }) {
  const hits = new Map();

  function prune(now) {
    for (const [key, bucket] of hits.entries()) {
      if (now - bucket.start >= windowMs) {
        hits.delete(key);
      }
    }
  }

  return function rateLimitMiddleware(req, res, next) {
    if (methods && !methods.has(req.method)) {
      return next();
    }

    if (skip?.(req)) {
      return next();
    }

    const now = Date.now();
    prune(now);

    const userId = req.user?.uid;
    const ip =
      req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() ||
      req.socket?.remoteAddress ||
      "unknown";
    const key = userId ? `user:${userId}` : `ip:${ip}`;

    let bucket = hits.get(key);
    if (!bucket || now - bucket.start >= windowMs) {
      bucket = { start: now, count: 0 };
      hits.set(key, bucket);
    }

    bucket.count += 1;

    res.setHeader("X-RateLimit-Limit", String(max));
    res.setHeader(
      "X-RateLimit-Remaining",
      String(Math.max(0, max - bucket.count))
    );

    if (bucket.count > max) {
      return res.status(429).json({
        error: message ?? "Too many requests",
        retryAfterMs: windowMs - (now - bucket.start),
      });
    }

    return next();
  };
}

function createRateLimiter(options) {
  const memoryLimiter = createMemoryRateLimiter(options);
  const { windowMs, max, message, methods, skip } = options;

  return async function rateLimitMiddleware(req, res, next) {
    if (methods && !methods.has(req.method)) {
      return next();
    }

    if (skip?.(req)) {
      return next();
    }

    const userId = req.user?.uid;
    const ip =
      req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() ||
      req.socket?.remoteAddress ||
      "unknown";
    const key = userId ? `user:${userId}` : `ip:${ip}`;

    const redis = await getRedisClient();
    if (!redis) {
      return memoryLimiter(req, res, next);
    }

    try {
      const redisKey = `${RATE_LIMIT_PREFIX}${key}`;
      const count = await redis.incr(redisKey);
      if (count === 1) {
        await redis.pExpire(redisKey, windowMs);
      }

      res.setHeader("X-RateLimit-Limit", String(max));
      res.setHeader(
        "X-RateLimit-Remaining",
        String(Math.max(0, max - count))
      );

      if (count > max) {
        const ttl = await redis.pTTL(redisKey);
        return res.status(429).json({
          error: message ?? "Too many requests",
          retryAfterMs: ttl > 0 ? ttl : windowMs,
        });
      }

      return next();
    } catch (error) {
      console.warn("[rateLimit] redis failed, using memory:", error.message ?? error);
      try {
        return memoryLimiter(req, res, next);
      } catch (memoryError) {
        return next(memoryError);
      }
    }
  };
}

const apiRateLimit = createRateLimiter({
  windowMs: 60_000,
  max: Number(process.env.API_RATE_LIMIT_PER_MINUTE) || 180,
  message: "Çok fazla istek. Lütfen kısa süre sonra tekrar deneyin.",
});

const writeRateLimit = createRateLimiter({
  windowMs: 60_000,
  max: Number(process.env.API_WRITE_RATE_LIMIT_PER_MINUTE) || 100,
  message: "Çok fazla yazma isteği. Lütfen kısa süre sonra tekrar deneyin.",
  methods: MUTATING_METHODS,
  skip: shouldSkipWriteLimit,
});

const uploadRateLimit = createRateLimiter({
  windowMs: 60_000,
  max: Number(process.env.API_UPLOAD_RATE_LIMIT_PER_MINUTE) || 30,
  message: "Çok fazla yükleme isteği. Lütfen kısa süre sonra tekrar deneyin.",
});

/** Vote batch routes — apply after verifyAuth so req.user.uid is set. */
const voteRateLimit = createRateLimiter({
  windowMs: 60_000,
  max: Number(process.env.API_VOTE_RATE_LIMIT_PER_MINUTE) || 1200,
  message: "Çok fazla oy isteği. Lütfen kısa süre sonra tekrar deneyin.",
  skip: shouldSkipVoteRateLimit,
});

/** POST /feed/invalidate — pull-to-refresh cache bust spam koruması. */
const feedInvalidateRateLimit = createRateLimiter({
  windowMs: 60_000,
  max: Number(process.env.FEED_INVALIDATE_RATE_LIMIT_PER_MINUTE) || 10,
  message: "Çok fazla feed yenileme isteği. Lütfen kısa süre sonra tekrar deneyin.",
  methods: new Set(["POST"]),
});

module.exports = {
  createRateLimiter,
  createMemoryRateLimiter,
  normalizePath,
  shouldSkipWriteLimit,
  shouldSkipVoteRateLimit,
  MUTATING_METHODS,
  WRITE_LIMIT_SKIP_PATHS,
  apiRateLimit,
  writeRateLimit,
  uploadRateLimit,
  voteRateLimit,
  feedInvalidateRateLimit,
};
