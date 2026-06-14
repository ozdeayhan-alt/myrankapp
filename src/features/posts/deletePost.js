const { FieldValue } = require("firebase-admin/firestore");
const { db } = require("../../lib/firestore");
const { syncPublicProfileInTransaction } = require("../profile/syncPublicProfile");
const { PostError } = require("./postErrors");
const { deletePostMedia } = require("./deletePostMedia");
const { invalidateFeedCaches, invalidateFeedCachesForPost } = require("../feed/feedCache");
const {
  removePostFromUserFeeds,
} = require("../feed/userFeedService");

async function deletePost(postId, userId) {
  if (!postId || typeof postId !== "string") {
    throw new PostError(400, "postId gerekli");
  }

  const ref = db.collection("posts").doc(postId);
  const snap = await ref.get();

  if (!snap.exists) {
    throw new PostError(404, "Gönderi bulunamadı");
  }

  const data = snap.data();
  if (data.authorId !== userId) {
    throw new PostError(403, "Bu gönderiyi silme yetkiniz yok");
  }

  const postScore = typeof data.postScore === "number" ? data.postScore : 0;
  const authorId = data.authorId;

  await deletePostMedia(data);

  let authorTotalScore = null;

  await db.runTransaction(async (transaction) => {
    const postSnap = await transaction.get(ref);
    if (!postSnap.exists) {
      throw new PostError(404, "Gönderi bulunamadı");
    }

    transaction.delete(ref);

    if (postScore === 0) {
      return;
    }

    const userRef = db.collection("users").doc(authorId);
    const userSnap = await transaction.get(userRef);
    const oldTotalScore = userSnap.exists
      ? (userSnap.data().totalScore ?? 0)
      : 0;
    authorTotalScore = oldTotalScore - postScore;

    if (userSnap.exists) {
      transaction.update(userRef, {
        totalScore: FieldValue.increment(-postScore),
      });
      syncPublicProfileInTransaction(transaction, authorId, {
        userData: userSnap.data(),
        totalScore: authorTotalScore,
      });
    } else {
      transaction.set(userRef, { totalScore: authorTotalScore }, { merge: true });
      syncPublicProfileInTransaction(transaction, authorId, {
        totalScore: authorTotalScore,
      });
    }
  });

  await removePostFromUserFeeds(postId);

  invalidateFeedCachesForPost({
    authorId,
    segmentKey: data.segmentKey,
    hashtags: Array.isArray(data.hashtags) ? data.hashtags : [],
  });

  return {
    ok: true,
    postId,
    postScore,
    scoreDelta: -postScore,
    authorId,
    authorTotalScore,
  };
}

module.exports = { deletePost };
