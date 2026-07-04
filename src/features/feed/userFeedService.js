const { db } = require("../../lib/firestore");
const { resolveFeedContentType } = require("./feedContentType");

const MAX_FANOUT_FOLLOWERS = 500;
const BACKFILL_POST_LIMIT = 30;
const BATCH_WRITE_SIZE = 400;
const COLLECTION_GROUP_PAGE = 400;

function userFeedItemRef(followerId, postId) {
  return db
    .collection("userFeeds")
    .doc(followerId)
    .collection("items")
    .doc(postId);
}

async function getFollowerIds(authorId) {
  const snap = await db
    .collection("follows")
    .where("targetUserId", "==", authorId)
    .limit(MAX_FANOUT_FOLLOWERS)
    .get();

  return snap.docs
    .map((doc) => doc.data().followerId)
    .filter((id) => typeof id === "string" && id.trim().length > 0);
}

async function commitBatchWrites(writes) {
  for (let index = 0; index < writes.length; index += BATCH_WRITE_SIZE) {
    const batch = db.batch();
    const chunk = writes.slice(index, index + BATCH_WRITE_SIZE);
    for (const { ref, data } of chunk) {
      batch.set(ref, data, { merge: true });
    }
    await batch.commit();
  }
}

async function fanOutPostToFollowers({
  postId,
  authorId,
  createdAtMillis,
  feedContentType,
}) {
  if (!postId || !authorId) {
    return { fanOutCount: 0 };
  }

  const followerIds = await getFollowerIds(authorId);
  if (followerIds.length === 0) {
    return { fanOutCount: 0 };
  }

  const millis = typeof createdAtMillis === "number" ? createdAtMillis : Date.now();
  const resolvedFeedContentType =
    feedContentType && typeof feedContentType === "string"
      ? feedContentType
      : "tweet";
  const payload = {
    postId,
    authorId,
    createdAtMillis: millis,
    feedContentType: resolvedFeedContentType,
  };

  const writes = followerIds.map((followerId) => ({
    ref: userFeedItemRef(followerId, postId),
    data: payload,
  }));

  await commitBatchWrites(writes);
  return { fanOutCount: followerIds.length };
}

async function fanOutPostById(postId) {
  const snap = await db.collection("posts").doc(postId).get();
  if (!snap.exists) {
    return { fanOutCount: 0 };
  }

  const data = snap.data();
  return fanOutPostToFollowers({
    postId,
    authorId: data.authorId,
    createdAtMillis: data.createdAt?.toMillis?.() ?? Date.now(),
    feedContentType: resolveFeedContentType(data),
  });
}

async function deleteFeedItems(refs) {
  for (let index = 0; index < refs.length; index += BATCH_WRITE_SIZE) {
    const batch = db.batch();
    const chunk = refs.slice(index, index + BATCH_WRITE_SIZE);
    for (const ref of chunk) {
      batch.delete(ref);
    }
    await batch.commit();
  }
}

async function removePostFromUserFeeds(postId) {
  if (!postId) {
    return { removed: 0 };
  }

  let removed = 0;

  while (true) {
    const snap = await db
      .collectionGroup("items")
      .where("postId", "==", postId)
      .limit(COLLECTION_GROUP_PAGE)
      .get();

    if (snap.empty) {
      break;
    }

    await deleteFeedItems(snap.docs.map((doc) => doc.ref));
    removed += snap.size;

    if (snap.size < COLLECTION_GROUP_PAGE) {
      break;
    }
  }

  return { removed };
}

async function removeAuthorFromFollowerFeed(followerId, authorId) {
  if (!followerId || !authorId) {
    return { removed: 0 };
  }

  let removed = 0;

  while (true) {
    const snap = await db
      .collection("userFeeds")
      .doc(followerId)
      .collection("items")
      .where("authorId", "==", authorId)
      .limit(COLLECTION_GROUP_PAGE)
      .get();

    if (snap.empty) {
      break;
    }

    await deleteFeedItems(snap.docs.map((doc) => doc.ref));
    removed += snap.size;

    if (snap.size < COLLECTION_GROUP_PAGE) {
      break;
    }
  }

  return { removed };
}

async function backfillFollowerFeed(followerId, targetUserId) {
  if (!followerId || !targetUserId) {
    return { backfilled: 0 };
  }

  const postsSnap = await db
    .collection("posts")
    .where("authorId", "==", targetUserId)
    .orderBy("createdAt", "desc")
    .limit(BACKFILL_POST_LIMIT)
    .get();

  if (postsSnap.empty) {
    return { backfilled: 0 };
  }

  const writes = postsSnap.docs.map((doc) => {
    const data = doc.data();
    return {
      ref: userFeedItemRef(followerId, doc.id),
      data: {
        postId: doc.id,
        authorId: targetUserId,
        createdAtMillis: data.createdAt?.toMillis?.() ?? Date.now(),
      },
    };
  });

  await commitBatchWrites(writes);
  return { backfilled: writes.length };
}

module.exports = {
  fanOutPostToFollowers,
  fanOutPostById,
  removePostFromUserFeeds,
  removeAuthorFromFollowerFeed,
  backfillFollowerFeed,
};
