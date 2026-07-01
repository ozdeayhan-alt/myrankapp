const crypto = require("crypto");
const https = require("https");
const path = require("path");
const { GoogleAuth } = require("google-auth-library");
const { request } = require("gaxios");

const serviceAccount = require(path.join(__dirname, "../../service-account.json"));

let authClientPromise = null;

function getAuthClient() {
  if (!authClientPromise) {
    authClientPromise = new GoogleAuth({
      credentials: serviceAccount,
      scopes: ["https://www.googleapis.com/auth/devstorage.read_write"],
    });
  }
  return authClientPromise;
}

async function getAccessToken() {
  const auth = getAuthClient();
  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  const token =
    typeof tokenResponse === "string"
      ? tokenResponse
      : tokenResponse?.token ?? null;

  if (!token) {
    throw new Error("GCS access token alınamadı");
  }

  return token;
}

function formatGcsError(error) {
  const apiMessage = error?.response?.data?.error?.message;
  if (apiMessage) {
    return apiMessage;
  }
  return error?.message ?? "Storage upload failed";
}

async function gcsRequest(options) {
  try {
    return await request({
      ...options,
      agent: https.globalAgent,
      validateStatus: (status) => status >= 200 && status < 300,
    });
  } catch (error) {
    throw new Error(formatGcsError(error));
  }
}

function buildMultipartBody({ boundary, objectPath, buffer, contentType, downloadToken }) {
  const metadata = JSON.stringify({
    name: objectPath,
    contentType: contentType || "application/octet-stream",
    metadata: {
      firebaseStorageDownloadTokens: downloadToken,
    },
  });

  return Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`
    ),
    Buffer.from(
      `--${boundary}\r\nContent-Type: ${contentType || "application/octet-stream"}\r\n\r\n`
    ),
    buffer,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
}

async function uploadBuffer({ bucket, objectPath, buffer, contentType }) {
  const token = await getAccessToken();
  const downloadToken = crypto.randomBytes(16).toString("hex");
  const encodedName = encodeURIComponent(objectPath);
  const resolvedContentType = contentType || "application/octet-stream";
  const boundary = `myrank-${crypto.randomBytes(12).toString("hex")}`;

  await gcsRequest({
    url: `https://storage.googleapis.com/upload/storage/v1/b/${bucket}/o`,
    method: "POST",
    params: { uploadType: "multipart" },
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    data: buildMultipartBody({
      boundary,
      objectPath,
      buffer,
      contentType: resolvedContentType,
      downloadToken,
    }),
    timeout: 60000,
  });

  return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodedName}?alt=media&token=${downloadToken}`;
}

async function checkBucketAccess(bucket) {
  const token = await getAccessToken();
  await gcsRequest({
    url: `https://storage.googleapis.com/storage/v1/b/${bucket}`,
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
    timeout: 10000,
  });
}

const SIGN_URL_EXPIRY_MS = 15 * 60 * 1000;
const MESSAGE_READ_URL_EXPIRY_MS = 60 * 60 * 1000;

function buildFirebaseDownloadURL(bucket, objectPath, downloadToken) {
  const encodedName = encodeURIComponent(objectPath);
  return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodedName}?alt=media&token=${downloadToken}`;
}

/**
 * GCS v4 signed PUT URL — yalnızca Content-Type imzalanır (Android uyumluluğu).
 * İndirme token'ı yükleme sonrası finalizeUploadedObject ile yazılır.
 */
async function createSignedUploadUrl({ bucket, objectPath, contentType }) {
  const admin = require("../../firebase-config");
  const resolvedContentType = contentType || "application/octet-stream";
  const bucketRef = admin.storage().bucket(bucket);
  const file = bucketRef.file(objectPath);

  const [signedUrl] = await file.getSignedUrl({
    version: "v4",
    action: "write",
    expires: Date.now() + SIGN_URL_EXPIRY_MS,
    contentType: resolvedContentType,
  });

  return {
    signedUrl,
    storagePath: objectPath,
    uploadHeaders: {
      "Content-Type": resolvedContentType,
    },
    expiresInSeconds: Math.floor(SIGN_URL_EXPIRY_MS / 1000),
  };
}

/**
 * GCS v4 signed read URL — private message media (Storage rules deny public read).
 */
async function createSignedReadUrl({
  bucket,
  objectPath,
  expiresMs = MESSAGE_READ_URL_EXPIRY_MS,
}) {
  const admin = require("../../firebase-config");
  const bucketRef = admin.storage().bucket(bucket);
  const file = bucketRef.file(objectPath);

  const [signedUrl] = await file.getSignedUrl({
    version: "v4",
    action: "read",
    expires: Date.now() + expiresMs,
  });

  return signedUrl;
}

/**
 * İstemci PUT sonrası: Firebase download token metadata + public cache ayarlanır.
 */
async function finalizeUploadedObject({ bucket, objectPath, contentType }) {
  const admin = require("../../firebase-config");
  const downloadToken = crypto.randomBytes(16).toString("hex");
  const resolvedContentType = contentType || "application/octet-stream";
  const bucketRef = admin.storage().bucket(bucket);
  const file = bucketRef.file(objectPath);

  const [exists] = await file.exists();
  if (!exists) {
    throw new Error("Yüklenen dosya Storage'da bulunamadı");
  }

  await file.setMetadata({
    contentType: resolvedContentType,
    cacheControl: "public, max-age=31536000, immutable",
    metadata: {
      firebaseStorageDownloadTokens: downloadToken,
    },
  });

  return {
    downloadURL: buildFirebaseDownloadURL(bucket, objectPath, downloadToken),
    storagePath: objectPath,
  };
}

module.exports = {
  uploadBuffer,
  checkBucketAccess,
  createSignedUploadUrl,
  createSignedReadUrl,
  finalizeUploadedObject,
  buildFirebaseDownloadURL,
  MESSAGE_READ_URL_EXPIRY_MS,
};
