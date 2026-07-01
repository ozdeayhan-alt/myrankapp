const { resolveUsersPublic } = require("../messages/resolveUserPublic");

const LEGACY_STORAGE_BUCKET = "myrank-d62b9-storage";

function needsProfilePhotoLookup(entry) {
  const photoURL = entry.photoURL?.trim() ?? "";
  if (!photoURL) {
    return true;
  }
  return photoURL.includes(LEGACY_STORAGE_BUCKET);
}

function resolveEntryPhotoURL(entry, profilePhotoURL) {
  const entryPhoto = entry.photoURL?.trim() ?? "";
  if (entryPhoto && !entryPhoto.includes(LEGACY_STORAGE_BUCKET)) {
    return entryPhoto;
  }

  const profilePhoto = profilePhotoURL?.trim() ?? "";
  if (profilePhoto) {
    return profilePhoto;
  }

  return entryPhoto || undefined;
}

/**
 * Batch-enrich ranking rows missing avatars (replaces per-row client Firestore reads).
 */
async function enrichRankingPhotos(entries) {
  if (!Array.isArray(entries) || entries.length === 0) {
    return entries;
  }

  const needsLookup = entries.filter(needsProfilePhotoLookup);
  if (needsLookup.length === 0) {
    return entries;
  }

  const profiles = await resolveUsersPublic(needsLookup.map((entry) => entry.userId));
  const enrichedById = new Map();

  for (const entry of needsLookup) {
    const profile = profiles.get(entry.userId);
    const photoURL = resolveEntryPhotoURL(entry, profile?.photoURL);
    if (photoURL) {
      enrichedById.set(entry.userId, { ...entry, photoURL });
    }
  }

  return entries.map((entry) => enrichedById.get(entry.userId) ?? entry);
}

module.exports = {
  enrichRankingPhotos,
  needsProfilePhotoLookup,
};
