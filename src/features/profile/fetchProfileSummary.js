const { db } = require("../../lib/firestore");
const { mapPostDoc } = require("../feed/mapPostDoc");
const { fetchAuthorFeedPage } = require("../feed/fetchFeedPosts");
const {
  GLOBAL_RANKING_SEGMENT,
  METADATA_FIELDS,
  EMPTY_METADATA,
  buildSegmentKey,
} = require("../../lib/segmentKey");

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

function hasMetadataValue(metadata, key) {
  if (!metadata) {
    return false;
  }
  if (key === "age") {
    return metadata.age !== null && Number(metadata.age) > 0;
  }
  const value = metadata[key];
  return typeof value === "string" && value.trim().length > 0;
}

function buildCategorySegmentKey(metadata, field) {
  return buildSegmentKey({ ...EMPTY_METADATA, [field]: metadata[field] });
}

const CATEGORY_PRIORITY = {
  profession: 0,
  city: 1,
  age: 2,
  gender: 3,
  maritalStatus: 4,
  country: 5,
};

function compareRankings(a, b) {
  if (a.rank !== b.rank) {
    return a.rank - b.rank;
  }
  if (a.isOfficial !== b.isOfficial) {
    return a.isOfficial ? -1 : 1;
  }
  return CATEGORY_PRIORITY[a.key] - CATEGORY_PRIORITY[b.key];
}

function listGaugeSegmentKeys(metadata) {
  const keys = [GLOBAL_RANKING_SEGMENT];
  if (!metadata) {
    return keys;
  }
  for (const field of METADATA_FIELDS) {
    if (hasMetadataValue(metadata, field)) {
      keys.push(buildCategorySegmentKey(metadata, field));
    }
  }
  return keys;
}

function buildRankingFromEntry(key, entryData) {
  if (!entryData) {
    return { key, rank: null, isOfficial: false };
  }

  const rank = typeof entryData.rank === "number" ? entryData.rank : null;
  const segmentTotal =
    typeof entryData.segmentTotal === "number" ? entryData.segmentTotal : 0;

  return {
    key,
    rank,
    isOfficial: rank !== null && segmentTotal > 0,
  };
}

function buildProfileRankings(metadata, segmentKeys, entrySnaps) {
  const rankings = [];

  const globalIndex = segmentKeys.indexOf(GLOBAL_RANKING_SEGMENT);
  if (globalIndex >= 0) {
    rankings.push(
      buildRankingFromEntry(
        "global",
        entrySnaps[globalIndex]?.exists ? entrySnaps[globalIndex].data() : null
      )
    );
  }

  if (!metadata) {
    return rankings;
  }

  for (const field of METADATA_FIELDS) {
    if (!hasMetadataValue(metadata, field)) {
      continue;
    }
    const segmentKey = buildCategorySegmentKey(metadata, field);
    const index = segmentKeys.indexOf(segmentKey);
    if (index < 0) {
      continue;
    }
    const snap = entrySnaps[index];
    rankings.push(
      buildRankingFromEntry(field, snap?.exists ? snap.data() : null)
    );
  }

  return rankings;
}

function pickLegacyLadderSegmentKey(metadata, ladderSnapshotsBySegmentKey) {
  if (!metadata) {
    return GLOBAL_RANKING_SEGMENT;
  }

  const activeKeys = METADATA_FIELDS.filter((key) =>
    hasMetadataValue(metadata, key)
  );

  const rankings = activeKeys.flatMap((key) => {
    const segmentKey = buildCategorySegmentKey(metadata, key);
    const snapshot = ladderSnapshotsBySegmentKey[segmentKey];
    const rank = snapshot?.myRank;
    if (rank == null || rank <= 0) {
      return [];
    }
    return [
      {
        key,
        rank,
        isOfficial: true,
        segmentKey,
      },
    ];
  });

  if (rankings.length === 0) {
    return GLOBAL_RANKING_SEGMENT;
  }

  const withRoomAbove = rankings.filter((item) => item.rank > 1);
  const candidatePool = withRoomAbove.length > 0 ? withRoomAbove : rankings;
  const best = [...candidatePool].sort(compareRankings)[0];
  return best?.segmentKey ?? GLOBAL_RANKING_SEGMENT;
}

async function fetchProfileRankingsAndLadder(userId, metadata) {
  const segmentKeys = listGaugeSegmentKeys(metadata);

  const entrySnaps = await Promise.all(
    segmentKeys.map((segmentKey) =>
      db
        .collection("rankings")
        .doc(segmentKey)
        .collection("entries")
        .doc(userId)
        .get()
    )
  );

  const ladderSnapshotsBySegmentKey = {};
  segmentKeys.forEach((segmentKey, index) => {
    const snap = entrySnaps[index];
    ladderSnapshotsBySegmentKey[segmentKey] = buildLadderSnapshot(
      snap?.exists ? snap.data() : null
    );
  });

  const ladderSegmentKey = pickLegacyLadderSegmentKey(
    metadata,
    ladderSnapshotsBySegmentKey
  );

  const rankings = buildProfileRankings(metadata, segmentKeys, entrySnaps);

  return {
    rankings,
    ladderSegmentKey,
    ladderSnapshot:
      ladderSnapshotsBySegmentKey[ladderSegmentKey] ??
      buildLadderSnapshot(null),
    ladderSnapshotsBySegmentKey,
  };
}

async function fetchProfileGaugeBootstrap({ userId }) {
  const publicSnap = await db.collection("publicProfiles").doc(userId).get();
  const profile = publicSnap.exists
    ? mapPublicProfile(userId, publicSnap.data())
    : null;

  return fetchProfileRankingsAndLadder(userId, profile?.metadata);
}

async function fetchProfileSummary({ userId, postsLimit = 15 }) {
  const publicSnap = await db.collection("publicProfiles").doc(userId).get();
  const profile = publicSnap.exists
    ? mapPublicProfile(userId, publicSnap.data())
    : null;

  const [postsPage, ladderPayload] = await Promise.all([
    fetchAuthorFeedPage({ authorId: userId, cursor: null, limit: postsLimit }),
    fetchProfileRankingsAndLadder(userId, profile?.metadata),
  ]);

  return {
    profile,
    ...ladderPayload,
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
  fetchProfileGaugeBootstrap,
  fetchPostById,
  fetchProfileRankingsAndLadder,
};
