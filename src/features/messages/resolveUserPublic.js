const { db } = require("../../lib/firestore");

const DEFAULT_DISPLAY_NAME = "Kullanıcı";

function mapPublicProfileDoc(userId, data) {
  return {
    userId,
    displayName:
      String(data.displayName ?? "").trim() || DEFAULT_DISPLAY_NAME,
    photoURL: data.photoURL ? String(data.photoURL) : undefined,
  };
}

function mapUserDoc(userId, data) {
  return {
    userId,
    displayName:
      String(data.displayName ?? "").trim() || DEFAULT_DISPLAY_NAME,
    photoURL: data.photoURL ? String(data.photoURL) : undefined,
  };
}

async function resolveUserPublic(userId) {
  const profiles = await resolveUsersPublic([userId]);
  return (
    profiles.get(userId) ?? {
      userId,
      displayName: DEFAULT_DISPLAY_NAME,
      photoURL: undefined,
    }
  );
}

/**
 * Batch-resolve public profiles (1–2 reads per 100 users vs N sequential).
 */
async function resolveUsersPublic(userIds) {
  const uniqueIds = [
    ...new Set(
      (Array.isArray(userIds) ? userIds : [])
        .filter((id) => typeof id === "string" && id.trim())
        .map((id) => id.trim())
    ),
  ];

  const result = new Map();
  if (uniqueIds.length === 0) {
    return result;
  }

  for (let index = 0; index < uniqueIds.length; index += 100) {
    const chunk = uniqueIds.slice(index, index + 100);
    const refs = chunk.map((userId) =>
      db.collection("publicProfiles").doc(userId)
    );
    const snaps = await db.getAll(...refs);

    for (const snap of snaps) {
      if (snap.exists) {
        result.set(snap.id, mapPublicProfileDoc(snap.id, snap.data()));
      }
    }
  }

  const missing = uniqueIds.filter((userId) => !result.has(userId));
  for (let index = 0; index < missing.length; index += 100) {
    const chunk = missing.slice(index, index + 100);
    const refs = chunk.map((userId) => db.collection("users").doc(userId));
    const snaps = await db.getAll(...refs);

    for (const snap of snaps) {
      if (snap.exists) {
        result.set(snap.id, mapUserDoc(snap.id, snap.data()));
      }
    }
  }

  return result;
}

module.exports = { resolveUserPublic, resolveUsersPublic };
