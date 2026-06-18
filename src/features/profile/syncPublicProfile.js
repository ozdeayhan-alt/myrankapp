const { FieldValue } = require("firebase-admin/firestore");
const { db } = require("../../lib/firestore");
const {
  normalizeDisplayNameForSearch,
} = require("../../lib/normalizeDisplayNameForSearch");

/**
 * Keeps publicProfiles in sync for signed-in clients viewing other users' profiles.
 * Admin SDK bypasses security rules.
 */
function syncPublicProfileInTransaction(
  transaction,
  userId,
  { userData = null, totalScore } = {}
) {
  const publicRef = db.collection("publicProfiles").doc(userId);
  const payload = {
    totalScore,
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (userData) {
    if (typeof userData.displayName === "string" && userData.displayName.trim()) {
      const displayName = userData.displayName.trim();
      payload.displayName = displayName;
      payload.displayNameLower = normalizeDisplayNameForSearch(displayName);
    }
    if (typeof userData.photoURL === "string" && userData.photoURL.trim()) {
      payload.photoURL = userData.photoURL.trim();
    }
    if (typeof userData.bio === "string") {
      payload.bio = userData.bio.trim();
    }
    if (
      userData.bioCategoryVisibility &&
      typeof userData.bioCategoryVisibility === "object"
    ) {
      payload.bioCategoryVisibility = userData.bioCategoryVisibility;
    }
    if (userData.metadata && typeof userData.metadata === "object") {
      payload.metadata = userData.metadata;
    }
    if (userData.isBot === true) {
      payload.isBot = true;
    }
    if (typeof userData.botRole === "string" && userData.botRole.trim()) {
      payload.botRole = userData.botRole.trim();
    }
  }

  transaction.set(publicRef, payload, { merge: true });
}

module.exports = { syncPublicProfileInTransaction };
