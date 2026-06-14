const { checkBucketAccess } = require("./storageGcs");

const STORAGE_BUCKET =
  process.env.FIREBASE_STORAGE_BUCKET ||
  "myrankapp-d62b9.firebasestorage.app";

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
  checkAuthApi,
  checkFirestoreApi,
  checkStorageApi,
};
