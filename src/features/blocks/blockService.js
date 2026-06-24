const { db } = require("../../lib/firestore");
const { BlockError } = require("./blockErrors");
const { buildBlockId } = require("./blockId");
const { getCached, setCached, invalidateCached, getCacheKey } = require("../feed/feedCache");

function invalidateBlockedUserCache(userId) {
  if (!userId) return;
  void invalidateCached(getCacheKey(["blocks", userId]));
}

async function getBlockedUserIds(userId) {
  if (!userId) {
    return new Set();
  }

  const cacheKey = getCacheKey(["blocks", userId]);
  const cached = await getCached(cacheKey);
  if (cached) {
    return cached instanceof Set ? cached : new Set(cached);
  }

  const [blockedByMeSnap, blockedMeSnap] = await Promise.all([
    db.collection("blocks").where("blockerId", "==", userId).get(),
    db.collection("blocks").where("blockedUserId", "==", userId).get(),
  ]);

  const blocked = new Set();

  for (const doc of blockedByMeSnap.docs) {
    const id = doc.data()?.blockedUserId;
    if (typeof id === "string" && id.trim()) {
      blocked.add(id.trim());
    }
  }

  for (const doc of blockedMeSnap.docs) {
    const id = doc.data()?.blockerId;
    if (typeof id === "string" && id.trim()) {
      blocked.add(id.trim());
    }
  }

  await setCached(cacheKey, blocked);
  return blocked;
}

async function assertUsersCanInteract(userId, otherUserId) {
  if (!userId || !otherUserId || userId === otherUserId) {
    return;
  }

  const blocked = await getBlockedUserIds(userId);
  if (blocked.has(otherUserId)) {
    throw new BlockError(403, "Bu kullanıcıyla etkileşim kurulamaz");
  }
}

async function getBlockStatus(blockerId, targetUserId) {
  if (!targetUserId || typeof targetUserId !== "string") {
    throw new BlockError(400, "targetUserId gerekli");
  }

  if (blockerId === targetUserId) {
    return { ok: true, targetUserId, blocked: false };
  }

  const ref = db.collection("blocks").doc(buildBlockId(blockerId, targetUserId));
  const snap = await ref.get();

  return {
    ok: true,
    targetUserId,
    blocked: snap.exists,
  };
}

async function blockUser(blockerId, blockedUserId) {
  if (!blockedUserId || typeof blockedUserId !== "string") {
    throw new BlockError(400, "targetUserId gerekli");
  }

  if (blockerId === blockedUserId) {
    throw new BlockError(400, "Kendinizi engelleyemezsiniz");
  }

  const ref = db.collection("blocks").doc(buildBlockId(blockerId, blockedUserId));
  const snap = await ref.get();

  if (snap.exists) {
    return { ok: true, targetUserId: blockedUserId, blocked: true };
  }

  await ref.set({
    blockerId,
    blockedUserId,
    createdAt: new Date(),
  });

  invalidateBlockedUserCache(blockerId);
  invalidateBlockedUserCache(blockedUserId);

  return { ok: true, targetUserId: blockedUserId, blocked: true };
}

async function unblockUser(blockerId, blockedUserId) {
  if (!blockedUserId || typeof blockedUserId !== "string") {
    throw new BlockError(400, "targetUserId gerekli");
  }

  if (blockerId === blockedUserId) {
    throw new BlockError(400, "Geçersiz işlem");
  }

  const ref = db.collection("blocks").doc(buildBlockId(blockerId, blockedUserId));
  const snap = await ref.get();

  if (!snap.exists) {
    return { ok: true, targetUserId: blockedUserId, blocked: false };
  }

  await ref.delete();

  invalidateBlockedUserCache(blockerId);
  invalidateBlockedUserCache(blockedUserId);

  return { ok: true, targetUserId: blockedUserId, blocked: false };
}

async function filterPostsForViewer(viewerId, page) {
  if (!viewerId || !page?.posts?.length) {
    return page;
  }

  const blocked = await getBlockedUserIds(viewerId);
  if (!blocked.size) {
    return page;
  }

  const posts = page.posts.filter((post) => !blocked.has(post.authorId));

  return {
    ...page,
    posts,
  };
}

async function filterUsersForViewer(viewerId, users) {
  if (!viewerId || !users?.length) {
    return users;
  }

  const blocked = await getBlockedUserIds(viewerId);
  if (!blocked.size) {
    return users;
  }

  return users.filter((user) => !blocked.has(user.userId));
}

module.exports = {
  getBlockedUserIds,
  assertUsersCanInteract,
  getBlockStatus,
  blockUser,
  unblockUser,
  filterPostsForViewer,
  filterUsersForViewer,
};
