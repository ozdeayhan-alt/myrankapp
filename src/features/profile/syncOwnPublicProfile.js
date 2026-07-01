const { FieldValue } = require("firebase-admin/firestore");
const { db } = require("../../lib/firestore");
const {
  normalizeDisplayNameForSearch,
} = require("../../lib/normalizeDisplayNameForSearch");

const EMPTY_BIO_CATEGORY_VISIBILITY = {
  country: false,
  city: false,
  gender: false,
  age: false,
  profession: false,
  maritalStatus: false,
};

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

function buildPublicProfilePayload(input) {
  const trimmedName = String(input.displayName ?? "").trim();

  return {
    displayName: trimmedName,
    displayNameLower: normalizeDisplayNameForSearch(trimmedName),
    photoURL: String(input.photoURL ?? "").trim(),
    bio: String(input.bio ?? "").trim(),
    bioCategoryVisibility:
      input.bioCategoryVisibility &&
      typeof input.bioCategoryVisibility === "object"
        ? input.bioCategoryVisibility
        : EMPTY_BIO_CATEGORY_VISIBILITY,
    metadata: normalizeMetadata(input.metadata),
  };
}

function bioVisibilityMatches(existing, next) {
  if (!existing || typeof existing !== "object") {
    return (
      JSON.stringify(EMPTY_BIO_CATEGORY_VISIBILITY) === JSON.stringify(next)
    );
  }
  return JSON.stringify(existing) === JSON.stringify(next);
}

function publicProfileMatchesExisting(existingData, payload) {
  const existingMetadata =
    existingData.metadata && typeof existingData.metadata === "object"
      ? existingData.metadata
      : {};

  return (
    String(existingData.displayName ?? "").trim() === payload.displayName &&
    String(existingData.photoURL ?? "").trim() === payload.photoURL &&
    String(existingData.bio ?? "").trim() === payload.bio &&
    bioVisibilityMatches(
      existingData.bioCategoryVisibility,
      payload.bioCategoryVisibility
    ) &&
    JSON.stringify(existingMetadata) === JSON.stringify(payload.metadata)
  );
}

async function syncOwnPublicProfile(userId, input = null) {
  const usersRef = db.collection("users").doc(userId);
  const publicRef = db.collection("publicProfiles").doc(userId);
  const [usersSnap, publicSnap] = await Promise.all([
    usersRef.get(),
    publicRef.get(),
  ]);

  const source = input ?? (usersSnap.exists ? usersSnap.data() : null);
  if (!source) {
    return { synced: false, reason: "missing_user" };
  }

  const payload = buildPublicProfilePayload({
    displayName: source.displayName,
    photoURL: source.photoURL,
    bio: source.bio,
    bioCategoryVisibility: source.bioCategoryVisibility,
    metadata: source.metadata ?? source,
  });

  if (publicSnap.exists && publicProfileMatchesExisting(publicSnap.data(), payload)) {
    return { synced: false, reason: "already_synced" };
  }

  const writePayload = {
    ...payload,
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (!publicSnap.exists) {
    writePayload.totalScore =
      typeof source.totalScore === "number" ? source.totalScore : 0;
  }

  await publicRef.set(writePayload, { merge: true });
  return { synced: true };
}

module.exports = { syncOwnPublicProfile, buildPublicProfilePayload };
