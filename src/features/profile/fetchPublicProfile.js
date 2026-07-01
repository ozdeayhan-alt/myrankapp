const { db } = require("../../lib/firestore");

function mapPublicProfile(userId, data) {
  if (!data) {
    return null;
  }

  const metadata =
    data.metadata && typeof data.metadata === "object"
      ? {
          country: String(data.metadata.country ?? ""),
          city: String(data.metadata.city ?? ""),
          gender: String(data.metadata.gender ?? ""),
          age: typeof data.metadata.age === "number" ? data.metadata.age : null,
          profession: String(data.metadata.profession ?? ""),
          maritalStatus: String(data.metadata.maritalStatus ?? ""),
        }
      : undefined;

  return {
    userId,
    displayName: String(data.displayName ?? ""),
    photoURL: data.photoURL ? String(data.photoURL) : undefined,
    bio: data.bio ? String(data.bio) : undefined,
    totalScore: typeof data.totalScore === "number" ? data.totalScore : 0,
    metadata,
    bioCategoryVisibility:
      data.bioCategoryVisibility &&
      typeof data.bioCategoryVisibility === "object"
        ? data.bioCategoryVisibility
        : undefined,
  };
}

async function fetchPublicProfile(userId) {
  const snap = await db.collection("publicProfiles").doc(userId).get();
  if (!snap.exists) {
    return null;
  }
  return mapPublicProfile(userId, snap.data());
}

async function fetchRankingEntry(userId, segmentKey) {
  const snap = await db
    .collection("rankings")
    .doc(segmentKey)
    .collection("entries")
    .doc(userId)
    .get();

  if (!snap.exists) {
    return null;
  }

  const data = snap.data();
  return {
    userId,
    segmentKey,
    totalScore: typeof data.totalScore === "number" ? data.totalScore : 0,
    rank: typeof data.rank === "number" ? data.rank : null,
    segmentTotal:
      typeof data.segmentTotal === "number" ? data.segmentTotal : null,
    aheadRank: typeof data.aheadRank === "number" ? data.aheadRank : null,
    aheadTotalScore:
      typeof data.aheadTotalScore === "number" ? data.aheadTotalScore : null,
    behindRank: typeof data.behindRank === "number" ? data.behindRank : null,
    behindTotalScore:
      typeof data.behindTotalScore === "number" ? data.behindTotalScore : null,
  };
}

async function fetchRankingSnapshotMeta() {
  const snap = await db.collection("rankingSnapshots").doc("latest").get();
  if (!snap.exists) {
    return { rebuiltAt: null, timezone: null, mode: null };
  }

  const data = snap.data();
  const rebuiltAt = data.rebuiltAt?.toDate?.()?.toISOString?.() ?? null;

  return {
    rebuiltAt,
    timezone:
      typeof data.timezone === "string" ? data.timezone : "Europe/Istanbul",
    mode: typeof data.mode === "string" ? data.mode : null,
  };
}

module.exports = {
  fetchPublicProfile,
  fetchRankingEntry,
  fetchRankingSnapshotMeta,
};
