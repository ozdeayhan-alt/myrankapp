const { FieldValue } = require("firebase-admin/firestore");
const { db } = require("../../lib/firestore");
const { sendPushForNotification } = require("../push/sendExpoPush");

const NOTIFICATION_TYPES = new Set([
  "post_liked",
  "post_commented",
  "post_saved",
  "post_reposted",
  "message_received",
  "profile_votes",
  "rank_passed",
  "user_followed",
  "post_mentioned",
]);

/**
 * In-app notification for "Sen yokken neler oldu?" (client reads via API).
 */
async function createNotification({
  recipientId,
  actorId,
  type,
  payload = {},
}) {
  if (!recipientId || !actorId || recipientId === actorId) {
    return null;
  }

  if (!NOTIFICATION_TYPES.has(type)) {
    throw new Error(`Invalid notification type: ${type}`);
  }

  const actorSnap = await db.collection("users").doc(actorId).get();
  const actorDisplayName =
    actorSnap.exists && String(actorSnap.data().displayName ?? "").trim()
      ? String(actorSnap.data().displayName).trim()
      : "Biri";

  const ref = await db
    .collection("users")
    .doc(recipientId)
    .collection("notifications")
    .add({
      type,
      actorId,
      actorDisplayName,
      payload,
      createdAt: FieldValue.serverTimestamp(),
    });

  void sendPushForNotification({
    recipientId,
    notificationId: ref.id,
    type,
    actorId,
    actorDisplayName,
    payload,
  });

  return ref.id;
}

async function notifyPostInteraction({
  authorId,
  actorId,
  postId,
  type,
}) {
  const typeMap = {
    like: "post_liked",
    comment: "post_commented",
    save: "post_saved",
  };

  const notificationType = typeMap[type];
  if (!notificationType) {
    return null;
  }

  return createNotification({
    recipientId: authorId,
    actorId,
    type: notificationType,
    payload: { postId },
  });
}

async function notifyProfileVotes({ targetUserId, actorId, delta }) {
  if (delta <= 0) {
    return null;
  }

  return createNotification({
    recipientId: targetUserId,
    actorId,
    type: "profile_votes",
    payload: { voteDelta: delta },
  });
}

async function notifyPostVotes({ authorId, actorId, postId, delta }) {
  if (delta <= 0) {
    return null;
  }

  return createNotification({
    recipientId: authorId,
    actorId,
    type: "post_liked",
    payload: { postId, voteDelta: delta },
  });
}

module.exports = {
  createNotification,
  notifyPostInteraction,
  notifyProfileVotes,
  notifyPostVotes,
  NOTIFICATION_TYPES,
};
