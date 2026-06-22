#!/usr/bin/env node
/**
 * Tek seferlik: eski kayıtlardaki metadata büyük/küçük harf düzeltmesi.
 * Şu an: country "türkiye" → "Türkiye", gender "kadın"/"erkek" → "Kadın"/"Erkek"
 *
 * Usage: node scripts/fix-legacy-metadata-case.js
 */
require("dotenv").config();

const { db } = require("../src/lib/firestore");

const LEGACY_COUNTRY_FIXES = {
  türkiye: "Türkiye",
  turkiye: "Türkiye",
};

const LEGACY_GENDER_FIXES = {
  kadın: "Kadın",
  kadin: "Kadın",
  erkek: "Erkek",
};

const ORPHAN_SEGMENT_KEYS = [
  "country:türkiye|city:|gender:|age:|profession:|maritalStatus:",
  "country:türkiye|city:İzmir|gender:kadın|age:38|profession:Ev hanımı|maritalStatus:Evli",
];

function normalizeMetadata(metadata) {
  if (!metadata || typeof metadata !== "object") {
    return { metadata, changed: false };
  }

  const next = { ...metadata };
  let changed = false;

  if (typeof next.country === "string") {
    const fixed = LEGACY_COUNTRY_FIXES[next.country.trim().toLocaleLowerCase("tr-TR")];
    if (fixed && next.country !== fixed) {
      next.country = fixed;
      changed = true;
    }
  }

  if (typeof next.gender === "string") {
    const fixed = LEGACY_GENDER_FIXES[next.gender.trim().toLocaleLowerCase("tr-TR")];
    if (fixed && next.gender !== fixed) {
      next.gender = fixed;
      changed = true;
    }
  }

  return { metadata: next, changed };
}

async function deleteRankingSegment(segmentKey) {
  const entriesSnap = await db
    .collection("rankings")
    .doc(segmentKey)
    .collection("entries")
    .get();

  if (!entriesSnap.empty) {
    const batch = db.batch();
    entriesSnap.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  }

  await db.collection("rankings").doc(segmentKey).delete().catch(() => undefined);
}

async function fixUsers() {
  const snap = await db.collection("users").get();
  let updated = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    const { metadata, changed } = normalizeMetadata(data.metadata);
    if (!changed) continue;

    await doc.ref.set({ metadata }, { merge: true });
    updated += 1;
    console.log(`[fix-legacy-metadata-case] users/${doc.id}`);
  }

  return updated;
}

async function fixPublicProfiles() {
  const snap = await db.collection("publicProfiles").get();
  let updated = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    const { metadata, changed } = normalizeMetadata(data.metadata);
    if (!changed) continue;

    await doc.ref.set({ metadata }, { merge: true });
    updated += 1;
    console.log(`[fix-legacy-metadata-case] publicProfiles/${doc.id}`);
  }

  return updated;
}

async function fixPosts() {
  let updated = 0;

  for (const [legacyCountry, fixedCountry] of Object.entries(LEGACY_COUNTRY_FIXES)) {
    const snap = await db
      .collection("posts")
      .where("metadata.country", "==", legacyCountry)
      .get();

    for (const doc of snap.docs) {
      const data = doc.data();
      const { metadata, changed } = normalizeMetadata(data.metadata);
      if (!changed) continue;

      await doc.ref.set({ metadata }, { merge: true });
      updated += 1;
      console.log(`[fix-legacy-metadata-case] posts/${doc.id}`);
    }
  }

  return updated;
}

async function removeOrphanSegments() {
  for (const segmentKey of ORPHAN_SEGMENT_KEYS) {
    await deleteRankingSegment(segmentKey);
    console.log(`[fix-legacy-metadata-case] removed rankings/${segmentKey}`);
  }
}

async function main() {
  const usersUpdated = await fixUsers();
  const publicUpdated = await fixPublicProfiles();
  const postsUpdated = await fixPosts();
  await removeOrphanSegments();

  console.log(
    `[fix-legacy-metadata-case] Done. users=${usersUpdated} publicProfiles=${publicUpdated} posts=${postsUpdated}`
  );
}

main().catch((error) => {
  console.error("[fix-legacy-metadata-case] Failed:", error);
  process.exit(1);
});
