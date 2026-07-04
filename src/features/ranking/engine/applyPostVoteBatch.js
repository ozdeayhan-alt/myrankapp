const { FieldValue } = require("firebase-admin/firestore");
const { db } = require("../../../lib/firestore");
const { calculatePostScore } = require("./calculatePostScore");
const { syncPublicProfileInTransaction } = require("../../profile/syncPublicProfile");
const {
  invalidateEngagementCachesForUser,
} = require("./applyInteraction");
const {
  parseDelta,
  MAX_PROFILE_VOTE_DELTA,
} = require("./applyProfileVoteBatch");
const MAX_POST_VOTE_DELTA = MAX_PROFILE_VOTE_DELTA;

function actorDocId(actorId, postId) {
  return `${actorId}_${postId}`;
}

function getCountsFromPost(post) {
  return {
    likeCount: post.likeCount ?? 0,
    dislikeCount: post.dislikeCount ?? 0,
    shareCount: post.shareCount ?? 0,
    saveCount: post.saveCount ?? 0,
    commentCount: post.commentCount ?? 0,
  };
}

/** @param {ReturnType<typeof getCountsFromPost>} counts */
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
    shared: Boolean(eng.shared),
    saved: Boolean(eng.saved),
    liked: false,
    disliked: false,
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
 * Post ↑/↓ votes — cumulative taps batched to likeCount/dislikeCount + postScore.
 */
async function applyPostVoteBatch({ actorId, postId, delta: rawDelta }) {
  const delta = rawDelta;

  if (!postId || typeof postId !== "string") {
    throw new Error("postId is required");
  }

  if (!Number.isFinite(delta) || delta === 0) {
    throw new Error("delta must be a non-zero number");
  }

  if (Math.abs(delta) > MAX_POST_VOTE_DELTA) {
    throw new Error(`delta cannot exceed ${MAX_POST_VOTE_DELTA}`);
  }

  const postRef = db.collection("posts").doc(postId);
  const batchRef = db.collection("postVoteBatches").doc();

  return db.runTransaction(async (transaction) => {
    const postSnap = await transaction.get(postRef);
    if (!postSnap.exists) {
      throw new Error("Post not found");
    }

    const post = postSnap.data();
    const authorId = post.authorId;

    const userRef = db.collection("users").doc(authorId);
    const userSnap = await transaction.get(userRef);
    const engRef = db.collection("actorEngagements").doc(actorDocId(actorId, postId));
    const engSnap = await transaction.get(engRef);

    const counts = applyVoteDeltaToCounts(getCountsFromPost(post), delta);
    const oldPostScore = post.postScore ?? 0;
    const newPostScore = calculatePostScore({
      ...counts,
      likeBonusTotal: post.likeBonusTotal ?? 0,
      dislikeBonusTotal: post.dislikeBonusTotal ?? 0,
    });
    const scoreDelta = newPostScore - oldPostScore;
    const oldAuthorTotalScore = userSnap.exists
      ? (userSnap.data().totalScore ?? 0)
      : 0;
    const newAuthorTotalScore = oldAuthorTotalScore + scoreDelta;

    const eng = engSnap.exists ? engSnap.data() : {};
    const prevVoteNet = typeof eng.voteNet === "number" ? eng.voteNet : 0;
    const voteNet = prevVoteNet + delta;

    transaction.update(postRef, {
      ...counts,
      postScore: newPostScore,
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
        postId,
        voteNet,
        liked: FieldValue.delete(),
        disliked: FieldValue.delete(),
        likeBonusPoints: FieldValue.delete(),
        dislikeBonusPoints: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    transaction.set(batchRef, {
      actorId,
      postId,
      authorId,
      delta,
      createdAt: FieldValue.serverTimestamp(),
    });

    return {
      postId,
      authorId,
      actorId,
      delta,
      postScore: newPostScore,
      scoreDelta,
      authorTotalScore: newAuthorTotalScore,
      counts,
      engagement: buildEngagementFromEng(eng, voteNet),
    };
  }).then(async (result) => {
    await invalidateEngagementCachesForUser(actorId);
    return result;
  });
}

module.exports = {
  applyPostVoteBatch,
  applyVoteDeltaToCounts,
  MAX_POST_VOTE_DELTA,
  parseDelta,
};
