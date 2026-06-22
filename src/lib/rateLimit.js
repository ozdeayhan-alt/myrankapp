/**
 * Lightweight in-memory rate limiter (per key / window).
 * Suitable for single-instance PM2; resets on process restart.
 */

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

function createRateLimiter({ windowMs, max, message, methods, skip }) {
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
  max: Number(process.env.API_VOTE_RATE_LIMIT_PER_MINUTE) || 20,
  message: "Çok fazla oy isteği. Lütfen kısa süre sonra tekrar deneyin.",
});

module.exports = {
  createRateLimiter,
  normalizePath,
  shouldSkipWriteLimit,
  MUTATING_METHODS,
  WRITE_LIMIT_SKIP_PATHS,
  apiRateLimit,
  writeRateLimit,
  uploadRateLimit,
  voteRateLimit,
};
