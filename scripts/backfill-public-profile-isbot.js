#!/usr/bin/env node
/**
 * publicProfiles.isBot / botRole alanlarını users koleksiyonundan doldurur.
 */
require("dotenv").config();

const { FieldValue } = require("firebase-admin/firestore");
const { db } = require("../src/lib/firestore");

const PAGE = 500;

async function main() {
  let updated = 0;
  let lastDoc = null;

  while (true) {
    let query = db.collection("users").where("isBot", "==", true).limit(PAGE);
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }

    const snap = await query.get();
    if (snap.empty) {
      break;
    }

    const batch = db.batch();

    for (const doc of snap.docs) {
      const data = doc.data();
      const publicRef = db.collection("publicProfiles").doc(doc.id);
      batch.set(
        publicRef,
        {
          isBot: true,
          botRole:
            typeof data.botRole === "string" ? data.botRole.trim() : "segment",
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      updated += 1;
    }

    await batch.commit();
    lastDoc = snap.docs[snap.docs.length - 1];
    if (snap.size < PAGE) {
      break;
    }
  }

  console.log(`[backfill-public-profile-isbot] updated ${updated} profiles`);
}

main().catch((error) => {
  console.error("[backfill-public-profile-isbot] failed:", error);
  process.exit(1);
});
