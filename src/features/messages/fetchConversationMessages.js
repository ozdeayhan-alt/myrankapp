const { db } = require("../../lib/firestore");
const admin = require("../../../firebase-config");
const { getOtherParticipantId } = require("./conversationId");
const { MessageError } = require("./messageErrors");
const { signMessageMediaFields } = require("./signMessageMedia");

const DEFAULT_LIMIT = 200;
const INCREMENTAL_LIMIT = 50;

function mapMessageDoc(id, data) {
  const type =
    data.type === "image" || data.type === "video" ? data.type : "text";
  const text =
    typeof data.text === "string" && data.text.trim()
      ? data.text.trim()
      : undefined;

  return {
    id,
    senderId: String(data.senderId ?? ""),
    type,
    ...(text ? { text } : {}),
    ...(typeof data.mediaURL === "string" && data.mediaURL.trim()
      ? { mediaURL: data.mediaURL.trim() }
      : {}),
    ...(typeof data.posterURL === "string" && data.posterURL.trim()
      ? { posterURL: data.posterURL.trim() }
      : {}),
    createdAt: data.createdAt?.toDate?.()?.toISOString?.() ?? null,
  };
}

async function fetchConversationMessages(actorId, conversationId, options = {}) {
  if (!conversationId || typeof conversationId !== "string") {
    throw new MessageError(400, "conversationId gerekli");
  }

  const otherUserId = getOtherParticipantId(conversationId, actorId);
  if (!otherUserId) {
    throw new MessageError(403, "Bu sohbete erişiminiz yok");
  }

  const conversationRef = db.collection("conversations").doc(conversationId);
  const conversationSnap = await conversationRef.get();
  if (!conversationSnap.exists) {
    throw new MessageError(404, "Sohbet bulunamadı");
  }

  const participants = conversationSnap.data().participantIds ?? [];
  if (!participants.includes(actorId)) {
    throw new MessageError(403, "Bu sohbete erişiminiz yok");
  }

  const messagesRef = conversationRef.collection("messages");
  const after =
    typeof options.after === "string" ? options.after.trim() : "";

  let messages;

  if (after) {
    const afterSnap = await messagesRef.doc(after).get();
    if (!afterSnap.exists) {
      return [];
    }

    const limit =
      typeof options.limit === "number" && options.limit > 0
        ? Math.min(options.limit, INCREMENTAL_LIMIT)
        : INCREMENTAL_LIMIT;

    const snap = await messagesRef
      .orderBy("createdAt", "asc")
      .startAfter(afterSnap)
      .limit(limit)
      .get();

    messages = snap.docs.map((doc) => mapMessageDoc(doc.id, doc.data()));
  } else {
    const limit =
      typeof options.limit === "number" && options.limit > 0
        ? Math.min(options.limit, 500)
        : DEFAULT_LIMIT;

    const snap = await messagesRef
      .orderBy("createdAt", "desc")
      .limit(limit)
      .get();

    messages = snap.docs.reverse().map((doc) => mapMessageDoc(doc.id, doc.data()));
  }

  return signMessagesForViewer(messages);
}

async function signMessagesForViewer(messages) {
  const bucket =
    process.env.FIREBASE_STORAGE_BUCKET ||
    admin.storage().bucket().name;

  return Promise.all(
    messages.map((message) => signMessageMediaFields(message, bucket))
  );
}

module.exports = {
  fetchConversationMessages,
  mapMessageDoc,
  signMessagesForViewer,
};
