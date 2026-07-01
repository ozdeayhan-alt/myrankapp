const { db } = require("../../lib/firestore");
const { createNotification } = require("../notifications/createNotification");

async function notifyMentions(actorId, postId, rawMentionUserIds) {
  if (!postId || typeof postId !== "string") {
    throw new Error("postId gerekli");
  }

  const postSnap = await db.collection("posts").doc(postId).get();
  if (!postSnap.exists) {
    throw new Error("Gönderi bulunamadı");
  }

  const postAuthorId = postSnap.data()?.authorId;
  if (!postAuthorId || postAuthorId !== actorId) {
    const error = new Error("Bu gönderi için mention bildirimi gönderemezsiniz");
    error.statusCode = 403;
    throw error;
  }

  const mentionUserIds = [
    ...new Set(
      (Array.isArray(rawMentionUserIds) ? rawMentionUserIds : [])
        .map((id) => String(id ?? "").trim())
        .filter(Boolean)
    ),
  ];

  if (mentionUserIds.length === 0) {
    return { ok: true, notified: 0 };
  }

  let notified = 0;

  for (const recipientId of mentionUserIds) {
    if (recipientId === actorId) {
      continue;
    }

    const notificationId = await createNotification({
      recipientId,
      actorId,
      type: "post_mentioned",
      payload: { postId },
    });

    if (notificationId) {
      notified += 1;
    }
  }

  return { ok: true, notified };
}

module.exports = { notifyMentions };
