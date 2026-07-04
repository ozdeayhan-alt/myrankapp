require("dotenv").config();

const path = require("path");
const { configureNetworkDns } = require("./src/lib/configureNetworkDns");
configureNetworkDns();

const compression = require("compression");
const express = require("express");

const MOBILE_APK_PATH = path.join(
  __dirname,
  "public",
  "myrank-test.apk",
);
const MOBILE_PREVIEW_APK_PATH = path.join(
  __dirname,
  "public",
  "myrank-preview.apk",
);
const MOBILE_DEV_APK_PATH = path.join(__dirname, "public", "myrank-dev.apk");
const MOBILE_RELEASE_AAB_PATH = path.join(
  __dirname,
  "public",
  "myrank-release.aab",
);
const admin = require("./firebase-config");
const { db } = require("./src/lib/firestore");
const {
  checkAuthApi,
  checkFirestoreApi,
  checkStorageApi,
  checkMediaProxy,
} = require("./src/lib/healthChecks");
const { getRedisClient, getRedisStatus, isRedisRequired, closeRedis } = require("./src/lib/redis");
const rankingRoutes = require("./src/features/ranking/api/routes");
const profileRoutes = require("./src/features/profile/api/routes");
const uploadRoutes = require("./src/features/uploads/api/routes");
const postsRoutes = require("./src/features/posts/api/routes");
const followsRoutes = require("./src/features/follows/api/routes");
const messagesRoutes = require("./src/features/messages/api/routes");
const feedRoutes = require("./src/features/feed/api/routes");
const searchRoutes = require("./src/features/search/api/routes");
const pushRoutes = require("./src/features/push/api/routes");
const blocksRoutes = require("./src/features/blocks/api/routes");
const accountRoutes = require("./src/features/account/api/routes");
const storiesRoutes = require("./src/features/stories/api/routes");
const notificationsRoutes = require("./src/features/notifications/api/routes");
const duelRoutes = require("./src/features/duel/api/routes");
const { registerLegalRoutes } = require("./src/legal/routes");
const {
  apiRateLimit,
  writeRateLimit,
  uploadRateLimit,
} = require("./src/lib/rateLimit");
const { createRequestMetricsMiddleware, getRequestMetrics } = require("./src/lib/requestMetrics");
const { getCacheStats } = require("./src/features/feed/feedCache");

function isStatusDetailAuthorized(req) {
  const secret = process.env.STATUS_SECRET?.trim();
  if (!secret) {
    return false;
  }

  const header = req.headers["x-status-secret"]?.toString().trim();
  return Boolean(header && header === secret);
}

const app = express();
const PORT = process.env.PORT || 3000;
const API_TIMEOUT_MS = Number(process.env.API_TIMEOUT_MS) || 25000;

void getRedisClient();

app.use(
  compression({
    threshold: 1024,
    filter: (req, res) => {
      if (req.headers["x-no-compression"]) {
        return false;
      }
      return compression.filter(req, res);
    },
  })
);
app.use(express.json({ limit: "25mb" }));

app.use(createRequestMetricsMiddleware());
app.use("/api", apiRateLimit);
app.use("/api", (req, res, next) => {
  res.setTimeout(API_TIMEOUT_MS, () => {
    if (!res.headersSent) {
      res.status(504).json({ error: "Request timeout" });
    }
  });
  next();
});

app.get("/", (req, res) => {
  res.json({
    message: "myrankapp API çalışıyor",
    mobileApk: "/download/myrank.apk",
    mobilePreviewApk: "/download/myrank-preview.apk",
    mobileDevApk: "/download/myrank-dev.apk",
    mobileReleaseAab: "/download/myrank-release.aab",
    privacyPolicy: "/privacy",
    termsOfService: "/terms",
    moderationPolicy: "/moderation",
    childSafetyPolicy: "/child-safety",
  });
});

registerLegalRoutes(app);

