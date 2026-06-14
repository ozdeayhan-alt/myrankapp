const { FieldValue } = require("firebase-admin/firestore");
const { db } = require("../../../lib/firestore");
const { calculatePostScore } = require("./calculatePostScore");
const { syncPublicProfileInTransaction } = require("../../profile/syncPublicProfile");

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
  return typeof value === "number" && [33, 66, 99].includes(value) ? value : null;
}

function buildEngagementFromEng(eng = {}) {
  return {
    shared: Boolean(eng.shared),
    saved: Boolean(eng.saved),
    liked: Boolean(eng.liked),
    disliked: Boolean(eng.disliked),
    likeBonusPoints: parseBonusPoints(eng.likeBonusPoints),
    dislikeBonusPoints: parseBonusPoints(eng.dislikeBonusPoints),
  };
}

/**
 * Apply target liked/disliked in one transaction (matches sequential toggle rules).
 */
function transitionEngagement(counts, liked, disliked, targetLiked, targetDisliked) {
  const c = { ...counts };
  let l = Boolean(liked);
  let d = Boolean(disliked);

  if (l !== targetLiked) {
    if (targetLiked) {
      c.likeCount += 1;
      l = true;
      if (d) {
        c.dislikeCount = Math.max(0, c.dislikeCount - 1);
        d = false;
      }
    } else {
      c.likeCount = Math.max(0, c.likeCount - 1);
      l = false;
    }
  }

  if (d !== targetDisliked) {
    if (targetDisliked) {
      c.dislikeCount += 1;
      d = true;
      if (l) {
        c.likeCount = Math.max(0, c.likeCount - 1);
        l = false;
      }
    } else {
      c.dislikeCount = Math.max(0, c.dislikeCount - 1);
      d = false;
    }
  }

  return { counts: c, liked: l, disliked: d };
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
 * Sync actor engagement to target liked/disliked (session flush).
 */
async function applyInteractionSession({ postId, actorId, liked, disliked }) {
  if (typeof liked !== "boolean" || typeof disliked !== "boolean") {
    throw new Error("liked and disliked must be booleans");
  }

  if (liked && disliked) {
    throw new Error("liked and disliked cannot both be true");
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
    const startLiked = Boolean(eng.liked);
    const startDisliked = Boolean(eng.disliked);

    if (startLiked === liked && startDisliked === disliked) {
      const postScore = post.postScore ?? 0;
      const authorTotalScore = userSnap.exists
        ? (userSnap.data().totalScore ?? 0)
        : 0;

      return {
        postId,
        authorId,
        postScore,
        scoreDelta: 0,
        authorTotalScore,
        counts,
        engagement: buildEngagementFromEng(eng),
        alreadyInteracted: false,
        firstAction: false,
        unchanged: true,
        notifyType: null,
      };
    }

    const { counts: newCounts, liked: endLiked, disliked: endDisliked } =
      transitionEngagement(counts, startLiked, startDisliked, liked, disliked);

    const oldPostScore = post.postScore ?? 0;
    const newPostScore = calculatePostScore({
      ...newCounts,
      likeBonusTotal: post.likeBonusTotal ?? 0,
      dislikeBonusTotal: post.dislikeBonusTotal ?? 0,
    });
    const scoreDelta = newPostScore - oldPostScore;
    const oldAuthorTotalScore = userSnap.exists
      ? (userSnap.data().totalScore ?? 0)
      : 0;
    const newAuthorTotalScore = oldAuthorTotalScore + scoreDelta;

    const engagement = {
      ...buildEngagementFromEng(eng),
      liked: endLiked,
      disliked: endDisliked,
    };

    const interactionRef = db.collection("interactions").doc();
    const logType = endLiked && !startLiked ? "like" : endDisliked && !startDisliked ? "dislike" : "like";

    transaction.set(
      engRef,
      {
        actorId,
        postId,
        ...engagement,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    transaction.set(interactionRef, {
      type: logType,
      actorId,
      postId,
      authorId,
      pointsDelta: scoreDelta,
      alreadyInteracted: false,
      sessionSync: true,
      createdAt: FieldValue.serverTimestamp(),
    });

    transaction.update(postRef, {
      ...newCounts,
      postScore: newPostScore,
    });

    applyAuthorScoreUpdate(transaction, {
      userRef,
      userSnap,
      authorId,
      scoreDelta,
      newAuthorTotalScore,
    });

    let notifyType = null;
    if (endLiked && !startLiked) {
      notifyType = "like";
    }

    return {
      postId,
      authorId,
      postScore: newPostScore,
      scoreDelta,
      authorTotalScore: newAuthorTotalScore,
      counts: newCounts,
      engagement,
      alreadyInteracted: false,
      firstAction: true,
      unchanged: false,
      notifyType,
    };
  });
}

module.exports = {
  applyInteractionSession,
  transitionEngagement,
};
