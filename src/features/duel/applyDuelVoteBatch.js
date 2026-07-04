const { applyPostVoteBatch } = require("../ranking/engine/applyPostVoteBatch");
const { afterAuthorScoreChange } = require("../ranking/rankingScoreSync");
const { clampDuelDelta } = require("./clampDuelDelta");

function normalizeVoteEntry(entry) {
  if (!entry || typeof entry !== "object") {
    return null;
  }
  const postId =
    typeof entry.postId === "string" ? entry.postId.trim() : "";
  const delta = Number(entry.delta);
  if (!postId || !Number.isFinite(delta) || delta === 0) {
    return null;
  }
  const clamped = clampDuelDelta(delta);
  if (clamped === 0) {
    return null;
  }
  return { postId, delta: clamped, requestedDelta: delta };
}

/**
 * Applies duel vote deltas for up to two posts in one request.
 * Reuses applyPostVoteBatch; excess delta is silently clamped.
 */
async function applyDuelVoteBatch({ actorId, votes }) {
  if (!Array.isArray(votes) || votes.length === 0) {
    throw new Error("votes array is required");
  }
  if (votes.length > 2) {
    throw new Error("At most 2 vote entries per duel batch");
  }

  const normalized = votes
    .map(normalizeVoteEntry)
    .filter(Boolean);

  if (normalized.length === 0) {
    throw new Error("No valid vote deltas");
  }

  const results = [];
  for (const vote of normalized) {
    const result = await applyPostVoteBatch({
      actorId,
      postId: vote.postId,
      delta: vote.delta,
    });
    afterAuthorScoreChange(result.authorId, result.scoreDelta);
    results.push({
      ...result,
      requestedDelta: vote.requestedDelta,
      appliedDelta: vote.delta,
    });
  }

  return { results };
}

module.exports = { applyDuelVoteBatch, normalizeVoteEntry };