app.get("/download/myrank-preview.apk", (req, res) => {
  res.download(MOBILE_PREVIEW_APK_PATH, "myrank-preview.apk", (err) => {
    if (err && !res.headersSent) {
      res.status(404).json({ error: "Preview APK bulunamadı" });
    }
  });
});

app.get("/download/myrank.apk", (req, res) => {
  res.download(MOBILE_APK_PATH, "myrank-test.apk", (err) => {
    if (err && !res.headersSent) {
      res.status(404).json({ error: "APK bulunamadı" });
    }
  });
});

app.get("/download/myrank-dev.apk", (req, res) => {
  res.download(MOBILE_DEV_APK_PATH, "myrank-dev.apk", (err) => {
    if (err && !res.headersSent) {
      res.status(404).json({ error: "Dev client APK bulunamadı" });
    }
  });
});

app.get("/download/myrank-release.aab", (req, res) => {
  res.download(MOBILE_RELEASE_AAB_PATH, "myrank-release.aab", (err) => {
    if (err && !res.headersSent) {
      res.status(404).json({ error: "Release AAB bulunamadı" });
    }
  });
});

app.get("/status", async (req, res) => {
  try {
    const firebaseApp = admin.app();
    const projectId =
      firebaseApp.options.credential?.projectId ||
      firebaseApp.options.projectId ||
      "unknown";

    const [auth, firestore, storage, mediaProxy, feedCache] = await Promise.all([
      checkAuthApi(admin),
      checkFirestoreApi(db),
      checkStorageApi(admin),
      checkMediaProxy(),
      getCacheStats(),
    ]);

    const redisOk = !isRedisRequired() || getRedisStatus() === "connected";

    const allOk =
      auth.status === "ok" &&
      firestore.status === "ok" &&
      storage.status === "ok" &&
      mediaProxy.status === "ok" &&
      redisOk;

    if (!isStatusDetailAuthorized(req)) {
      return res.json({
        status: allOk ? "ok" : "degraded",
        timestamp: new Date().toISOString(),
      });
    }

    res.json({
      status: allOk ? "ok" : "degraded",
      firebase: "connected",
      authApi: auth.status,
      firestoreApi: firestore.status,
      storageApi: storage.status,
      mediaProxy: mediaProxy.status,
      mediaProxyCacheStatus: mediaProxy.cacheStatus,
      redisStatus: getRedisStatus(),
      authError: auth.error,
      firestoreError: firestore.error,
      storageError: storage.error,
      mediaProxyError: mediaProxy.error,
      projectId,
      timestamp: new Date().toISOString(),
      metrics: getRequestMetrics(),
      feedCache,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      firebase: "disconnected",
      message: error.message,
    });
  }
});

app.use("/api", rankingRoutes);
app.use("/api", profileRoutes);
app.use("/api", uploadRoutes);
app.use("/api", postsRoutes);
app.use("/api", followsRoutes);
app.use("/api", messagesRoutes);
app.use("/api", feedRoutes);
app.use("/api", searchRoutes);
app.use("/api", pushRoutes);
app.use("/api", blocksRoutes);
app.use("/api", accountRoutes);
app.use("/api", storiesRoutes);
app.use("/api", notificationsRoutes);
app.use("/api", duelRoutes);

app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }
  console.error("[api] unhandled error:", err?.message ?? err);
  res.status(500).json({ error: "Internal server error" });
});

const server = app.listen(PORT, () => {
  if (process.env.NODE_ENV !== "production") {
    console.log(`Sunucu http://localhost:${PORT} adresinde çalışıyor`);
  }
});

function shutdown(signal) {
  console.warn(`[api] ${signal} received — shutting down`);
  server.close(() => {
    void closeRedis().finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 15_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

process.on("unhandledRejection", (reason) => {
  console.error("[api] unhandledRejection:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("[api] uncaughtException:", error?.message ?? error);
  process.exit(1);
});
