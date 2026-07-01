const { db } = require("../../lib/firestore");
const { fetchProfileRankingsAndLadder } = require("./fetchProfileSummary");

function normalizeMetadata(raw) {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  return {
    country: String(raw.country ?? ""),
    city: String(raw.city ?? ""),
    gender: String(raw.gender ?? ""),
    age: typeof raw.age === "number" ? raw.age : null,
    profession: String(raw.profession ?? ""),
    maritalStatus: String(raw.maritalStatus ?? ""),
  };
}

async function resolveMetadataForRankings(userId, viewerId) {
  const publicSnap = await db.collection("publicProfiles").doc(userId).get();
  if (publicSnap.exists) {
    const metadata = normalizeMetadata(publicSnap.data()?.metadata);
    if (metadata) {
      return metadata;
    }
  }

  if (viewerId === userId) {
    const usersSnap = await db.collection("users").doc(userId).get();
    if (usersSnap.exists) {
      const metadata = normalizeMetadata(usersSnap.data()?.metadata);
      if (metadata) {
        return metadata;
      }
    }
  }

  return null;
}

async function fetchProfileRankings(userId, viewerId) {
  const metadata = await resolveMetadataForRankings(userId, viewerId);
  const payload = await fetchProfileRankingsAndLadder(userId, metadata);
  return payload.rankings ?? [];
}

module.exports = { fetchProfileRankings };
