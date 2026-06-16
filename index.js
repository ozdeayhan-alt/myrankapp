require("dotenv").config();

const path = require("path");
const { configureNetworkDns } = require("./src/lib/configureNetworkDns");
configureNetworkDns();

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
const admin = require("./firebase-config");
const { db } = require("./src/lib/firestore");
const {
  checkAuthApi,
  checkFirestoreApi,
  checkStorageApi,
} = require("./src/lib/healthChecks");
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
const { registerLegalRoutes } = require("./src/legal/routes");
const {
  apiRateLimit,
  writeRateLimit,
  uploadRateLimit,
} = require("./src/lib/rateLimit");

const app = express();
const PORT = process.env.PORT || 3000;
const API_TIMEOUT_MS = Number(process.env.API_TIMEOUT_MS) || 25000;

app.use(express.json({ limit: "25mb" }));

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
    privacyPolicy: "/privacy",
    termsOfService: "/terms",
    moderationPolicy: "/moderation",
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

app.get("/status", async (req, res) => {
  try {
    const firebaseApp = admin.app();
    const projectId =
      firebaseApp.options.credential?.projectId ||
      firebaseApp.options.projectId ||
      "unknown";

    const [auth, firestore, storage] = await Promise.all([
      checkAuthApi(admin),
      checkFirestoreApi(db),
      checkStorageApi(admin),
    ]);

    const allOk =
      auth.status === "ok" &&
      firestore.status === "ok" &&
      storage.status === "ok";

    res.json({
      status: allOk ? "ok" : "degraded",
      firebase: "connected",
      authApi: auth.status,
      firestoreApi: firestore.status,
      storageApi: storage.status,
      authError: auth.error,
      firestoreError: firestore.error,
      storageError: storage.error,
      projectId,
      timestamp: new Date().toISOString(),
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

app.listen(PORT, () => {
  console.log(`Sunucu http://localhost:${PORT} adresinde çalışıyor`);
});
