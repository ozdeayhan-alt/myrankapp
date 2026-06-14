const { FieldValue } = require("firebase-admin/firestore");
const { db } = require("../../../lib/firestore");
const { LIKE_BONUS_TIERS } = require("../../../config/scoring");
const { calculatePostScore } = require("./calculatePostScore");
const { syncPublicProfileInTransaction } = require("../../profile/syncPublicProfile");

const BONUS_SET = new Set(LIKE_BONUS_TIERS);

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
  return typeof value === "number" && BONUS_SET.has(value) ? value : null;
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
 * Basılı tut beğenmeme bonusu — toggle beğenmemeden bağımsız ekstra ceza puanı.
 */
async function applyDislikeBonus({ postId, actorId, bonusPoints }) {
  if (!BONUS_SET.has(bonusPoints)) {
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
    const oldBonusPoints = eng.dislikeBonusPoints ?? 0;
    const delta = bonusPoints - oldBonusPoints;

    const oldDislikeBonusTotal = post.dislikeBonusTotal ?? 0;
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
        dislikeBonusTotal: oldDislikeBonusTotal,
        counts,
        engagement: { ...engagement, dislikeBonusPoints: bonusPoints },
        unchanged: true,
      };
    }

    const newDislikeBonusTotal = oldDislikeBonusTotal + delta;
    const newPostScore = calculatePostScore({
      ...counts,
      likeBonusTotal: post.likeBonusTotal ?? 0,
      dislikeBonusTotal: newDislikeBonusTotal,
    });
    const scoreDelta = newPostScore - oldPostScore;
    const newAuthorTotalScore = oldAuthorTotalScore + scoreDelta;

    const interactionRef = db.collection("interactions").doc();

    transaction.set(
      engRef,
      {
        actorId,
        postId,
        dislikeBonusPoints: bonusPoints,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    transaction.set(interactionRef, {
      type: "dislike_bonus",
      actorId,
      postId,
      authorId,
      bonusPoints,
      pointsDelta: scoreDelta,
      createdAt: FieldValue.serverTimestamp(),
    });

    transaction.update(postRef, {
      dislikeBonusTotal: newDislikeBonusTotal,
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
      dislikeBonusTotal: newDislikeBonusTotal,
      counts,
      engagement: {
        ...engagement,
        dislikeBonusPoints: bonusPoints,
      },
      unchanged: false,
    };
  });
}

module.exports = {
  applyDislikeBonus,
};
