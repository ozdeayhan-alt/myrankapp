const { admin, db } = require("../../lib/firestore");
const { deletePostMedia } = require("../posts/deletePostMedia");
const { deleteObjectsByPrefix } = require("../../lib/storageMedia");
const { getOtherParticipantId } = require("../messages/conversationId");

const BATCH_SIZE = 300;

async function deleteDocuments(docs) {
  if (!docs.length) {
    return 0;
  }

  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const chunk = docs.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    for (const doc of chunk) {
      batch.delete(doc.ref);
    }
    await batch.commit();
  }

  return docs.length;
}

async function deleteQuery(query) {
  let total = 0;

  while (true) {
    const snap = await query.limit(BATCH_SIZE).get();
    if (snap.empty) {
      break;
    }
    total += await deleteDocuments(snap.docs);
  }

  return total;
}

async function deleteSubcollection(parentRef, name) {
  return deleteQuery(parentRef.collection(name));
}

async function deleteUserPosts(userId) {
  const postsSnap = await db
    .collection("posts")
    .where("authorId", "==", userId)
    .get();

  for (const doc of postsSnap.docs) {
    await deletePostMedia(doc.data());
  }

  return deleteDocuments(postsSnap.docs);
}

async function deleteRankingEntries(userId) {
  const entriesSnap = await db.collectionGroup("entries").get();
  const toDelete = entriesSnap.docs.filter((doc) => doc.id === userId);
  return deleteDocuments(toDelete);
}

async function deleteUserConversations(userId) {
  const convSnap = await db
    .collection("conversations")
    .where("participantIds", "array-contains", userId)
    .get();

  for (const convDoc of convSnap.docs) {
    await deleteSubcollection(convDoc.ref, "messages");

    const otherUserId = getOtherParticipantId(convDoc.id, userId);
    if (otherUserId) {
      await db
        .collection("users")
        .doc(otherUserId)
        .collection("inbox")
        .doc(convDoc.id)
        .delete()
        .catch(() => undefined);
    }

    await db
      .collection("users")
      .doc(userId)
      .collection("inbox")
      .doc(convDoc.id)
      .delete()
      .catch(() => undefined);

    await convDoc.ref.delete();
  }

  return convSnap.size;
}

async function deleteAccount(userId) {
  if (!userId || typeof userId !== "string") {
    throw new Error("userId gerekli");
  }

  const userRef = db.collection("users").doc(userId);

  await Promise.all([
    deleteUserPosts(userId),
    deleteObjectsByPrefix(`profiles/${userId}/`),
    deleteSubcollection(userRef, "notifications"),
    deleteSubcollection(userRef, "inbox"),
    deleteSubcollection(userRef, "pushTokens"),
  ]);

  await Promise.all([
    deleteQuery(db.collection("actorEngagements").where("actorId", "==", userId)),
    deleteQuery(db.collection("follows").where("followerId", "==", userId)),
    deleteQuery(db.collection("follows").where("targetUserId", "==", userId)),
    deleteQuery(db.collection("blocks").where("blockerId", "==", userId)),
    deleteQuery(db.collection("blocks").where("blockedUserId", "==", userId)),
    deleteQuery(db.collection("interactions").where("actorId", "==", userId)),
    deleteQuery(
      db.collection("profileVoteBatches").where("actorId", "==", userId)
    ),
    deleteQuery(
      db.collection("profileVoteBatches").where("targetUserId", "==", userId)
    ),
  ]);

  await deleteRankingEntries(userId);
  await deleteUserConversations(userId);

  await db.collection("publicProfiles").doc(userId).delete().catch(() => undefined);
  await userRef.delete().catch(() => undefined);

  await admin.auth().deleteUser(userId);

  return { ok: true, userId };
}

module.exports = { deleteAccount };
