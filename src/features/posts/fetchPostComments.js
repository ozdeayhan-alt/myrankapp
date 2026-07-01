const { db } = require("../../lib/firestore");
const { resolveUsersPublic } = require("../messages/resolveUserPublic");

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 50;

function mapCommentDoc(id, data) {
  const createdAt = data.createdAt?.toDate?.();
  return {
    id,
    actorId: data.actorId ? String(data.actorId) : "",
    commentText: data.commentText ? String(data.commentText) : "",
    createdAt: createdAt ? createdAt.toISOString() : new Date().toISOString(),
    actorDisplayName:
      typeof data.actorDisplayName === "string" && data.actorDisplayName.trim()
        ? data.actorDisplayName.trim()
        : undefined,
    actorPhotoURL:
      typeof data.actorPhotoURL === "string" && data.actorPhotoURL.trim()
        ? data.actorPhotoURL.trim()
        : undefined,
  };
}

async function enrichCommentAuthors(comments) {
  if (!Array.isArray(comments) || comments.length === 0) {
    return comments;
  }

  const actorIds = [
    ...new Set(
      comments
        .filter(
          (comment) => comment.actorId && !comment.actorDisplayName?.trim()
        )
        .map((comment) => comment.actorId)
    ),
  ];

  if (actorIds.length === 0) {
    return comments;
  }

  const profiles = await resolveUsersPublic(actorIds);

  return comments.map((comment) => {
    if (comment.actorDisplayName?.trim()) {
      return comment;
    }
    const profile = profiles.get(comment.actorId);
    if (!profile) {
      return comment;
    }
    return {
      ...comment,
      actorDisplayName: profile.displayName,
      actorPhotoURL: profile.photoURL || comment.actorPhotoURL,
    };
  });
}

async function fetchPostComments(postId, limit = DEFAULT_LIMIT) {
  const normalizedPostId = String(postId ?? "").trim();
  if (!normalizedPostId) {
    return [];
  }

  const pageSize = Math.min(
    Math.max(Number(limit) || DEFAULT_LIMIT, 1),
    MAX_LIMIT
  );

  const snap = await db
    .collection("interactions")
    .where("postId", "==", normalizedPostId)
    .where("type", "==", "comment")
    .orderBy("createdAt", "desc")
    .limit(pageSize)
    .get();

  const comments = snap.docs.map((docSnap) =>
    mapCommentDoc(docSnap.id, docSnap.data())
  );

  return enrichCommentAuthors(comments);
}

module.exports = {
  fetchPostComments,
  DEFAULT_LIMIT,
  MAX_LIMIT,
};
