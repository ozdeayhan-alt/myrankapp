const ALLOWED_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/quicktime",
]);

const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const VIDEO_MAX_BYTES = 50 * 1024 * 1024;

function isAllowedStoragePath(storagePath, userId) {
  if (!storagePath || typeof storagePath !== "string") {
    return false;
  }
  const postsPrefix = `posts/${userId}/`;
  const profilesPrefix = `profiles/${userId}/`;
  const messagesPrefix = `messages/${userId}/`;
  return (
    storagePath.startsWith(postsPrefix) ||
    storagePath.startsWith(profilesPrefix) ||
    storagePath.startsWith(messagesPrefix)
  );
}

function sanitizePathSegment(segment) {
  return segment.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function normalizeStoragePath(storagePath) {
  return storagePath
    .split("/")
    .map(sanitizePathSegment)
    .join("/");
}

function isAllowedContentType(contentType) {
  return (
    typeof contentType === "string" &&
    ALLOWED_CONTENT_TYPES.has(contentType.trim().toLowerCase())
  );
}

function maxBytesForContentType(contentType) {
  if (contentType.startsWith("video/")) {
    return VIDEO_MAX_BYTES;
  }
  if (contentType.startsWith("image/")) {
    return IMAGE_MAX_BYTES;
  }
  return IMAGE_MAX_BYTES;
}

function validateContentLength(contentType, contentLength) {
  if (contentLength == null) {
    return null;
  }
  if (
    typeof contentLength !== "number" ||
    !Number.isFinite(contentLength) ||
    contentLength <= 0
  ) {
    return "Invalid contentLength";
  }
  const max = maxBytesForContentType(contentType);
  if (contentLength > max) {
    return `File exceeds maximum size (${max} bytes)`;
  }
  return null;
}

module.exports = {
  ALLOWED_CONTENT_TYPES,
  isAllowedStoragePath,
  normalizeStoragePath,
  isAllowedContentType,
  validateContentLength,
};
