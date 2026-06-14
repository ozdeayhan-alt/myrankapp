const { db } = require("../../lib/firestore");
const { backfillFollowerFeed, removeAuthorFromFollowerFeed } = require("../feed/userFeedService");
const { assertUsersCanInteract } = require("../blocks/blockService");
const { createNotification } = require("../notifications/createNotification");
const { resolveUserPublic } = require("../messages/resolveUserPublic");
const { FollowError } = require("./followErrors");
const { buildFollowId } = require("./followId");

const DEFAULT_LIST_LIMIT = 30;
const MAX_LIST_LIMIT = 50;

function assertTargetUserId(targetUserId) {
  if (!targetUserId || typeof targetUserId !== "string") {
    throw new FollowError(400, "targetUserId gerekli");
  }
}

function parseListLimit(rawLimit) {
  const parsed = Number.parseInt(String(rawLimit ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_LIST_LIMIT;
  }
  return Math.min(parsed, MAX_LIST_LIMIT);
}

async function mapFollowDocsToUsers(docs, pickUserId) {
  return Promise.all(
    docs.map(async (doc) => {
      const data = doc.data();
      const userId = pickUserId(data);
      const profile = await resolveUserPublic(userId);
      return {
        userId: profile.userId,
        displayName: profile.displayName,
        photoURL: profile.photoURL ?? null,
      };
    })
  );
}

async function getFollowCounts(userId) {
  const [followingCountSnap, followersCountSnap] = await Promise.all([
    db.collection("follows").where("followerId", "==", userId).count().get(),
    db.collection("follows").where("targetUserId", "==", userId).count().get(),
  ]);

  return {
    ok: true,
    followingCount: followingCountSnap.data().count,
    followersCount: followersCountSnap.data().count,
  };
}

async function listFollowing(userId, { cursor = null, limit = DEFAULT_LIST_LIMIT } = {}) {
  const pageSize = parseListLimit(limit);
  let query = db
    .collection("follows")
    .where("followerId", "==", userId)
    .orderBy("createdAt", "desc")
    .limit(pageSize + 1);

  if (cursor) {
    const cursorDoc = await db.collection("follows").doc(String(cursor)).get();
    if (!cursorDoc.exists) {
      throw new FollowError(400, "Geçersiz cursor");
    }
    query = query.startAfter(cursorDoc);
  }

  const snap = await query.get();
  const docs = snap.docs;
  const hasMore = docs.length > pageSize;
  const pageDocs = hasMore ? docs.slice(0, pageSize) : docs;
  const users = await mapFollowDocsToUsers(pageDocs, (data) => data.targetUserId);

  return {
    ok: true,
    users,
    nextCursor: hasMore ? pageDocs[pageDocs.length - 1].id : null,
  };
}

async function listFollowers(userId, { cursor = null, limit = DEFAULT_LIST_LIMIT } = {}) {
  const pageSize = parseListLimit(limit);
  let query = db
    .collection("follows")
    .where("targetUserId", "==", userId)
    .orderBy("createdAt", "desc")
    .limit(pageSize + 1);

  if (cursor) {
    const cursorDoc = await db.collection("follows").doc(String(cursor)).get();
    if (!cursorDoc.exists) {
      throw new FollowError(400, "Geçersiz cursor");
    }
    query = query.startAfter(cursorDoc);
  }

  const snap = await query.get();
  const docs = snap.docs;
  const hasMore = docs.length > pageSize;
  const pageDocs = hasMore ? docs.slice(0, pageSize) : docs;
  const users = await mapFollowDocsToUsers(pageDocs, (data) => data.followerId);

  return {
    ok: true,
    users,
    nextCursor: hasMore ? pageDocs[pageDocs.length - 1].id : null,
  };
}

async function getFollowStatus(followerId, targetUserId) {
  assertTargetUserId(targetUserId);

  if (followerId === targetUserId) {
    return { ok: true, targetUserId, following: false };
  }

  const ref = db.collection("follows").doc(buildFollowId(followerId, targetUserId));
  const snap = await ref.get();

  return {
    ok: true,
    targetUserId,
    following: snap.exists,
  };
}

async function followUser(followerId, targetUserId) {
  assertTargetUserId(targetUserId);

  if (followerId === targetUserId) {
    throw new FollowError(400, "Kendinizi takip edemezsiniz");
  }

  await assertUsersCanInteract(followerId, targetUserId);

  const ref = db.collection("follows").doc(buildFollowId(followerId, targetUserId));
  const snap = await ref.get();

  if (snap.exists) {
    return { ok: true, targetUserId, following: true };
  }

  await ref.set({
    followerId,
    targetUserId,
    createdAt: new Date(),
  });

  void createNotification({
    recipientId: targetUserId,
    actorId: followerId,
    type: "user_followed",
    payload: {},
  }).catch((err) => {
    console.error("[notification]", err.message ?? err);
  });

  void backfillFollowerFeed(followerId, targetUserId).catch((error) => {
    console.error("[followUser] feed backfill failed:", error.message ?? error);
  });

  return { ok: true, targetUserId, following: true };
}

async function unfollowUser(followerId, targetUserId) {
  assertTargetUserId(targetUserId);

  if (followerId === targetUserId) {
    throw new FollowError(400, "Kendinizi takip edemezsiniz");
  }

  const ref = db.collection("follows").doc(buildFollowId(followerId, targetUserId));
  const snap = await ref.get();

  if (!snap.exists) {
    return { ok: true, targetUserId, following: false };
  }

  await ref.delete();

  void removeAuthorFromFollowerFeed(followerId, targetUserId).catch((error) => {
    console.error("[unfollowUser] feed trim failed:", error.message ?? error);
  });

  return { ok: true, targetUserId, following: false };
}

module.exports = {
  getFollowStatus,
  followUser,
  unfollowUser,
  getFollowCounts,
  listFollowing,
  listFollowers,
};
