#!/usr/bin/env node
/**
 * Eski Firebase Storage bucket URL'lerini güncel bucket ile değiştirir.
 * users, publicProfiles, ranking entry photos, posts.authorPhotoURL alanlarını günceller.
 *
 * Usage: node scripts/backfill-photo-urls.js
 */
require("dotenv").config();

const { FieldValue } = require("firebase-admin/firestore");
const { db } = require("../src/lib/firestore");
const {
  normalizeStoragePhotoUrl,
  LEGACY_STORAGE_BUCKET,
} = require("../src/lib/normalizeStoragePhotoUrl");

const WRITE_BATCH = 400;

function normalizeFieldValue(value) {
  if (typeof value !== "string" || !value.trim()) {
    return { normalized: value, changed: false };
  }
  return normalizeStoragePhotoUrl(value);
}

async function commitBatches(updates) {
  let committed = 0;
  for (let i = 0; i < updates.length; i += WRITE_BATCH) {
    const chunk = updates.slice(i, i + WRITE_BATCH);
    const batch = db.batch();
    for (const { ref, data } of chunk) {
      batch.update(ref, data);
    }
    await batch.commit();
    committed += chunk.length;
  }
  return committed;
}

async function backfillSimpleCollection(collectionName, fieldName) {
  const snap = await db.collection(collectionName).get();
  const updates = [];

  for (const docSnap of snap.docs) {
    const value = docSnap.data()[fieldName];
    const { normalized, changed } = normalizeFieldValue(value);
    if (!changed) continue;
    updates.push({
      ref: docSnap.ref,
      data: {
        [fieldName]: normalized,
        updatedAt: FieldValue.serverTimestamp(),
      },
    });
  }

  const committed = await commitBatches(updates);
  console.log(`[backfill-photo-urls] ${collectionName}.${fieldName}: ${committed}`);
  return committed;
}

async function backfillRankingEntries() {
  const segmentsSnap = await db.collection("rankings").get();
  const updates = [];

  for (const segmentDoc of segmentsSnap.docs) {
    const entriesSnap = await segmentDoc.ref.collection("entries").get();
    for (const entryDoc of entriesSnap.docs) {
      const value = entryDoc.data().photoURL;
      const { normalized, changed } = normalizeFieldValue(value);
      if (!changed) continue;
      updates.push({
        ref: entryDoc.ref,
        data: {
          photoURL: normalized,
          updatedAt: FieldValue.serverTimestamp(),
        },
      });
    }
  }

  const committed = await commitBatches(updates);
  console.log(`[backfill-photo-urls] rankings/*/entries.photoURL: ${committed}`);
  return committed;
}

async function backfillPosts() {
  const snap = await db.collection("posts").get();
  const updates = [];

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    const patch = {};
    let changed = false;

    const author = normalizeFieldValue(data.authorPhotoURL);
    if (author.changed) {
      patch.authorPhotoURL = author.normalized;
      changed = true;
    }

    const snapshot = data.originalSnapshot;
    if (snapshot && typeof snapshot === "object") {
      const originalAuthor = normalizeFieldValue(snapshot.authorPhotoURL);
      if (originalAuthor.changed) {
        patch.originalSnapshot = {
          ...snapshot,
          authorPhotoURL: originalAuthor.normalized,
        };
        changed = true;
      }
    }

    if (!changed) continue;
    updates.push({
      ref: docSnap.ref,
      data: {
        ...patch,
        updatedAt: FieldValue.serverTimestamp(),
      },
    });
  }

  const committed = await commitBatches(updates);
  console.log(`[backfill-photo-urls] posts author photos: ${committed}`);
  return committed;
}

async function backfillInteractions() {
  const snap = await db.collection("interactions").get();
  const updates = [];

  for (const docSnap of snap.docs) {
    const value = docSnap.data().actorPhotoURL;
    const { normalized, changed } = normalizeFieldValue(value);
    if (!changed) continue;
    updates.push({
      ref: docSnap.ref,
      data: {
        actorPhotoURL: normalized,
        updatedAt: FieldValue.serverTimestamp(),
      },
    });
  }

  const committed = await commitBatches(updates);
  console.log(`[backfill-photo-urls] interactions.actorPhotoURL: ${committed}`);
  return committed;
}

async function main() {
  console.log(
    `[backfill-photo-urls] Rewriting legacy bucket: ${LEGACY_STORAGE_BUCKET}`
  );

  let total = 0;
  total += await backfillSimpleCollection("users", "photoURL");
  total += await backfillSimpleCollection("publicProfiles", "photoURL");
  total += await backfillRankingEntries();
  total += await backfillPosts();
  total += await backfillInteractions();

  console.log(`[backfill-photo-urls] Done. ${total} documents updated.`);
}

main().catch((err) => {
  console.error("[backfill-photo-urls] Failed:", err);
  process.exit(1);
});
