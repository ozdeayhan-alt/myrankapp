#!/usr/bin/env node
/**
 * posterURL eksik video postları için JPEG poster üretir ve Firestore günceller.
 * Kullanım: node scripts/backfill-video-posters.js [--limit=500] [--dry-run]
 */
require("dotenv").config();

const fs = require("fs");
const os = require("os");
const path = require("path");
const admin = require("../firebase-config");
const { db } = require("../src/lib/firestore");
const { parseFirebaseStorageUrl } = require("../src/features/posts/parseFirebaseStorageUrl");
const { extractPosterJpeg } = require("../src/lib/videoTranscode");
const {
  derivePosterObjectPath,
  deriveMp4ObjectPathForPoster,
} = require("../src/lib/videoPosterPaths");
const {
  downloadObjectToFileWithRetry,
  uploadLocalFile,
  getBucketName,
} = require("../src/lib/storageMedia");
const { LEGACY_STORAGE_BUCKET, normalizeStoragePhotoUrl } = require("../src/lib/normalizeStoragePhotoUrl");

const DEFAULT_LIMIT = 500;

function parseArgs(argv) {
  let limit = DEFAULT_LIMIT;
  let dryRun = false;

  for (const arg of argv) {
    if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg.startsWith("--limit=")) {
      limit = Number(arg.split("=")[1]) || DEFAULT_LIMIT;
    }
  }

  return { limit, dryRun };
}

async function objectExistsInBucket(bucketName, objectPath) {
  const bucket = admin.storage().bucket(bucketName);
  const [exists] = await bucket.file(objectPath).exists();
  return exists;
}

async function objectExists(objectPath) {
  return objectExistsInBucket(getBucketName(), objectPath);
}

async function resolveMp4PathForPoster(mediaObjectPath) {
  const mp4Path = deriveMp4ObjectPathForPoster(mediaObjectPath);
  if (!mp4Path) {
    return null;
  }

  if (await objectExists(mp4Path)) {
    return mp4Path;
  }

  if (await objectExistsInBucket(LEGACY_STORAGE_BUCKET, mp4Path)) {
    return { bucket: LEGACY_STORAGE_BUCKET, objectPath: mp4Path };
  }

  if (mediaObjectPath.endsWith(".mp4") && (await objectExists(mediaObjectPath))) {
    return mediaObjectPath;
  }

  if (
    mediaObjectPath.endsWith(".mp4") &&
    (await objectExistsInBucket(LEGACY_STORAGE_BUCKET, mediaObjectPath))
  ) {
    return { bucket: LEGACY_STORAGE_BUCKET, objectPath: mediaObjectPath };
  }

  return null;
}

async function resolvePosterUrlIfExists(posterPath) {
  if (!(await objectExists(posterPath))) {
    return null;
  }

  const bucket = admin.storage().bucket(getBucketName());
  const file = bucket.file(posterPath);
  const [metadata] = await file.getMetadata();
  const tokenRaw = metadata?.metadata?.firebaseStorageDownloadTokens;
  const token =
    typeof tokenRaw === "string" ? tokenRaw.split(",")[0]?.trim() : null;
  const bucketName = getBucketName();
  const encoded = encodeURIComponent(posterPath);

  if (token) {
    return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encoded}?alt=media&token=${token}`;
  }

  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encoded}?alt=media`;
}

async function generatePosterFromMp4(mp4Source, posterPath, dryRun) {
  if (dryRun) {
    return `dry-run://${posterPath}`;
  }

  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "myrank-poster-"));
  const localMp4 = path.join(tmpRoot, "source.mp4");
  const localPoster = path.join(tmpRoot, "poster.jpg");

  try {
    if (typeof mp4Source === "string") {
      await downloadObjectToFileWithRetry(mp4Source, localMp4);
    } else {
      const bucket = admin.storage().bucket(mp4Source.bucket);
      fs.mkdirSync(path.dirname(localMp4), { recursive: true });
      await bucket.file(mp4Source.objectPath).download({ destination: localMp4 });
    }
    await extractPosterJpeg(localMp4, localPoster);
    return uploadLocalFile({
      objectPath: posterPath,
      localPath: localPoster,
      contentType: "image/jpeg",
    });
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
}

async function backfillPost(doc, dryRun) {
  const data = doc.data();
  if (data.contentType !== "video") {
    return "skipped-not-video";
  }

  const mediaObjectPath = parseFirebaseStorageUrl(data.mediaURL);
  if (!mediaObjectPath) {
    return "skipped-no-media-path";
  }

  const mp4Path = deriveMp4ObjectPathForPoster(mediaObjectPath);
  const posterPath = derivePosterObjectPath(mediaObjectPath);
  if (!posterPath) {
    return "skipped-bad-path";
  }
  void mp4Path;

  const existingPosterUrl =
    typeof data.posterURL === "string" && data.posterURL.trim()
      ? data.posterURL.trim()
      : null;
  const existingPosterPath = existingPosterUrl
    ? parseFirebaseStorageUrl(existingPosterUrl)
    : null;

  if (existingPosterPath && (await objectExists(existingPosterPath))) {
    const normalized = normalizeStoragePhotoUrl(existingPosterUrl);
    if (normalized.changed) {
      const refreshed = await resolvePosterUrlIfExists(existingPosterPath);
      if (refreshed && !dryRun) {
        await doc.ref.set({ posterURL: refreshed }, { merge: true });
      }
      return normalized.changed ? "updated-url" : "skipped-has-poster";
    }
    return "skipped-has-poster";
  }

  let posterURL = await resolvePosterUrlIfExists(posterPath);
  if (!posterURL) {
    const mp4Source = await resolveMp4PathForPoster(mediaObjectPath);
    if (!mp4Source) {
      return "skipped-mp4-missing";
    }
    posterURL = await generatePosterFromMp4(mp4Source, posterPath, dryRun);
  }

  if (!dryRun) {
    await doc.ref.set({ posterURL }, { merge: true });
  }

  return dryRun ? "dry-run-updated" : "updated";
}

async function main() {
  const { limit, dryRun } = parseArgs(process.argv.slice(2));
  console.log(`[backfill-posters] limit=${limit} dryRun=${dryRun}`);

  const counts = {};
  let lastId = null;
  let scanned = 0;

  while (scanned < limit) {
    let query = db
      .collection("posts")
      .where("contentType", "==", "video")
      .orderBy("__name__")
      .limit(Math.min(100, limit - scanned));

    if (lastId) {
      query = query.startAfter(lastId);
    }

    const snap = await query.get();
    if (snap.empty) {
      break;
    }

    for (const doc of snap.docs) {
      try {
        const result = await backfillPost(doc, dryRun);
        counts[result] = (counts[result] || 0) + 1;
        if (
          result === "updated" ||
          result === "updated-url" ||
          result === "dry-run-updated"
        ) {
          console.log(`${dryRun ? "[dry-run] " : ""}${doc.id} → ${result}`);
        }
      } catch (error) {
        counts.error = (counts.error || 0) + 1;
        console.warn(`[backfill-posters] ${doc.id} failed:`, error.message);
      }
    }

    scanned += snap.size;
    lastId = snap.docs[snap.docs.length - 1];
    if (snap.size < 100) {
      break;
    }
  }

  console.log("[backfill-posters] summary", counts, `scanned=${scanned}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
