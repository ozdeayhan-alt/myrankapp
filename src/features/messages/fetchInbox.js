const { db } = require("../../lib/firestore");

function mapInboxDoc(conversationId, data) {
  const lastMessageAt = data.lastMessageAt?.toDate?.();
  return {
    conversationId,
    otherUserId: String(data.otherUserId ?? ""),
    otherDisplayName: String(data.otherDisplayName ?? "Kullanıcı"),
    ...(data.otherPhotoURL ? { otherPhotoURL: String(data.otherPhotoURL) } : {}),
    lastMessageText: String(data.lastMessageText ?? ""),
    lastMessageAt: lastMessageAt ? lastMessageAt.toISOString() : null,
    unreadCount:
      typeof data.unreadCount === "number" ? Math.max(0, data.unreadCount) : 0,
  };
}

async function fetchInboxEntries(userId) {
  const snap = await db
    .collection("users")
    .doc(userId)
    .collection("inbox")
    .orderBy("lastMessageAt", "desc")
    .get();

  return snap.docs.map((doc) => mapInboxDoc(doc.id, doc.data()));
}

module.exports = {
  fetchInboxEntries,
  mapInboxDoc,
};
