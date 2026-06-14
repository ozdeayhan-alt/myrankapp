const { FieldValue } = require("firebase-admin/firestore");
const { db } = require("../../../lib/firestore");
const { LIKE_BONUS_TIERS } = require("../../../config/scoring");
const { calculatePostScore } = require("./calculatePostScore");
const { syncPublicProfileInTransaction } = require("../../profile/syncPublicProfile");

const LIKE_BONUS_SET = new Set(LIKE_BONUS_TIERS);

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

function parseBonusPoints(value) {
  return typeof value === "number" && LIKE_BONUS_SET.has(value) ? value : null;
}

function buildEngagementFromDoc(eng = {}) {
  return {
    shared: Boolean(eng.shared),
    saved: Boolean(eng.saved),
    liked: Boolean(eng.liked),
    disliked: Boolean(eng.disliked),
    likeBonusPoints: parseBonusPoints(eng.likeBonusPoints),
    dislikeBonusPoints: parseBonusPoints(eng.dislikeBonusPoints),
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
 * Basılı tut beğeni bonusu — toggle beğeniden bağımsız ekstra puan.
 */
async function applyLikeBonus({ postId, actorId, bonusPoints }) {
  if (!LIKE_BONUS_SET.has(bonusPoints)) {
    throw new Error("bonusPoints must be 33, 66, or 99");
  }

  const postRef = db.collection("posts").doc(postId);
  const engRef = db.collection("actorEngagements").doc(actorDocId(actorId, postId));

  return db.runTransaction(async (transaction) => {
    const postSnap = await transaction.get(postRef);
    if (!postSnap.exists) {
      throw new Error("Post not found");
    }

    const post = postSnap.data();
    const authorId = post.authorId;
    const userRef = db.collection("users").doc(authorId);
    const userSnap = await transaction.get(userRef);
    const engSnap = await transaction.get(engRef);

    const counts = getCountsFromPost(post);
    const eng = engSnap.exists ? engSnap.data() : {};
    const oldBonusPoints = eng.likeBonusPoints ?? 0;
    const delta = bonusPoints - oldBonusPoints;

    const oldLikeBonusTotal = post.likeBonusTotal ?? 0;
    const oldPostScore = post.postScore ?? 0;
    const oldAuthorTotalScore = userSnap.exists
      ? (userSnap.data().totalScore ?? 0)
      : 0;

    const engagement = buildEngagementFromDoc(eng);

    if (delta === 0) {
      return {
        postId,
        authorId,
        postScore: oldPostScore,
        scoreDelta: 0,
        authorTotalScore: oldAuthorTotalScore,
        likeBonusTotal: oldLikeBonusTotal,
        counts,
        engagement: { ...engagement, likeBonusPoints: bonusPoints },
        unchanged: true,
      };
    }

    const newLikeBonusTotal = oldLikeBonusTotal + delta;
    const newPostScore = calculatePostScore({
      ...counts,
      likeBonusTotal: newLikeBonusTotal,
      dislikeBonusTotal: post.dislikeBonusTotal ?? 0,
    });
    const scoreDelta = newPostScore - oldPostScore;
    const newAuthorTotalScore = oldAuthorTotalScore + scoreDelta;

    const interactionRef = db.collection("interactions").doc();

    transaction.set(
      engRef,
      {
        actorId,
        postId,
        likeBonusPoints: bonusPoints,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    transaction.set(interactionRef, {
      type: "like_bonus",
      actorId,
      postId,
      authorId,
      bonusPoints,
      pointsDelta: scoreDelta,
      createdAt: FieldValue.serverTimestamp(),
    });

    transaction.update(postRef, {
      likeBonusTotal: newLikeBonusTotal,
      postScore: newPostScore,
    });

    applyAuthorScoreUpdate(transaction, {
      userRef,
      userSnap,
      authorId,
      scoreDelta,
      newAuthorTotalScore,
    });

    return {
      postId,
      authorId,
      postScore: newPostScore,
      scoreDelta,
      authorTotalScore: newAuthorTotalScore,
      likeBonusTotal: newLikeBonusTotal,
      counts,
      engagement: {
        ...engagement,
        likeBonusPoints: bonusPoints,
      },
      unchanged: false,
    };
  });
}

module.exports = {
  applyLikeBonus,
};
