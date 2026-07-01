const { FieldValue } = require("firebase-admin/firestore");
const { db } = require("../../lib/firestore");
const { buildConversationId, getOtherParticipantId } = require("./conversationId");
const { MessageError } = require("./messageErrors");
const { resolveUsersPublic } = require("./resolveUserPublic");
const { assertUsersCanInteract } = require("../blocks/blockService");
const { createNotification } = require("../notifications/createNotification");
const { assertAllowedMediaURL } = require("../../lib/validateMediaUrl");
const { invalidateInboxCacheQuiet } = require("./inboxCache");

const MESSAGE_MAX_LENGTH = 2000;
const MESSAGE_TYPES = new Set(["text", "image", "video"]);

function normalizeText(text) {
  if (typeof text !== "string") {
    throw new MessageError(400, "text metin olmalı");
  }
  const trimmed = text.trim();
  if (!trimmed) {
    throw new MessageError(400, "Mesaj boş olamaz");
  }
  if (trimmed.length > MESSAGE_MAX_LENGTH) {
    throw new MessageError(
      400,
      `Mesaj en fazla ${MESSAGE_MAX_LENGTH} karakter olabilir`
    );
  }
  return trimmed;
}

function normalizeMessageType(type) {
  const normalized = String(type ?? "text").trim().toLowerCase();
  if (!MESSAGE_TYPES.has(normalized)) {
    throw new MessageError(400, "Geçersiz mesaj tipi");
  }
  return normalized;
}

function previewTextForMessage({ type, text, mediaURL }) {
  if (type === "image") {
    return "📷 Fotoğraf";
  }
  if (type === "video") {
    return "🎬 Video";
  }
  return text;
}

function inboxRef(userId, conversationId) {
  return db
    .collection("users")
    .doc(userId)
    .collection("inbox")
    .doc(conversationId);
}

