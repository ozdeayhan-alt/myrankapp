const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const admin = require("../../firebase-config");
const { buildFirebaseDownloadURL } = require("./storageGcs");

const CACHE_CONTROL = "public, max-age=31536000, immutable";

function getBucketName() {
  return (
    process.env.FIREBASE_STORAGE_BUCKET ||
    "myrankapp-d62b9.firebasestorage.app"
  );
}

async function downloadObjectToFile(objectPath, destPath) {
  const bucket = admin.storage().bucket(getBucketName());
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  await bucket.file(objectPath).download({ destination: destPath });
}

async function uploadLocalFile({
  objectPath,
  localPath,
  contentType,
  cacheControl = CACHE_CONTROL,
}) {
  const bucket = admin.storage().bucket(getBucketName());
  const downloadToken = crypto.randomBytes(16).toString("hex");

  await bucket.upload(localPath, {
    destination: objectPath,
    metadata: {
      contentType,
      cacheControl,
      metadata: {
        firebaseStorageDownloadTokens: downloadToken,
      },
    },
  });

  return buildFirebaseDownloadURL(getBucketName(), objectPath, downloadToken);
}

async function uploadDirectory({
  localDir,
  remotePrefix,
  contentTypeForExt,
}) {
  const entries = fs.readdirSync(localDir, { withFileTypes: true });
  const urls = {};

  for (const entry of entries) {
    if (!entry.isFile()) continue;

    const localPath = path.join(localDir, entry.name);
    const remotePath = `${remotePrefix}/${entry.name}`;
    const ext = path.extname(entry.name).toLowerCase();
    const contentType =
      typeof contentTypeForExt === "function"
        ? contentTypeForExt(ext, entry.name)
        : "application/octet-stream";

    const url = await uploadLocalFile({
      objectPath: remotePath,
      localPath,
      contentType,
    });

    urls[entry.name] = url;
  }

  return urls;
}

async function getObjectDownloadURL(objectPath) {
  const bucket = admin.storage().bucket(getBucketName());
  const file = bucket.file(objectPath);
  const [metadata] = await file.getMetadata();
  const tokenRaw = metadata?.metadata?.firebaseStorageDownloadTokens;
  const token =
    typeof tokenRaw === "string" ? tokenRaw.split(",")[0]?.trim() : null;

  if (!token) {
    throw new Error("Storage download token bulunamadı");
  }

  return buildFirebaseDownloadURL(getBucketName(), objectPath, token);
}

async function downloadObjectToFileWithRetry(objectPath, destPath, attempts = 2) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      await downloadObjectToFile(objectPath, destPath);
      return;
    } catch (error) {
      lastError = error;
      if (attempt < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    }
  }
  throw lastError;
}

async function deleteObject(objectPath) {
  const bucket = admin.storage().bucket(getBucketName());
  await bucket.file(objectPath).delete({ ignoreNotFound: true });
}

async function deleteObjectsByPrefix(prefix) {
  const bucket = admin.storage().bucket(getBucketName());
  const [files] = await bucket.getFiles({ prefix });
  await Promise.all(
    files.map((file) => file.delete({ ignoreNotFound: true }))
  );
}

module.exports = {
  CACHE_CONTROL,
  downloadObjectToFile,
  downloadObjectToFileWithRetry,
  uploadLocalFile,
  uploadDirectory,
  getBucketName,
  getObjectDownloadURL,
  deleteObject,
  deleteObjectsByPrefix,
};
