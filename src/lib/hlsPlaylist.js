const fs = require("fs");
const path = require("path");

/**
 * Firebase Storage public read — token olmadan ?alt=media indirme.
 */
function buildPublicFirebaseMediaUrl(bucket, objectPath) {
  const encodedName = encodeURIComponent(objectPath);
  return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodedName}?alt=media`;
}

/**
 * HLS playlist içindeki göreli segment adlarını mutlak Firebase URL'lerine çevirir.
 * expo-video / native player segment isteklerinde ?alt=media gerektirir.
 */
function rewriteHlsPlaylistAbsolute(localPlaylistPath, remotePrefix, bucket) {
  const raw = fs.readFileSync(localPlaylistPath, "utf8");
  const rewritten = raw
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        return line;
      }

      const segmentName = path.posix.basename(trimmed);
      const objectPath = `${remotePrefix}/${segmentName}`;
      return buildPublicFirebaseMediaUrl(bucket, objectPath);
    })
    .join("\n");

  fs.writeFileSync(localPlaylistPath, rewritten, "utf8");
  return buildPublicFirebaseMediaUrl(bucket, `${remotePrefix}/master.m3u8`);
}

module.exports = {
  buildPublicFirebaseMediaUrl,
  rewriteHlsPlaylistAbsolute,
};
