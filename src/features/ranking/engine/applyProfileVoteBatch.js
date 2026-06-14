const { FieldValue } = require("firebase-admin/firestore");
const { db } = require("../../../lib/firestore");
const { syncPublicProfileInTransaction } = require("../../profile/syncPublicProfile");

const MAX_PROFILE_VOTE_DELTA = 10_000;

function parseDelta(body) {
  if (typeof body.delta === "number" && Number.isFinite(body.delta)) {
    return Math.trunc(body.delta);
  }

  const up = Number(body.up);
  const down = Number(body.down);
  if (Number.isFinite(up) || Number.isFinite(down)) {
    const upCount = Number.isFinite(up) ? Math.max(0, Math.floor(up)) : 0;
    const downCount = Number.isFinite(down) ? Math.max(0, Math.floor(down)) : 0;
    return upCount - downCount;
  }

  return null;
}

/**
 * Profile ↑/↓ votes — adjusts target users.totalScore only (no ranking denorm).
 */
async function applyProfileVoteBatch({ actorId, targetUserId, delta: rawDelta }) {
  const delta = rawDelta;

  if (!targetUserId || typeof targetUserId !== "string") {
    throw new Error("targetUserId is required");
  }

  if (!Number.isFinite(delta) || delta === 0) {
    throw new Error("delta must be a non-zero number");
  }

  if (Math.abs(delta) > MAX_PROFILE_VOTE_DELTA) {
    throw new Error(`delta cannot exceed ${MAX_PROFILE_VOTE_DELTA}`);
  }

  const userRef = db.collection("users").doc(targetUserId);
  const batchRef = db.collection("profileVoteBatches").doc();

  return db.runTransaction(async (transaction) => {
    const userSnap = await transaction.get(userRef);
    if (!userSnap.exists) {
      throw new Error("User not found");
    }

    const userData = userSnap.data();
    const oldTotalScore = userData.totalScore ?? 0;
    const newTotalScore = oldTotalScore + delta;

    transaction.update(userRef, {
      totalScore: FieldValue.increment(delta),
    });

    syncPublicProfileInTransaction(transaction, targetUserId, {
      userData,
      totalScore: newTotalScore,
    });

    transaction.set(batchRef, {
      actorId,
      targetUserId,
      delta,
      createdAt: FieldValue.serverTimestamp(),
    });

    return {
      targetUserId,
      actorId,
      delta,
      totalScore: newTotalScore,
      scoreDelta: delta,
    };
  });
}

module.exports = {
  applyProfileVoteBatch,
  MAX_PROFILE_VOTE_DELTA,
  parseDelta,
};
