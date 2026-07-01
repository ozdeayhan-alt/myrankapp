const { FieldValue } = require("firebase-admin/firestore");
const { db } = require("../../lib/firestore");
const { isMetadataComplete } = require("../../lib/segmentKey");
const { syncOwnPublicProfile } = require("./syncOwnPublicProfile");
const { assertAllowedMediaURL } = require("../../lib/validateMediaUrl");
const { getCacheKey, invalidateCached } = require("../feed/feedCache");

function normalizeBio(bio) {
  return typeof bio === "string" ? bio.trim() : "";
}

function normalizeMetadata(metadata = {}) {
  return {
    country: String(metadata.country ?? "").trim(),
    city: String(metadata.city ?? "").trim(),
    age:
      typeof metadata.age === "number" && metadata.age > 0 ? metadata.age : null,
    gender: String(metadata.gender ?? "").trim(),
    profession: String(metadata.profession ?? "").trim(),
    maritalStatus: String(metadata.maritalStatus ?? "").trim(),
  };
}

async function invalidateOwnProfileCaches(userId) {
  await Promise.all([
    invalidateCached(getCacheKey(["profile", "me", userId])),
    invalidateCached(getCacheKey(["profile", "public", userId])),
    invalidateCached(getCacheKey(["profile", "rankings", userId])),
  ]);
}

async function saveOwnProfile(userId, body = {}) {
  const email = String(body.email ?? "").trim();
  const displayName = String(body.displayName ?? "").trim();
  const bio = normalizeBio(body.bio);
  const metadata = normalizeMetadata(body.metadata);
  const bioCategoryVisibility =
    body.bioCategoryVisibility &&
    typeof body.bioCategoryVisibility === "object"
      ? body.bioCategoryVisibility
      : undefined;

  if (!email) {
    const error = new Error("email gerekli");
    error.statusCode = 400;
    throw error;
  }

  if (!displayName) {
    const error = new Error("displayName gerekli");
    error.statusCode = 400;
    throw error;
  }

  if (!isMetadataComplete(metadata)) {
    const error = new Error("Tüm kategori alanları doldurulmalıdır.");
    error.statusCode = 400;
    throw error;
  }

  const ref = db.collection("users").doc(userId);
  const existing = await ref.get();
  const trimmedName = displayName.trim();

  const payload = {
    email,
    displayName: trimmedName,
    bio,
    ...(bioCategoryVisibility ? { bioCategoryVisibility } : {}),
    metadata,
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (!existing.exists) {
    payload.createdAt = FieldValue.serverTimestamp();
    payload.totalScore = 0;
  }

  await ref.set(payload, { merge: true });

  const totalScore =
    existing.exists && typeof existing.data()?.totalScore === "number"
      ? existing.data().totalScore
      : 0;

  const existingPhoto =
    existing.exists && typeof existing.data()?.photoURL === "string"
      ? existing.data().photoURL.trim()
      : "";

  await syncOwnPublicProfile(userId, {
    displayName: trimmedName,
    photoURL: existingPhoto,
    bio,
    bioCategoryVisibility,
    metadata,
    totalScore,
  });

  await invalidateOwnProfileCaches(userId);

  return {
    ok: true,
    profile: {
      displayName: trimmedName,
      photoURL: existingPhoto,
      bio,
      bioCategoryVisibility,
      metadata,
      totalScore,
    },
  };
}

async function updateOwnProfilePhoto(userId, photoURL) {
  const trimmed = String(photoURL ?? "").trim();
  if (!trimmed) {
    const error = new Error("photoURL gerekli");
    error.statusCode = 400;
    throw error;
  }

  try {
    assertAllowedMediaURL(trimmed, "photoURL");
  } catch (validationError) {
    const error = new Error(validationError.message);
    error.statusCode = validationError.statusCode ?? 400;
    throw error;
  }

  const ref = db.collection("users").doc(userId);
  const existing = await ref.get();
  if (!existing.exists) {
    const error = new Error("Profil bulunamadı");
    error.statusCode = 404;
    throw error;
  }

  await ref.set(
    {
      photoURL: trimmed,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  const data = existing.data();
  await syncOwnPublicProfile(userId, {
    ...data,
    photoURL: trimmed,
  });

  await invalidateOwnProfileCaches(userId);

  return { ok: true, photoURL: trimmed };
}

module.exports = {
  saveOwnProfile,
  updateOwnProfilePhoto,
  invalidateOwnProfileCaches,
};
