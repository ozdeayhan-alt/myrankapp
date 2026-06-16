#!/usr/bin/env node
/**
 * Bozuk profil fotoğraflarını Storage'da doğrular, gerekirse eski bucket'tan kopyalar,
 * yeni download token üretir ve Firestore photoURL alanlarını günceller.
 *
 * Usage:
 *   node scripts/repair-profile-photos.js
 *   node scripts/repair-profile-photos.js --user=UID
 */
require("dotenv").config();

const { FieldValue } = require("firebase-admin/firestore");
const admin = require("../firebase-config");
const { db } = require("../src/lib/firestore");
const {
  LEGACY_STORAGE_BUCKET,
  currentStorageBucket,
} = require("../src/lib/normalizeStoragePhotoUrl");
const { getBucketName } = require("../src/lib/storageMedia");
const { finalizeUploadedObject } = require("../src/lib/storageGcs");

const DEFAULT_USER_IDS = [
  "ttqfKhWMsUPJNYN4NBD8KAPODtO2", // Mehmet Sert
  "HyeFH7EY5Kh66beAl1cmFOqGWxt2", // Özge Özden
  "AtxkTWX9nZVB7K4oYsJz4cjgNBy1", // Ceren KOÇ
  "8a9Dr64t9XSVvg3XDMGbHYr8HUi1", // Merve Cesur
];

const AVATAR_CANDIDATES = ["avatar.jpg", "avatar.jpeg", "avatar.png", "avatar.webp"];

function parseUserIdsFromArgs() {
  const fromFlags = process.argv
    .filter((arg) => arg.startsWith("--user="))
    .map((arg) => arg.slice("--user=".length).trim())
    .filter(Boolean);

  return fromFlags.length > 0 ? fromFlags : DEFAULT_USER_IDS;
}

function parseObjectPathFromPhotoUrl(url) {
  if (typeof url !== "string" || !url.trim()) {
    return null;
  }

  try {
    const parsed = new URL(url.trim());
    const prefix = "/v0/b/";
    const oMarker = "/o/";
    const bucketStart = parsed.pathname.indexOf(prefix);
    const objectStart = parsed.pathname.indexOf(oMarker);
    if (bucketStart === -1 || objectStart === -1) {
      return null;
    }
    const encoded = parsed.pathname.slice(objectStart + oMarker.length);
    return decodeURIComponent(encoded);
  } catch {
    return null;
  }
}

function guessContentType(objectPath) {
  const lower = objectPath.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

async function listAvatarPaths(bucketName, userId) {
  const bucket = admin.storage().bucket(bucketName);
  const [files] = await bucket.getFiles({ prefix: `profiles/${userId}/` });
  return files
    .map((file) => file.name)
    .filter((name) => /avatar\.(jpg|jpeg|png|webp)$/i.test(name));
}

async function resolveAvatarObjectPath(userId, photoURL) {
  const fromUrl = parseObjectPathFromPhotoUrl(photoURL);
  const candidates = new Set();

  if (fromUrl) {
    candidates.add(fromUrl);
  }

  for (const name of AVATAR_CANDIDATES) {
    candidates.add(`profiles/${userId}/${name}`);
  }

  const currentBucket = getBucketName();
  for (const objectPath of candidates) {
    const [exists] = await admin
      .storage()
      .bucket(currentBucket)
      .file(objectPath)
      .exists();
    if (exists) {
      return objectPath;
    }
  }

  const legacyListed = await listAvatarPaths(LEGACY_STORAGE_BUCKET, userId);
  if (legacyListed[0]) {
    return legacyListed[0];
  }

  const currentListed = await listAvatarPaths(currentBucket, userId);
  if (currentListed[0]) {
    return currentListed[0];
  }

  return fromUrl ?? `profiles/${userId}/avatar.jpg`;
}

async function ensureAvatarInCurrentBucket(objectPath) {
  const currentBucket = getBucketName();
  const currentFile = admin.storage().bucket(currentBucket).file(objectPath);
  const [exists] = await currentFile.exists();
  if (exists) {
    return { objectPath, copied: false };
  }

  const legacyFile = admin.storage().bucket(LEGACY_STORAGE_BUCKET).file(objectPath);
  const [legacyExists] = await legacyFile.exists();
  if (!legacyExists) {
    throw new Error(
      `Avatar dosyası bulunamadı: ${objectPath} (current + ${LEGACY_STORAGE_BUCKET})`
    );
  }

  await legacyFile.copy(currentFile);
  return { objectPath, copied: true };
}

async function repairUserPhoto(userId) {
  const userSnap = await db.collection("users").doc(userId).get();
  if (!userSnap.exists) {
    throw new Error(`User not found: ${userId}`);
  }

  const userData = userSnap.data();
  const displayName = userData.displayName ?? userId;
  const oldPhotoURL = typeof userData.photoURL === "string" ? userData.photoURL : "";

  const objectPath = await resolveAvatarObjectPath(userId, oldPhotoURL);
  const { copied } = await ensureAvatarInCurrentBucket(objectPath);
  const contentType = guessContentType(objectPath);

  const { downloadURL } = await finalizeUploadedObject({
    bucket: getBucketName(),
    objectPath,
    contentType,
  });

  const timestamp = FieldValue.serverTimestamp();

  await db.collection("users").doc(userId).set(
    { photoURL: downloadURL, updatedAt: timestamp },
    { merge: true }
  );

  const publicRef = db.collection("publicProfiles").doc(userId);
  const publicSnap = await publicRef.get();
  if (publicSnap.exists) {
    await publicRef.set(
      { photoURL: downloadURL, updatedAt: timestamp },
      { merge: true }
    );
  }

  const postsSnap = await db
    .collection("posts")
    .where("authorId", "==", userId)
    .get();

  if (!postsSnap.empty) {
    const batch = db.batch();
    for (const postDoc of postsSnap.docs) {
      const postData = postDoc.data();
      const patch = { authorPhotoURL: downloadURL, updatedAt: timestamp };
      if (
        postData.originalSnapshot &&
        typeof postData.originalSnapshot === "object" &&
        postData.originalSnapshot.authorId === userId
      ) {
        patch.originalSnapshot = {
          ...postData.originalSnapshot,
          authorPhotoURL: downloadURL,
        };
      }
      batch.update(postDoc.ref, patch);
    }
    await batch.commit();
  }

  return {
    userId,
    displayName,
    objectPath,
    copied,
    oldPhotoURL,
    downloadURL,
    postsUpdated: postsSnap.size,
  };
}

async function main() {
  const userIds = parseUserIdsFromArgs();
  console.log(
    `[repair-profile-photos] bucket=${getBucketName()} legacy=${LEGACY_STORAGE_BUCKET}`
  );

  const results = [];
  for (const userId of userIds) {
    try {
      const result = await repairUserPhoto(userId);
      results.push(result);
      console.log(
        `[repair-profile-photos] OK ${result.displayName} (${userId}) copied=${result.copied} posts=${result.postsUpdated}`
      );
      console.log(`  ${result.downloadURL}`);
    } catch (error) {
      console.error(
        `[repair-profile-photos] FAIL ${userId}:`,
        error instanceof Error ? error.message : error
      );
    }
  }

  console.log(
    `[repair-profile-photos] Done. ${results.length}/${userIds.length} repaired.`
  );
}

main().catch((err) => {
  console.error("[repair-profile-photos] Failed:", err);
  process.exit(1);
});
