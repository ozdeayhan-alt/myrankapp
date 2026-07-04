#!/usr/bin/env node
/**
 * Backfill posts.feedContentType and userFeeds items.feedContentType.
 * Run: node scripts/backfill-feed-content-type.js [--dry-run]
 */
const { db } = require("../src/lib/firestore");
const { resolveFeedContentType } = require("../src/features/feed/feedContentType");

const DRY_RUN = process.argv.includes("--dry-run");
const BATCH_SIZE = 400;

async function backfillPosts() {
  let updated = 0;
  let lastDoc = null;

  while (true) {
    let query = db.collection("posts").orderBy("__name__").limit(BATCH_SIZE);
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }

    const snap = await query.get();
    if (snap.empty) {
      break;
    }

    const batch = db.batch();
    let batchCount = 0;

    for (const doc of snap.docs) {
      const data = doc.data();
      const next = resolveFeedContentType(data);
      if (data.feedContentType === next) {
        continue;
      }

      if (!DRY_RUN) {
        batch.update(doc.ref, { feedContentType: next });
      }
      batchCount += 1;
      updated += 1;
    }

    if (!DRY_RUN && batchCount > 0) {
      await batch.commit();
    }

    lastDoc = snap.docs[snap.docs.length - 1];
    console.log(
      `[backfill-feed-content-type] posts batch scanned=${snap.size} updatedTotal=${updated}`
    );

    if (snap.size < BATCH_SIZE) {
      break;
    }
  }

  return updated;
}

async function backfillUserFeedItems() {
  let updated = 0;
  const postsCache = new Map();

  async function resolveForPostId(postId) {
    if (postsCache.has(postId)) {
      return postsCache.get(postId);
    }
    const snap = await db.collection("posts").doc(postId).get();
    const value = snap.exists ? resolveFeedContentType(snap.data()) : "tweet";
    postsCache.set(postId, value);
    return value;
  }

  const usersSnap = await db.collection("userFeeds").select().get();

  for (const userDoc of usersSnap.docs) {
    const itemsSnap = await userDoc.ref.collection("items").get();
    const batch = db.batch();
    let batchCount = 0;

    for (const itemDoc of itemsSnap.docs) {
      const data = itemDoc.data();
      const postId = itemDoc.id;
      const next = await resolveForPostId(postId);
      if (data.feedContentType === next) {
        continue;
      }

      if (!DRY_RUN) {
        batch.update(itemDoc.ref, { feedContentType: next });
      }
      batchCount += 1;
      updated += 1;
    }

    if (!DRY_RUN && batchCount > 0) {
      await batch.commit();
    }
  }

  console.log(
    `[backfill-feed-content-type] userFeeds items updated=${updated} dryRun=${DRY_RUN}`
  );
  return updated;
}

async function main() {
  console.log(`[backfill-feed-content-type] starting dryRun=${DRY_RUN}`);
  const postsUpdated = await backfillPosts();
  const itemsUpdated = await backfillUserFeedItems();
  console.log(
    `[backfill-feed-content-type] done posts=${postsUpdated} items=${itemsUpdated}`
  );
}

main().catch((error) => {
  console.error("[backfill-feed-content-type] failed:", error);
  process.exit(1);
});
