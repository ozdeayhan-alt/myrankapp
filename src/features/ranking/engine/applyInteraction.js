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
async function applyInteraction({
  postId,
  actorId,
  type,
  commentText,
  parentCommentId,
}) {
  if (!COUNT_FIELD[type]) {
    throw new Error(`Invalid interaction type: ${type}`);
  }

  const actorProfile =
    type === "comment" ? await resolveUserPublic(actorId) : null;

  const normalizedParentId =
    typeof parentCommentId === "string" && parentCommentId.trim()
      ? parentCommentId.trim()
      : null;

  const postRef = db.collection("posts").doc(postId);
  const interactionRef =
    type === "comment" ? db.collection("interactions").doc() : null;
  const parentRef = normalizedParentId
    ? db.collection("interactions").doc(normalizedParentId)
    : null;

  return db.runTransaction(async (transaction) => {
    const postSnap = await transaction.get(postRef);
    if (!postSnap.exists) {
      throw new Error("Post not found");
    }

    const post = postSnap.data();
    const authorId = post.authorId;
    let parentComment = null;

    if (type === "comment" && normalizedParentId && parentRef) {
      const parentSnap = await transaction.get(parentRef);
      if (!parentSnap.exists) {
        throw new Error("Yanıtlanan yorum bulunamadı");
      }
      parentComment = parentSnap.data();
      if (
        parentComment.type !== "comment" ||
        parentComment.postId !== postId
      ) {
        throw new Error("Geçersiz üst yorum");
      }
      if (parentComment.parentCommentId) {
        throw new Error("Yanıtlara yanıt verilemez");
      }
    }

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

    if (type === "comment" && commentText?.trim() && interactionRef) {
      interactionData.commentText = commentText.trim();
      if (actorProfile?.displayName) {
        interactionData.actorDisplayName = actorProfile.displayName;
      }
      if (actorProfile?.photoURL) {
        interactionData.actorPhotoURL = actorProfile.photoURL;
      }
      if (normalizedParentId && parentComment) {
        interactionData.parentCommentId = normalizedParentId;
        interactionData.replyToActorId = parentComment.actorId
          ? String(parentComment.actorId)
          : "";
        if (parentComment.actorDisplayName?.trim()) {
          interactionData.replyToDisplayName =
            parentComment.actorDisplayName.trim();
        }
      }
      transaction.set(interactionRef, interactionData);
    }

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

    if (type === "comment" && commentText?.trim() && interactionRef) {
      result.comment = {
        id: interactionRef.id,
        actorId,
        commentText: commentText.trim(),
        createdAt: new Date().toISOString(),
        actorDisplayName: actorProfile?.displayName ?? "",
        actorPhotoURL: actorProfile?.photoURL ?? "",
        ...(normalizedParentId ? { parentCommentId: normalizedParentId } : {}),
        ...(parentComment?.actorId
          ? { replyToActorId: String(parentComment.actorId) }
          : {}),
        ...(parentComment?.actorDisplayName?.trim()
          ? { replyToDisplayName: parentComment.actorDisplayName.trim() }
          : {}),
      };

      const notifyRecipientIds = new Set();
      if (authorId !== actorId) {
        notifyRecipientIds.add(authorId);
      }
      if (
        parentComment?.actorId &&
        parentComment.actorId !== actorId &&
        parentComment.actorId !== authorId
      ) {
        notifyRecipientIds.add(String(parentComment.actorId));
      }
      result.notifyRecipientIds = [...notifyRecipientIds];
    }

    return result;
  }).then((result) => {
    void invalidateEngagementCachesForUser(actorId);
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

const {
  getCached,
  setCached,
  getCacheKey,
  invalidateMatchingFeedCache,
} = require("../../feed/feedCache");

const ENGAGEMENT_CACHE_TTL_MS =
  Number(process.env.ENGAGEMENT_CACHE_TTL_MS) || 120_000;

function engagementCacheKey(actorId, postIds) {
  const sorted = [...postIds].sort();
  return getCacheKey(["engagements", actorId, sorted.join(",")]);
}

async function invalidateEngagementCachesForUser(userId) {
  if (!userId) {
    return;
  }
  const prefix = `engagements:${userId}:`;
  await invalidateMatchingFeedCache((key) => key.startsWith(prefix));
}

async function getBatchEngagementStatus({ postIds, actorId }) {
  const uniqueIds = [...new Set(postIds.filter((id) => typeof id === "string" && id))].slice(
    0,
    MAX_BATCH_ENGAGEMENT
  );

  if (uniqueIds.length === 0) {
    return {};
  }

  if (actorId) {
    const cacheKey = engagementCacheKey(actorId, uniqueIds);
    const cached = await getCached(cacheKey);
    if (cached && typeof cached === "object") {
      return cached;
    }
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

  if (actorId) {
    await setCached(
      engagementCacheKey(actorId, uniqueIds),
      engagements,
      ENGAGEMENT_CACHE_TTL_MS
    );
  }

  return engagements;
}

module.exports = {
  applyInteraction,
  getEngagementStatus,
  getBatchEngagementStatus,
  invalidateEngagementCachesForUser,
};
