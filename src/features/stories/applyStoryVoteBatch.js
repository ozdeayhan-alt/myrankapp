const { FieldValue } = require("firebase-admin/firestore");
const { db } = require("../../lib/firestore");
const { syncPublicProfileInTransaction } = require("../profile/syncPublicProfile");
const {
  parseDelta,
  MAX_PROFILE_VOTE_DELTA,
} = require("../ranking/engine/applyProfileVoteBatch");
const { calculateStoryScore } = require("./calculateStoryScore");
const {
  actorStoryEngagementId,
  loadAccessibleStory,
} = require("./storyAccess");
const { StoryError } = require("./storyErrors");
const { assertNotSelfVote } = require("../ranking/voteErrors");

const MAX_STORY_VOTE_DELTA = MAX_PROFILE_VOTE_DELTA;

function getCountsFromStory(story) {
  return {
    likeCount: story.likeCount ?? 0,
    dislikeCount: story.dislikeCount ?? 0,
  };
}

function applyVoteDeltaToCounts(counts, delta) {
  const next = { ...counts };
  if (delta > 0) {
    next.likeCount += delta;
  } else if (delta < 0) {
    next.dislikeCount += Math.abs(delta);
  }
  return next;
}

function buildEngagementFromEng(eng = {}, voteNet) {
  return {
    liked: Boolean(eng.liked),
    voteNet,
  };
}

function applyAuthorScoreUpdate(
  transaction,
  { userRef, userSnap, authorId, scoreDelta, newAuthorTotalScore }
) {
  if (scoreDelta === 0) {
    return;
  }

  if (userSnap.exists) {
    transaction.update(userRef, {
      totalScore: FieldValue.increment(scoreDelta),
    });
    syncPublicProfileInTransaction(transaction, authorId, {
      userData: userSnap.data(),
      totalScore: newAuthorTotalScore,
    });
  } else {
    transaction.set(userRef, { totalScore: newAuthorTotalScore }, { merge: true });
    syncPublicProfileInTransaction(transaction, authorId, {
      totalScore: newAuthorTotalScore,
    });
  }
}

/**
 * Story ↑/↓ votes — batched taps update likeCount/dislikeCount + storyScore.
 */
async function applyStoryVoteBatch({ actorId, storyId, delta: rawDelta }) {
  const delta = rawDelta;

  if (!storyId || typeof storyId !== "string") {
    throw new Error("storyId is required");
  }

  if (!Number.isFinite(delta) || delta === 0) {
    throw new Error("delta must be a non-zero number");
  }

  if (Math.abs(delta) > MAX_STORY_VOTE_DELTA) {
    throw new Error(`delta cannot exceed ${MAX_STORY_VOTE_DELTA}`);
  }

  const { ref: storyRef, data: storyData } = await loadAccessibleStory(
    actorId,
    storyId
  );
  const authorId = storyData.userId;
  assertNotSelfVote(actorId, authorId);

  const batchRef = db.collection("storyVoteBatches").doc();
  const userRef = db.collection("users").doc(authorId);
  const engRef = db
    .collection("actorStoryEngagements")
    .doc(actorStoryEngagementId(actorId, storyId));

  return db.runTransaction(async (transaction) => {
    const storySnap = await transaction.get(storyRef);
    if (!storySnap.exists) {
      throw new StoryError(404, "Story bulunamadı");
    }

    const story = storySnap.data();
    const userSnap = await transaction.get(userRef);
    const engSnap = await transaction.get(engRef);

    const counts = applyVoteDeltaToCounts(getCountsFromStory(story), delta);
    const oldStoryScore = story.storyScore ?? 0;
    const newStoryScore = calculateStoryScore(counts);
    const scoreDelta = newStoryScore - oldStoryScore;
    const oldAuthorTotalScore = userSnap.exists
      ? (userSnap.data().totalScore ?? 0)
      : 0;
    const newAuthorTotalScore = oldAuthorTotalScore + scoreDelta;

    const eng = engSnap.exists ? engSnap.data() : {};
    const prevVoteNet = typeof eng.voteNet === "number" ? eng.voteNet : 0;
    const voteNet = prevVoteNet + delta;

    transaction.update(storyRef, {
      ...counts,
      storyScore: newStoryScore,
    });

    applyAuthorScoreUpdate(transaction, {
      userRef,
      userSnap,
      authorId,
      scoreDelta,
      newAuthorTotalScore,
    });

    transaction.set(
      engRef,
      {
        actorId,
        storyId,
        voteNet,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    transaction.set(batchRef, {
      actorId,
      storyId,
      authorId,
      delta,
      createdAt: FieldValue.serverTimestamp(),
    });

    return {
      storyId,
      authorId,
      actorId,
      delta,
      storyScore: newStoryScore,
      scoreDelta,
      authorTotalScore: newAuthorTotalScore,
      counts,
      engagement: buildEngagementFromEng(eng, voteNet),
    };
  });
}

module.exports = {
  applyStoryVoteBatch,
  applyVoteDeltaToCounts,
  MAX_STORY_VOTE_DELTA,
  parseDelta,
};
