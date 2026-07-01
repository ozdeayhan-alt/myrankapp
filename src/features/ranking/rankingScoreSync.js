const { db } = require("../../lib/firestore");
const { upsertAuthorRankingsAsync } = require("./engine/updateRankings");
const { markRankingDirty } = require("./rankingDirtyService");

function afterAuthorScoreChange(userId, scoreDelta) {
  if (!userId || !Number.isFinite(scoreDelta) || scoreDelta === 0) {
    return;
  }

  void syncRankingScoresForUser(userId).catch((error) => {
    console.error(
      "[rankingScoreSync] failed:",
      userId,
      error.message ?? error
    );
  });
}

async function syncRankingScoresForUser(userId, { markDirty = true } = {}) {
  const userSnap = await db.collection("users").doc(userId).get();
  if (!userSnap.exists) {
    return;
  }

  const userData = userSnap.data();
  const totalScore =
    typeof userData.totalScore === "number" ? userData.totalScore : 0;

  await upsertAuthorRankingsAsync({
    userId,
    userData,
    totalScore,
  });
  if (markDirty) {
    await markRankingDirty(userId);
  }
}

async function syncDirtyUsersFromFirestore() {
  const { getDirtyUserIds } = require("./rankingDirtyService");
  const dirtyUserIds = await getDirtyUserIds();
  if (dirtyUserIds.length === 0) {
    return { synced: 0, total: 0 };
  }

  let synced = 0;
  for (const userId of dirtyUserIds) {
    try {
      await syncRankingScoresForUser(userId, { markDirty: false });
      synced += 1;
    } catch (error) {
      console.error(
        "[rankingScoreSync] dirty sync failed:",
        userId,
        error.message ?? error
      );
    }
  }

  return { synced, total: dirtyUserIds.length };
}

module.exports = {
  afterAuthorScoreChange,
  syncRankingScoresForUser,
  syncDirtyUsersFromFirestore,
};
