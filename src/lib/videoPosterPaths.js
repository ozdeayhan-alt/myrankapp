const path = require("path");

/**
 * Storage object path → poster JPEG path (processVideo ile aynı kural).
 */
function derivePosterObjectPath(objectPath) {
  if (!objectPath || typeof objectPath !== "string") {
    return null;
  }

  const normalized = objectPath.trim();
  if (normalized.endsWith("_poster.jpg")) {
    return normalized;
  }

  if (normalized.endsWith("_fast.mp4")) {
    return normalized.replace(/_fast\.mp4$/, "_poster.jpg");
  }

  const parsed = path.posix.parse(normalized);
  if (!parsed.dir || !parsed.name) {
    return null;
  }

  return `${parsed.dir}/${parsed.name}_poster.jpg`;
}

/**
 * Poster yoksa indirilecek MP4 yolu (_fast.mp4 tercih, yoksa orijinal).
 */
function deriveMp4ObjectPathForPoster(objectPath) {
  if (!objectPath || typeof objectPath !== "string") {
    return null;
  }

  const normalized = objectPath.trim();
  if (normalized.endsWith("_fast.mp4") || normalized.endsWith(".mp4")) {
    return normalized;
  }

  return null;
}

module.exports = {
  derivePosterObjectPath,
  deriveMp4ObjectPathForPoster,
};
