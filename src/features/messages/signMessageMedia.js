const { parseFirebaseStorageUrl } = require("../posts/parseFirebaseStorageUrl");
const { createSignedReadUrl } = require("../../lib/storageGcs");

function parseStorageObjectPath(url) {
  const firebasePath = parseFirebaseStorageUrl(url);
  if (firebasePath) {
    return firebasePath;
  }

  try {
    const parsed = new URL(url);
    const proxyMatch = parsed.pathname.match(/\/fb-media\/v0\/b\/[^/]+\/o\/(.+)$/);
    if (proxyMatch?.[1]) {
      return decodeURIComponent(proxyMatch[1]);
    }
  } catch {
    return null;
  }

  return null;
}

function isMessageStoragePath(url) {
  const objectPath = parseStorageObjectPath(url);
  return Boolean(objectPath && objectPath.startsWith("messages/"));
}

async function signMessageMediaUrl(url, bucket) {
  if (!url || typeof url !== "string") {
    return url;
  }

  const trimmed = url.trim();
  const objectPath = parseStorageObjectPath(trimmed);
  if (!objectPath || !objectPath.startsWith("messages/")) {
    return trimmed;
  }

  return createSignedReadUrl({ bucket, objectPath });
}

async function signMessageMediaFields(message, bucket) {
  const next = { ...message };

  if (next.mediaURL) {
    next.mediaURL = await signMessageMediaUrl(next.mediaURL, bucket);
  }
  if (next.posterURL) {
    next.posterURL = await signMessageMediaUrl(next.posterURL, bucket);
  }

  return next;
}

module.exports = {
  parseStorageObjectPath,
  isMessageStoragePath,
  signMessageMediaUrl,
  signMessageMediaFields,
};