async function openConversation(actorId, targetUserId) {
  if (!targetUserId || typeof targetUserId !== "string") {
    throw new MessageError(400, "targetUserId gerekli");
  }
  if (actorId === targetUserId) {
    throw new MessageError(400, "Kendinize mesaj gönderemezsiniz");
  }

  await assertUsersCanInteract(actorId, targetUserId);

  const conversationId = buildConversationId(actorId, targetUserId);
  const conversationRef = db.collection("conversations").doc(conversationId);
  const profiles = await resolveUsersPublic([actorId, targetUserId]);
  const actorPublic =
    profiles.get(actorId) ?? {
      userId: actorId,
      displayName: "Kullanıcı",
      photoURL: undefined,
    };
  const targetPublic =
    profiles.get(targetUserId) ?? {
      userId: targetUserId,
      displayName: "Kullanıcı",
      photoURL: undefined,
    };

  const conversationSnap = await conversationRef.get();
  const existingLastText = conversationSnap.exists
    ? String(conversationSnap.data().lastMessageText ?? "")
    : "";

  if (!conversationSnap.exists) {
    await conversationRef.set({
      participantIds: [actorId, targetUserId].sort(),
      createdAt: FieldValue.serverTimestamp(),
      lastMessageText: "",
      lastMessageAt: FieldValue.serverTimestamp(),
      lastMessageSenderId: "",
    });
  }

  await inboxRef(actorId, conversationId).set(
    {
      otherUserId: targetPublic.userId,
      otherDisplayName: targetPublic.displayName,
      ...(targetPublic.photoURL ? { otherPhotoURL: targetPublic.photoURL } : {}),
      lastMessageText: existingLastText,
      lastMessageAt: conversationSnap.exists
        ? conversationSnap.data().lastMessageAt ?? FieldValue.serverTimestamp()
        : FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  const targetInboxSnap = await inboxRef(targetUserId, conversationId).get();
  await inboxRef(targetUserId, conversationId).set(
    {
      otherUserId: actorPublic.userId,
      otherDisplayName: actorPublic.displayName,
      ...(actorPublic.photoURL ? { otherPhotoURL: actorPublic.photoURL } : {}),
      lastMessageText: existingLastText,
      lastMessageAt: conversationSnap.exists
        ? conversationSnap.data().lastMessageAt ?? FieldValue.serverTimestamp()
        : FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      unreadCount: targetInboxSnap.exists
        ? (targetInboxSnap.data().unreadCount ?? 0)
        : 0,
    },
    { merge: true }
  );

  invalidateInboxCacheQuiet(actorId);
  invalidateInboxCacheQuiet(targetUserId);

  return {
    ok: true,
    conversationId,
    otherUser: targetPublic,
  };
}

async function sendMessage(actorId, conversationId, payload = {}) {
  if (!conversationId || typeof conversationId !== "string") {
    throw new MessageError(400, "conversationId gerekli");
  }

  const type = normalizeMessageType(payload.type);
  const mediaURL =
    typeof payload.mediaURL === "string" ? payload.mediaURL.trim() : "";
  const posterURL =
    typeof payload.posterURL === "string" ? payload.posterURL.trim() : "";

  let normalizedText = "";
  if (type === "text") {
    normalizedText = normalizeText(payload.text);
  } else {
    if (!mediaURL) {
      throw new MessageError(400, "mediaURL gerekli");
    }
    try {
      assertAllowedMediaURL(mediaURL, "mediaURL");
    } catch (error) {
      throw new MessageError(error.statusCode ?? 400, error.message);
    }
    if (posterURL) {
      try {
        assertAllowedMediaURL(posterURL, "posterURL");
      } catch (error) {
        throw new MessageError(error.statusCode ?? 400, error.message);
      }
    }
    if (payload.text != null && String(payload.text).trim()) {
      normalizedText = normalizeText(payload.text);
    }
  }

  const previewText = previewTextForMessage({
    type,
    text: normalizedText,
    mediaURL,
  });

  const otherUserId = getOtherParticipantId(conversationId, actorId);
  if (!otherUserId) {
    throw new MessageError(403, "Bu sohbete erişiminiz yok");
  }

  await assertUsersCanInteract(actorId, otherUserId);

  const conversationRef = db.collection("conversations").doc(conversationId);
  const messageRef = conversationRef.collection("messages").doc();
  const profiles = await resolveUsersPublic([actorId, otherUserId]);
  const actorPublic =
    profiles.get(actorId) ?? {
      userId: actorId,
      displayName: "Kullanıcı",
      photoURL: undefined,
    };
  const otherPublic =
    profiles.get(otherUserId) ?? {
      userId: otherUserId,
      displayName: "Kullanıcı",
      photoURL: undefined,
    };

  const messageData = {
    senderId: actorId,
    type,
    createdAt: FieldValue.serverTimestamp(),
    ...(normalizedText ? { text: normalizedText } : {}),
    ...(mediaURL ? { mediaURL } : {}),
    ...(posterURL ? { posterURL } : {}),
  };

  await db.runTransaction(async (transaction) => {
    const conversationSnap = await transaction.get(conversationRef);
    if (!conversationSnap.exists) {
      throw new MessageError(404, "Sohbet bulunamadı");
    }

    const participants = conversationSnap.data().participantIds ?? [];
    if (!participants.includes(actorId)) {
      throw new MessageError(403, "Bu sohbete erişiminiz yok");
    }

    transaction.set(messageRef, messageData);

    transaction.update(conversationRef, {
      lastMessageText: previewText,
      lastMessageAt: FieldValue.serverTimestamp(),
      lastMessageSenderId: actorId,
    });

    transaction.set(
      inboxRef(actorId, conversationId),
      {
        otherUserId,
        otherDisplayName: otherPublic.displayName,
        ...(otherPublic.photoURL ? { otherPhotoURL: otherPublic.photoURL } : {}),
        lastMessageText: previewText,
        lastMessageAt: FieldValue.serverTimestamp(),
        unreadCount: 0,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    transaction.set(
      inboxRef(otherUserId, conversationId),
      {
        otherUserId: actorId,
        otherDisplayName: actorPublic.displayName,
        ...(actorPublic.photoURL ? { otherPhotoURL: actorPublic.photoURL } : {}),
        lastMessageText: previewText,
        lastMessageAt: FieldValue.serverTimestamp(),
        unreadCount: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  });

  invalidateInboxCacheQuiet(actorId);
  invalidateInboxCacheQuiet(otherUserId);

  void createNotification({
    recipientId: otherUserId,
    actorId,
    type: "message_received",
    payload: { conversationId },
  }).catch((err) => {
    console.error("[notification]", err.message ?? err);
  });

  return {
    ok: true,
    conversationId,
    messageId: messageRef.id,
  };
}

async function markConversationRead(actorId, conversationId) {
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

  await inboxRef(actorId, conversationId).set(
    { unreadCount: 0, updatedAt: FieldValue.serverTimestamp() },
    { merge: true }
  );

  invalidateInboxCacheQuiet(actorId);

  return { ok: true, conversationId };
}

module.exports = {
  openConversation,
  sendMessage,
  markConversationRead,
  MESSAGE_MAX_LENGTH,
};
