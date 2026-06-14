#!/usr/bin/env node
/**
 * Mevcut follow ilişkileri için userFeeds/{followerId}/items backfill.
 * Yazar başına son 30 post (follow akışıyla aynı).
 *
 * Kullanım:
 *   node scripts/backfill-user-feeds.js --dry-run
 *   node scripts/backfill-user-feeds.js --limit=500
 *   node scripts/backfill-user-feeds.js --skip-existing
 */
require("dotenv").config();

const { db } = require("../src/lib/firestore");
const { backfillFollowerFeed } = require("../src/features/feed/userFeedService");

const PAGE_SIZE = 200;
const DEFAULT_SLEEP_MS = 50;

function parseArgs(argv) {
  let limit = Infinity;
  let dryRun = false;
  let skipExisting = false;
  let sleepMs = DEFAULT_SLEEP_MS;

  for (const arg of argv) {
    if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--skip-existing") {
      skipExisting = true;
    } else if (arg.startsWith("--limit=")) {
      limit = Number(arg.split("=")[1]) || Infinity;
    } else if (arg.startsWith("--sleep-ms=")) {
      sleepMs = Math.max(0, Number(arg.split("=")[1]) || DEFAULT_SLEEP_MS);
    }
  }

  return { limit, dryRun, skipExisting, sleepMs };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function followerHasAuthorItems(followerId, authorId) {
  const snap = await db
    .collection("userFeeds")
    .doc(followerId)
    .collection("items")
    .where("authorId", "==", authorId)
    .limit(1)
    .get();

  return !snap.empty;
}

async function main() {
  const { limit, dryRun, skipExisting, sleepMs } = parseArgs(process.argv.slice(2));

  let lastDoc = null;
  let scanned = 0;
  let processed = 0;
  let backfilledPosts = 0;
  let skipped = 0;
  let failed = 0;

  console.log(
    `Starting userFeeds backfill dryRun=${dryRun} skipExisting=${skipExisting} limit=${Number.isFinite(limit) ? limit : "all"}`
  );

  while (processed < limit) {
    let query = db.collection("follows").orderBy("__name__").limit(PAGE_SIZE);
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }

    const snap = await query.get();
    if (snap.empty) {
      break;
    }

    for (const doc of snap.docs) {
      if (processed >= limit) {
        break;
      }

      scanned += 1;
      const data = doc.data();
      const followerId =
        typeof data.followerId === "string" ? data.followerId.trim() : "";
      const targetUserId =
        typeof data.targetUserId === "string" ? data.targetUserId.trim() : "";

      if (!followerId || !targetUserId) {
        skipped += 1;
        continue;
      }

      if (skipExisting) {
        const exists = await followerHasAuthorItems(followerId, targetUserId);
        if (exists) {
          skipped += 1;
          continue;
        }
      }

      if (dryRun) {
        processed += 1;
        console.log(`[dry-run] backfill ${followerId} <- ${targetUserId}`);
        continue;
      }

      try {
        const result = await backfillFollowerFeed(followerId, targetUserId);
        backfilledPosts += result.backfilled ?? 0;
        processed += 1;

        if (result.backfilled > 0) {
          console.log(
            `backfilled ${result.backfilled} posts: ${followerId} <- ${targetUserId}`
          );
        }

        if (sleepMs > 0) {
          await sleep(sleepMs);
        }
      } catch (error) {
        failed += 1;
        console.error(
          `failed ${followerId} <- ${targetUserId}:`,
          error.message ?? error
        );
      }
    }

    lastDoc = snap.docs[snap.docs.length - 1];
    if (snap.size < PAGE_SIZE) {
      break;
    }
  }

  console.log(
    `Done. scanned=${scanned} processed=${processed} backfilledPosts=${backfilledPosts} skipped=${skipped} failed=${failed}`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
