const crypto = require("crypto");
const { FieldValue } = require("firebase-admin/firestore");
const { db } = require("../../lib/firestore");

const EXPO_PUSH_TOKEN_RE =
  /^ExponentPushToken\[[A-Za-z0-9_-]+\]$|^ExpoPushToken\[[A-Za-z0-9_-]+\]$/;

function isValidExpoPushToken(token) {
  return typeof token === "string" && EXPO_PUSH_TOKEN_RE.test(token.trim());
}

function tokenDocId(token) {
  return crypto.createHash("sha256").update(token.trim()).digest("hex");
}

async function registerPushToken({ userId, expoPushToken, platform }) {
  const token = expoPushToken?.trim();
  if (!userId || !isValidExpoPushToken(token)) {
    throw new Error("Geçersiz push token");
  }

  const docId = tokenDocId(token);
  await db
    .collection("users")
    .doc(userId)
    .collection("pushTokens")
    .doc(docId)
    .set(
      {
        token,
        platform: platform === "ios" ? "ios" : "android",
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

  return { ok: true, tokenId: docId };
}

async function unregisterPushToken({ userId, expoPushToken }) {
  const token = expoPushToken?.trim();
  if (!userId || !isValidExpoPushToken(token)) {
    throw new Error("Geçersiz push token");
  }

  const docId = tokenDocId(token);
  await db
    .collection("users")
    .doc(userId)
    .collection("pushTokens")
    .doc(docId)
    .delete();

  return { ok: true };
}

async function listPushTokens(userId) {
  if (!userId) {
    return [];
  }

  const snap = await db
    .collection("users")
    .doc(userId)
    .collection("pushTokens")
    .get();

  return snap.docs
    .map((doc) => doc.data()?.token)
    .filter((token) => isValidExpoPushToken(token));
}

async function removePushTokenByValue(userId, token) {
  if (!userId || !isValidExpoPushToken(token)) {
    return;
  }

  const docId = tokenDocId(token);
  await db
    .collection("users")
    .doc(userId)
    .collection("pushTokens")
    .doc(docId)
    .delete();
}

module.exports = {
  registerPushToken,
  unregisterPushToken,
  listPushTokens,
  removePushTokenByValue,
  isValidExpoPushToken,
};
