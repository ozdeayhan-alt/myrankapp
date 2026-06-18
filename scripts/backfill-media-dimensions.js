#!/usr/bin/env node
/**
 * Eski postlara mediaWidth/mediaHeight yazar.
 *
 * Kullanım:
 *   node scripts/backfill-media-dimensions.js --dry-run
 *   node scripts/backfill-media-dimensions.js --limit=500
 *   node scripts/backfill-media-dimensions.js --all
 */
require("dotenv").config();

const { db } = require("../src/lib/firestore");

const PAGE_SIZE = 200;
const DEFAULT_LIMIT = 500;
const DEFAULT_VIDEO_WIDTH = 1280;
const DEFAULT_VIDEO_HEIGHT = 720;
const DEFAULT_IMAGE_WIDTH = 1080;
const DEFAULT_IMAGE_HEIGHT = 1080;

function parseArgs(argv) {
  let limit = DEFAULT_LIMIT;
  let dryRun = false;
  let all = false;

  for (const arg of argv) {
    if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--all") {
      all = true;
      limit = Infinity;
    } else if (arg.startsWith("--limit=")) {
      limit = Number(arg.split("=")[1]) || DEFAULT_LIMIT;
    }
  }

  return { limit, dryRun, all };
}

function dimensionsForContentType(contentType) {
  if (contentType === "video") {
    return {
      mediaWidth: DEFAULT_VIDEO_WIDTH,
      mediaHeight: DEFAULT_VIDEO_HEIGHT,
    };
  }
  if (contentType === "image") {
    return {
      mediaWidth: DEFAULT_IMAGE_WIDTH,
      mediaHeight: DEFAULT_IMAGE_HEIGHT,
    };
  }
  return null;
}

async function main() {
  const { limit, dryRun } = parseArgs(process.argv.slice(2));

  let lastDoc = null;
  let updated = 0;
  let skipped = 0;
  let scanned = 0;

  while (scanned < limit) {
    const pageSize = Math.min(PAGE_SIZE, limit - scanned);
    let query = db
      .collection("posts")
      .orderBy("createdAt", "desc")
      .limit(pageSize);

    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }

    const snap = await query.get();
    if (snap.empty) {
      break;
    }

    for (const doc of snap.docs) {
      scanned += 1;
      const data = doc.data();
      const hasWidth =
        typeof data.mediaWidth === "number" &&
        typeof data.mediaHeight === "number";

      if (hasWidth) {
        skipped += 1;
        continue;
      }

      const patch = dimensionsForContentType(data.contentType);
      if (!patch) {
        skipped += 1;
        continue;
      }

      if (!dryRun) {
        await doc.ref.set(patch, { merge: true });
      }

      updated += 1;
      console.log(
        `${dryRun ? "[dry-run] " : ""}updated ${doc.id} (${data.contentType})`
      );
    }

    lastDoc = snap.docs[snap.docs.length - 1];
    if (snap.size < pageSize) {
      break;
    }
  }

  console.log(
    `Done. updated=${updated} skipped=${skipped} scanned=${scanned} dryRun=${dryRun}`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
