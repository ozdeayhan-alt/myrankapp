const { parseFirebaseStorageUrl } = require("../features/posts/parseFirebaseStorageUrl");

const DEFAULT_MEDIA_PROXY_ORIGIN = "https://myrank.com.tr";

function getAllowedMediaProxyOrigins() {
  const origins = new Set([DEFAULT_MEDIA_PROXY_ORIGIN]);
  const configured = process.env.MEDIA_PROXY_ORIGIN?.trim();
  if (configured) {
    origins.add(configured.replace(/\/+$/, ""));
  }
  const staging = process.env.STAGING_MEDIA_PROXY_ORIGIN?.trim();
  if (staging) {
    origins.add(staging.replace(/\/+$/, ""));
  }
  return origins;
}

function isFirebaseStorageMediaUrl(url) {
  return Boolean(parseFirebaseStorageUrl(url));
}

function isProxiedFirebaseMediaUrl(url) {
  try {
    const parsed = new URL(url);
    const origin = `${parsed.protocol}//${parsed.host}`;
    if (!getAllowedMediaProxyOrigins().has(origin)) {
      return false;
    }
    return parsed.pathname.startsWith("/fb-media/v0/b/");
  } catch {
    return false;
  }
}

function isAllowedMediaURL(url) {
  if (!url || typeof url !== "string") {
    return false;
  }
  const trimmed = url.trim();
  if (!/^https:\/\//i.test(trimmed)) {
    return false;
  }
  return isFirebaseStorageMediaUrl(trimmed) || isProxiedFirebaseMediaUrl(trimmed);
}

function assertAllowedMediaURL(url, label = "mediaURL") {
  if (!url || typeof url !== "string" || !url.trim()) {
    const error = new Error(`${label} gerekli`);
    error.statusCode = 400;
    throw error;
  }
  const trimmed = url.trim();
  if (!isAllowedMediaURL(trimmed)) {
    const error = new Error("Geçersiz medya adresi");
    error.statusCode = 400;
    throw error;
  }
  return trimmed;
}

module.exports = {
  isAllowedMediaURL,
  assertAllowedMediaURL,
};
