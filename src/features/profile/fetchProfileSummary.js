const { db } = require("../../lib/firestore");
const { mapPostDoc } = require("../feed/mapPostDoc");
const { fetchAuthorFeedPage } = require("../feed/fetchFeedPosts");
const { GLOBAL_RANKING_SEGMENT } = require("../../lib/segmentKey");

function buildLadderSnapshot(entryData) {
  if (!entryData) {
    return {
      snapshotScore: 0,
      myRank: null,
      aheadRungs: [],
      behindRungs: [],
    };
  }

  const snapshotScore =
    typeof entryData.totalScore === "number" ? entryData.totalScore : 0;
  const myRank = typeof entryData.rank === "number" ? entryData.rank : null;

  const aheadRank =
    typeof entryData.aheadRank === "number" ? entryData.aheadRank : null;
  const aheadTotalScore =
    typeof entryData.aheadTotalScore === "number"
      ? entryData.aheadTotalScore
      : null;
  const behindRank =
    typeof entryData.behindRank === "number" ? entryData.behindRank : null;
  const behindTotalScore =
    typeof entryData.behindTotalScore === "number"
      ? entryData.behindTotalScore
      : null;

  return {
    snapshotScore,
    myRank,
    aheadRungs:
      aheadRank != null && aheadTotalScore != null && aheadRank > 0
        ? [{ rank: aheadRank, totalScore: aheadTotalScore }]
        : [],
    behindRungs:
      behindRank != null && behindTotalScore != null && behindRank > 0
        ? [{ rank: behindRank, totalScore: behindTotalScore }]
        : [],
  };
}

function mapPublicProfile(userId, data) {
  if (!data) {
    return null;
  }

  const metadata = data.metadata && typeof data.metadata === "object"
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
      data.bioCategoryVisibility && typeof data.bioCategoryVisibility === "object"
        ? data.bioCategoryVisibility
        : undefined,
  };
}

async function fetchProfileSummary({ userId, postsLimit = 15 }) {
  const [publicSnap, rankingSnap, postsPage] = await Promise.all([
    db.collection("publicProfiles").doc(userId).get(),
    db
      .collection("rankings")
      .doc(GLOBAL_RANKING_SEGMENT)
      .collection("entries")
      .doc(userId)
      .get(),
    fetchAuthorFeedPage({ authorId: userId, cursor: null, limit: postsLimit }),
  ]);

  return {
    profile: publicSnap.exists
      ? mapPublicProfile(userId, publicSnap.data())
      : null,
    ladderSnapshot: buildLadderSnapshot(
      rankingSnap.exists ? rankingSnap.data() : null
    ),
    postsPage,
  };
}

async function fetchPostById(postId) {
  if (!postId || typeof postId !== "string") {
    return null;
  }

  const snap = await db.collection("posts").doc(postId.trim()).get();
  if (!snap.exists) {
    return null;
  }

  return mapPostDoc(snap.id, snap.data());
}

module.exports = {
  fetchProfileSummary,
  fetchPostById,
};
