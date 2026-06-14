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

async function objectExists(objectPath) {
  const bucket = admin.storage().bucket(getBucketName());
  const [exists] = await bucket.file(objectPath).exists();
  return exists;
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

async function generatePosterFromMp4(mp4Path, posterPath, dryRun) {
  if (dryRun) {
    return `dry-run://${posterPath}`;
  }

  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "myrank-poster-"));
  const localMp4 = path.join(tmpRoot, "source.mp4");
  const localPoster = path.join(tmpRoot, "poster.jpg");

  try {
    await downloadObjectToFileWithRetry(mp4Path, localMp4);
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
  if (!mp4Path || !posterPath) {
    return "skipped-bad-path";
  }

  const existingPosterUrl =
    typeof data.posterURL === "string" && data.posterURL.trim()
      ? data.posterURL.trim()
      : null;
  const existingPosterPath = existingPosterUrl
    ? parseFirebaseStorageUrl(existingPosterUrl)
    : null;

  if (existingPosterPath && (await objectExists(existingPosterPath))) {
    return "skipped-has-poster";
  }

  let posterURL = await resolvePosterUrlIfExists(posterPath);
  if (!posterURL) {
    if (!(await objectExists(mp4Path))) {
      return "skipped-mp4-missing";
    }
    posterURL = await generatePosterFromMp4(mp4Path, posterPath, dryRun);
  }

  if (!dryRun) {
    await doc.ref.set({ posterURL }, { merge: true });
  }

  return dryRun ? "dry-run-updated" : "updated";
}

async function main() {
  const { limit, dryRun } = parseArgs(process.argv.slice(2));
  console.log(`[backfill-posters] limit=${limit} dryRun=${dryRun}`);

  const snap = await db
    .collection("posts")
    .where("contentType", "==", "video")
    .limit(limit)
    .get();

  const counts = {};

  for (const doc of snap.docs) {
    try {
      const result = await backfillPost(doc, dryRun);
      counts[result] = (counts[result] || 0) + 1;
      if (result === "updated" || result === "dry-run-updated") {
        console.log(`${dryRun ? "[dry-run] " : ""}${doc.id} → poster ok`);
      }
    } catch (error) {
      counts.error = (counts.error || 0) + 1;
      console.warn(`[backfill-posters] ${doc.id} failed:`, error.message);
    }
  }

  console.log("[backfill-posters] summary", counts, `scanned=${snap.size}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
