#!/usr/bin/env node
/**
 * userFeeds kapsamını örnekler; eksik takip ilişkilerini raporlar.
 *
 * Kullanım:
 *   node scripts/audit-user-feeds.js
 *   node scripts/audit-user-feeds.js --limit=1000
 */
require("dotenv").config();

const { db } = require("../src/lib/firestore");

const PAGE_SIZE = 200;
const DEFAULT_LIMIT = 500;

function parseArgs(argv) {
  let limit = DEFAULT_LIMIT;

  for (const arg of argv) {
    if (arg.startsWith("--limit=")) {
      limit = Number(arg.split("=")[1]) || DEFAULT_LIMIT;
    }
  }

  return { limit };
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
  const { limit } = parseArgs(process.argv.slice(2));

  let lastDoc = null;
  let scanned = 0;
  let withFeed = 0;
  let missingFeed = 0;
  const missingSamples = [];

  while (scanned < limit) {
    const pageSize = Math.min(PAGE_SIZE, limit - scanned);
    let query = db.collection("follows").orderBy("__name__").limit(pageSize);
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
      const followerId =
        typeof data.followerId === "string" ? data.followerId.trim() : "";
      const targetUserId =
        typeof data.targetUserId === "string" ? data.targetUserId.trim() : "";

      if (!followerId || !targetUserId) {
        continue;
      }

      const hasItems = await followerHasAuthorItems(followerId, targetUserId);
      if (hasItems) {
        withFeed += 1;
      } else {
        missingFeed += 1;
        if (missingSamples.length < 20) {
          missingSamples.push(`${followerId} <- ${targetUserId}`);
        }
      }
    }

    lastDoc = snap.docs[snap.docs.length - 1];
    if (snap.size < pageSize) {
      break;
    }
  }

  console.log(
    JSON.stringify(
      {
        scanned,
        withFeed,
        missingFeed,
        coveragePercent:
          scanned > 0
            ? Number(((withFeed / scanned) * 100).toFixed(1))
            : 100,
        missingSamples,
        hint:
          missingFeed > 0
            ? "Run: npm run backfill-user-feeds -- --skip-existing"
            : "All sampled follows have userFeeds items.",
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
