const { admin, db } = require("../../lib/firestore");
const { deletePostMedia } = require("../posts/deletePostMedia");
const { deleteObjectsByPrefix } = require("../../lib/storageMedia");
const { getOtherParticipantId } = require("../messages/conversationId");
const {
  getRankingSegmentKeys,
  GLOBAL_RANKING_SEGMENT,
} = require("../../lib/segmentKey");

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
  const userSnap = await db.collection("users").doc(userId).get();
  const segmentKeys = new Set([GLOBAL_RANKING_SEGMENT]);

  if (userSnap.exists) {
    const metadata = userSnap.data()?.metadata;
    for (const segmentKey of getRankingSegmentKeys(metadata)) {
      segmentKeys.add(segmentKey);
    }
  }

  let deleted = 0;
  await Promise.all(
    [...segmentKeys].map(async (segmentKey) => {
      const ref = db
        .collection("rankings")
        .doc(segmentKey)
        .collection("entries")
        .doc(userId);
      const snap = await ref.get();
      if (snap.exists) {
        await ref.delete();
        deleted += 1;
      }
    })
  );

  return deleted;
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
    deleteQuery(db.collection("actorStoryEngagements").where("actorId", "==", userId)),
    deleteQuery(db.collection("storyVoteBatches").where("actorId", "==", userId)),
    deleteQuery(db.collection("storyVoteBatches").where("authorId", "==", userId)),
  ]);

  await deleteRankingEntries(userId);
  await deleteUserConversations(userId);

  await db.collection("publicProfiles").doc(userId).delete().catch(() => undefined);
  await userRef.delete().catch(() => undefined);

  await admin.auth().deleteUser(userId);

  return { ok: true, userId };
}

module.exports = { deleteAccount };
