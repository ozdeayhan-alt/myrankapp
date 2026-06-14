#!/usr/bin/env node
/**
 * Eski postlara mediaWidth/mediaHeight yazar (poster veya varsayılan 16:9).
 * Kullanım: node scripts/backfill-media-dimensions.js [--limit=200] [--dry-run]
 */
require("dotenv").config();

const { db } = require("../src/lib/firestore");

const DEFAULT_LIMIT = 200;
const DEFAULT_VIDEO_WIDTH = 1280;
const DEFAULT_VIDEO_HEIGHT = 720;
const DEFAULT_IMAGE_WIDTH = 1080;
const DEFAULT_IMAGE_HEIGHT = 1080;

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

async function main() {
  const { limit, dryRun } = parseArgs(process.argv.slice(2));

  const snap = await db
    .collection("posts")
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();

  let updated = 0;
  let skipped = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    const hasWidth =
      typeof data.mediaWidth === "number" && typeof data.mediaHeight === "number";

    if (hasWidth) {
      skipped += 1;
      continue;
    }

    const contentType = data.contentType;
    if (contentType !== "image" && contentType !== "video") {
      skipped += 1;
      continue;
    }

    const patch =
      contentType === "video"
        ? { mediaWidth: DEFAULT_VIDEO_WIDTH, mediaHeight: DEFAULT_VIDEO_HEIGHT }
        : { mediaWidth: DEFAULT_IMAGE_WIDTH, mediaHeight: DEFAULT_IMAGE_HEIGHT };

    if (!dryRun) {
      await doc.ref.set(patch, { merge: true });
    }

    updated += 1;
    console.log(`${dryRun ? "[dry-run] " : ""}updated ${doc.id} (${contentType})`);
  }

  console.log(`Done. updated=${updated} skipped=${skipped} scanned=${snap.size}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
