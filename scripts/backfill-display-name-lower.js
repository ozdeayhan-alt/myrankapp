#!/usr/bin/env node
/**
 * Backfill publicProfiles.displayNameLower for user search.
 *
 * Usage: node scripts/backfill-display-name-lower.js
 */
require("dotenv").config();

const { db } = require("../src/lib/firestore");
const {
  normalizeDisplayNameForSearch,
} = require("../src/lib/normalizeDisplayNameForSearch");

const PAGE_SIZE = 500;
const WRITE_BATCH = 400;

async function backfillDisplayNameLower() {
  let lastDoc = null;
  let scanned = 0;
  let updated = 0;
  let skipped = 0;

  while (true) {
    let query = db.collection("publicProfiles").orderBy("__name__").limit(PAGE_SIZE);
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }

    const snapshot = await query.get();
    if (snapshot.empty) {
      break;
    }

    let batch = db.batch();
    let batchCount = 0;

    for (const doc of snapshot.docs) {
      scanned += 1;
      const data = doc.data();
      const displayName =
        typeof data.displayName === "string" ? data.displayName.trim() : "";

      if (!displayName) {
        skipped += 1;
        continue;
      }

      const displayNameLower = normalizeDisplayNameForSearch(displayName);
      if (data.displayNameLower === displayNameLower) {
        skipped += 1;
        continue;
      }

      batch.update(doc.ref, { displayNameLower });
      batchCount += 1;
      updated += 1;

      if (batchCount >= WRITE_BATCH) {
        await batch.commit();
        batch = db.batch();
        batchCount = 0;
      }
    }

    if (batchCount > 0) {
      await batch.commit();
    }

    lastDoc = snapshot.docs[snapshot.docs.length - 1];
    if (snapshot.size < PAGE_SIZE) {
      break;
    }
  }

  console.log(
    `Backfill complete: scanned=${scanned}, updated=${updated}, skipped=${skipped}`
  );
}

backfillDisplayNameLower().catch((error) => {
  console.error("Backfill failed:", error);
  process.exit(1);
});
