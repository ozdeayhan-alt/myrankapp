const SLOW_REQUEST_MS = Number(process.env.API_SLOW_REQUEST_MS) || 2_000;
const startedAt = Date.now();

const stats = {
  totalRequests: 0,
  apiRequests: 0,
  errors5xx: 0,
  errors429: 0,
  slowRequests: 0,
  totalDurationMs: 0,
};

function createRequestMetricsMiddleware() {
  return function requestMetrics(req, res, next) {
    if (!req.path.startsWith("/api")) {
      return next();
    }

    stats.apiRequests += 1;
    stats.totalRequests += 1;

    const startedAtNs = process.hrtime.bigint();
    let finalized = false;

    const finalize = () => {
      if (finalized) {
        return;
      }
      finalized = true;

      const durationMs =
        Number(process.hrtime.bigint() - startedAtNs) / 1_000_000;
      stats.totalDurationMs += durationMs;

      if (res.statusCode >= 500) {
        stats.errors5xx += 1;
      }
      if (res.statusCode === 429) {
        stats.errors429 += 1;
      }
      if (durationMs >= SLOW_REQUEST_MS) {
        stats.slowRequests += 1;
        console.warn(
          `[api:slow] ${req.method} ${req.originalUrl} ${Math.round(durationMs)}ms ${res.statusCode}`
        );
      }
    };

    const setTimingHeader = () => {
      const durationMs =
        Number(process.hrtime.bigint() - startedAtNs) / 1_000_000;
      if (!res.headersSent) {
        res.setHeader("X-Response-Time", `${Math.round(durationMs)}ms`);
      }
    };

    for (const methodName of ["json", "send"]) {
      const original = res[methodName].bind(res);
      res[methodName] = function patchedResponse(...args) {
        setTimingHeader();
        finalize();
        return original(...args);
      };
    }

    res.on("finish", finalize);

    next();
  };
}

function getRequestMetrics() {
  const uptimeSec = Math.floor((Date.now() - startedAt) / 1000);
  const avgDurationMs =
    stats.apiRequests > 0
      ? Math.round(stats.totalDurationMs / stats.apiRequests)
      : 0;

  return {
    uptimeSec,
    slowThresholdMs: SLOW_REQUEST_MS,
    totalRequests: stats.totalRequests,
    apiRequests: stats.apiRequests,
    errors5xx: stats.errors5xx,
    errors429: stats.errors429,
    slowRequests: stats.slowRequests,
    avgDurationMs,
    memory: {
      rssMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
      heapUsedMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    },
  };
}

module.exports = {
  createRequestMetricsMiddleware,
  getRequestMetrics,
};
