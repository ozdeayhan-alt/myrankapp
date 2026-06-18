const { FieldValue } = require("firebase-admin/firestore");
const { db } = require("../../../lib/firestore");
const { calculatePostScore } = require("./calculatePostScore");
const { syncPublicProfileInTransaction } = require("../../profile/syncPublicProfile");
const { resolveUserPublic } = require("../../messages/resolveUserPublic");

const COUNT_FIELD = {
  share: "shareCount",
  comment: "commentCount",
  save: "saveCount",
};

const ONE_TIME_TYPES = new Set(["share", "save"]);
const REPEAT_POINTS = 1;

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

function buildEngagementFromDoc(eng = {}) {
  const voteNet =
    typeof eng.voteNet === "number" && Number.isFinite(eng.voteNet)
      ? eng.voteNet
      : 0;

  return {
    shared: Boolean(eng.shared),
    saved: Boolean(eng.saved),
    liked: false,
    disliked: false,
    voteNet,
  };
}

function getBonusTotals(post) {
  return {
    likeBonusTotal: post.likeBonusTotal ?? 0,
    dislikeBonusTotal: post.dislikeBonusTotal ?? 0,
  };
}

function buildResultBase({
  postId,
  authorId,
  postScore,
  scoreDelta,
  authorTotalScore,
  counts,
  engagement,
  alreadyInteracted = false,
  firstAction = true,
}) {
  return {
    postId,
    authorId,
    postScore,
    scoreDelta,
    authorTotalScore,
    counts,
    engagement,
    alreadyInteracted,
    firstAction,
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
 * Etkileşim -> atomic DB update (interaction + post + user.totalScore)
 */
async function applyInteraction({ postId, actorId, type, commentText }) {
  if (!COUNT_FIELD[type]) {
    throw new Error(`Invalid interaction type: ${type}`);
  }

  const actorProfile =
    type === "comment" ? await resolveUserPublic(actorId) : null;

  const postRef = db.collection("posts").doc(postId);
  const interactionRef = db.collection("interactions").doc();

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

    const counts = getCountsFromPost(post);
    const oldPostScore = post.postScore ?? 0;
    const oldAuthorTotalScore = userSnap.exists
      ? (userSnap.data().totalScore ?? 0)
      : 0;

    const eng = engSnap.exists ? engSnap.data() : {};
    let engagement = buildEngagementFromDoc(eng);

    if (ONE_TIME_TYPES.has(type)) {
      const field = type === "share" ? "shared" : "saved";
      const alreadyInteracted = Boolean(engSnap.exists && eng[field]);

      if (alreadyInteracted) {
        const scoreDelta = REPEAT_POINTS;
        const newPostScore = oldPostScore + REPEAT_POINTS;
        const newAuthorTotalScore = oldAuthorTotalScore + REPEAT_POINTS;

        transaction.set(interactionRef, {
          type,
          actorId,
          postId,
          authorId,
          pointsDelta: REPEAT_POINTS,
          alreadyInteracted: true,
          createdAt: FieldValue.serverTimestamp(),
        });

        transaction.update(postRef, { postScore: newPostScore });

        applyAuthorScoreUpdate(transaction, {
          userRef,
          userSnap,
          authorId,
          scoreDelta,
          newAuthorTotalScore,
        });

        return buildResultBase({
          postId,
          authorId,
          postScore: newPostScore,
          scoreDelta,
          authorTotalScore: newAuthorTotalScore,
          counts,
          engagement,
          alreadyInteracted: true,
          firstAction: false,
        });
      }

      transaction.set(
        engRef,
        {
          actorId,
          postId,
          [field]: true,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      engagement = {
        ...engagement,
        [field]: true,
      };
    }

    counts[COUNT_FIELD[type]] += 1;

    const newPostScore = calculatePostScore({
      ...counts,
      ...getBonusTotals(post),
    });
    const scoreDelta = newPostScore - oldPostScore;
    const newAuthorTotalScore = oldAuthorTotalScore + scoreDelta;

    const interactionData = {
      type,
      actorId,
      postId,
      authorId,
      pointsDelta: scoreDelta,
      alreadyInteracted: false,
      createdAt: FieldValue.serverTimestamp(),
    };

    if (type === "comment" && commentText?.trim()) {
      interactionData.commentText = commentText.trim();
      if (actorProfile?.displayName) {
        interactionData.actorDisplayName = actorProfile.displayName;
      }
      if (actorProfile?.photoURL) {
        interactionData.actorPhotoURL = actorProfile.photoURL;
      }
    }

    transaction.set(interactionRef, interactionData);

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

    const result = buildResultBase({
      postId,
      authorId,
      postScore: newPostScore,
      scoreDelta,
      authorTotalScore: newAuthorTotalScore,
      counts,
      engagement,
    });

    if (type === "comment" && commentText?.trim()) {
      result.comment = {
        id: interactionRef.id,
        actorId,
        commentText: commentText.trim(),
        createdAt: new Date().toISOString(),
        actorDisplayName: actorProfile?.displayName ?? "",
        actorPhotoURL: actorProfile?.photoURL ?? "",
      };
    }

    return result;
  });
}

async function getEngagementStatus({ postId, actorId }) {
  const engSnap = await db
    .collection("actorEngagements")
    .doc(actorDocId(actorId, postId))
    .get();

  const eng = engSnap.exists ? engSnap.data() : {};
  return buildEngagementFromDoc(eng);
}

const MAX_BATCH_ENGAGEMENT = 50;

async function getBatchEngagementStatus({ postIds, actorId }) {
  const uniqueIds = [...new Set(postIds.filter((id) => typeof id === "string" && id))].slice(
    0,
    MAX_BATCH_ENGAGEMENT
  );

  if (uniqueIds.length === 0) {
    return {};
  }

  const engagementRefs = uniqueIds.map((postId) =>
    db.collection("actorEngagements").doc(actorDocId(actorId, postId))
  );

  const engagementSnaps = await db.getAll(...engagementRefs);
  const engagements = {};

  uniqueIds.forEach((postId, index) => {
    const eng = engagementSnaps[index]?.exists ? engagementSnaps[index].data() : {};
    engagements[postId] = buildEngagementFromDoc(eng);
  });

  return engagements;
}

module.exports = {
  applyInteraction,
  getEngagementStatus,
  getBatchEngagementStatus,
};
