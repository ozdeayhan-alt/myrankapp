const { db } = require("../../lib/firestore");
const { mapPostDoc } = require("./mapPostDoc");

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 50;

function encodeCursor(docId, updatedAtMillis) {
  const payload = `${docId}|updatedAt|${updatedAtMillis}`;
  return Buffer.from(payload, "utf8").toString("base64url");
}

function decodeCursor(cursor) {
  if (!cursor || typeof cursor !== "string") {
    return null;
  }

  try {
    const decoded = Buffer.from(cursor, "base64url").toString("utf8");
    const [docId, sortField, sortValue] = decoded.split("|");
    if (!docId || sortField !== "updatedAt") {
      return null;
    }
    return { docId, updatedAtMillis: Number(sortValue) || 0 };
  } catch {
    return null;
  }
}

async function fetchSavedPostsPage({
  userId,
  cursor = null,
  limit = DEFAULT_LIMIT,
} = {}) {
  const pageSize = Math.min(
    Math.max(Number(limit) || DEFAULT_LIMIT, 1),
    MAX_LIMIT
  );

  let query = db
    .collection("actorEngagements")
    .where("actorId", "==", userId)
    .where("saved", "==", true)
    .orderBy("updatedAt", "desc")
    .limit(pageSize + 1);

  const cursorInfo = decodeCursor(cursor);
  if (cursorInfo?.docId) {
    const cursorDoc = await db
      .collection("actorEngagements")
      .doc(cursorInfo.docId)
      .get();
    if (cursorDoc.exists) {
      query = query.startAfter(cursorDoc);
    }
  }

  const engagementSnap = await query.get();
  const engagementDocs = engagementSnap.docs;
  const hasMore = engagementDocs.length > pageSize;
  const pageDocs = hasMore
    ? engagementDocs.slice(0, pageSize)
    : engagementDocs;

  const postIds = pageDocs
    .map((doc) => doc.data().postId)
    .filter((id) => typeof id === "string" && id.trim().length > 0);

  if (postIds.length === 0) {
    return { posts: [], cursor: null, hasMore: false };
  }

  const postRefs = postIds.map((postId) => db.collection("posts").doc(postId));
  const postSnaps = await db.getAll(...postRefs);
  const postsById = new Map(
    postSnaps
      .filter((snap) => snap.exists)
      .map((snap) => [snap.id, mapPostDoc(snap.id, snap.data())])
  );

  const posts = postIds
    .map((postId) => postsById.get(postId))
    .filter(Boolean);

  const lastEngagement = pageDocs[pageDocs.length - 1] ?? null;
  const nextCursor = lastEngagement
    ? encodeCursor(
        lastEngagement.id,
        lastEngagement.data().updatedAt?.toMillis?.() ?? 0
      )
    : null;

  return {
    posts,
    cursor: hasMore ? nextCursor : null,
    hasMore,
  };
}

module.exports = {
  fetchSavedPostsPage,
};
