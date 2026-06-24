const { checkBucketAccess } = require("./storageGcs");

const STORAGE_BUCKET =
  process.env.FIREBASE_STORAGE_BUCKET ||
  "myrankapp-d62b9.firebasestorage.app";

const MEDIA_PROXY_ORIGIN =
  process.env.MEDIA_PROXY_ORIGIN?.trim() || "https://myrank.com.tr";

const MEDIA_PROXY_HEALTH_PATH =
  process.env.MEDIA_PROXY_HEALTH_PATH?.trim() ||
  "/fb-media/v0/b/myrankapp-d62b9.firebasestorage.app/o/profiles%2Fhealth-check.txt?alt=media";

async function checkMediaProxy() {
  const url = `${MEDIA_PROXY_ORIGIN.replace(/\/+$/, "")}${MEDIA_PROXY_HEALTH_PATH}`;
  const timeoutMs = Number(process.env.MEDIA_PROXY_HEALTH_TIMEOUT_MS) || 5_000;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: "HEAD",
        signal: controller.signal,
      });

      const cacheStatus = response.headers.get("x-cache-status");
      const reachable =
        response.ok ||
        response.status === 404 ||
        response.status === 403 ||
        response.status === 206;

      return {
        status: reachable ? "ok" : "error",
        url,
        httpStatus: response.status,
        cacheStatus,
        error: reachable ? null : { message: `Unexpected status ${response.status}` },
      };
    } finally {
      clearTimeout(timer);
    }
  } catch (error) {
    return {
      status: "error",
      url,
      httpStatus: null,
      cacheStatus: null,
      error: {
        message: error.message ?? String(error),
      },
    };
  }
}

async function checkAuthApi(admin) {
  try {
    await admin.auth().listUsers(1);
    return { status: "ok", error: null };
  } catch (error) {
    return {
      status: "error",
      error: {
        code: error?.code ?? "unknown",
        message: error?.message ?? String(error),
      },
    };
  }
}

async function checkFirestoreApi(db) {
  try {
    await db.collection("posts").limit(1).get();
    return { status: "ok", error: null };
  } catch (error) {
    return {
      status: "error",
      error: {
        code: error?.code ?? "unknown",
        message: error?.message ?? String(error),
      },
    };
  }
}

async function checkStorageApi(_admin) {
  try {
    await checkBucketAccess(STORAGE_BUCKET);
    return { status: "ok", bucket: STORAGE_BUCKET, error: null };
  } catch (error) {
    return {
      status: "error",
      bucket: STORAGE_BUCKET,
      error: {
        code: error?.code ?? "unknown",
        message: error?.message ?? String(error),
      },
    };
  }
}

module.exports = {
  STORAGE_BUCKET,
  MEDIA_PROXY_ORIGIN,
  checkAuthApi,
  checkFirestoreApi,
  checkStorageApi,
  checkMediaProxy,
};
