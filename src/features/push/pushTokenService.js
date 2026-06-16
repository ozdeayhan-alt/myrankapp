const crypto = require("crypto");
const { FieldValue } = require("firebase-admin/firestore");
const { db } = require("../../lib/firestore");

const EXPO_PUSH_TOKEN_RE =
  /^ExponentPushToken\[[A-Za-z0-9_-]+\]$|^ExpoPushToken\[[A-Za-z0-9_-]+\]$/;

/** Aktif cihaz başına son N token push gönderiminde kullanılır. */
const MAX_ACTIVE_PUSH_TOKENS =
  Number(process.env.MAX_ACTIVE_PUSH_TOKENS) || 3;

function isValidExpoPushToken(token) {
  return typeof token === "string" && EXPO_PUSH_TOKEN_RE.test(token.trim());
}

function tokenDocId(token) {
  return crypto.createHash("sha256").update(token.trim()).digest("hex");
}

function tokenUpdatedAtMs(data) {
  const ts = data?.updatedAt;
  if (ts && typeof ts.toMillis === "function") {
    return ts.toMillis();
  }
  if (ts && typeof ts.toDate === "function") {
    return ts.toDate().getTime();
  }
  return 0;
}

async function listPushTokenDocs(userId) {
  if (!userId) {
    return [];
  }

  const snap = await db
    .collection("users")
    .doc(userId)
    .collection("pushTokens")
    .get();

  return snap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .filter((row) => isValidExpoPushToken(row.token))
    .sort((a, b) => tokenUpdatedAtMs(b) - tokenUpdatedAtMs(a));
}

async function prunePushTokens(userId, keep = MAX_ACTIVE_PUSH_TOKENS) {
  const rows = await listPushTokenDocs(userId);
  const stale = rows.slice(keep);
  if (!stale.length) {
    return { removed: 0, kept: rows.length };
  }

  const batch = db.batch();
  for (const row of stale) {
    batch.delete(
      db.collection("users").doc(userId).collection("pushTokens").doc(row.id)
    );
  }
  await batch.commit();
  return { removed: stale.length, kept: Math.min(rows.length, keep) };
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

  await prunePushTokens(userId);

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
  const rows = await listPushTokenDocs(userId);
  return rows.slice(0, MAX_ACTIVE_PUSH_TOKENS).map((row) => row.token);
}

async function getLatestPushToken(userId) {
  const tokens = await listPushTokens(userId);
  return tokens[0] ?? null;
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
  listPushTokenDocs,
  getLatestPushToken,
  prunePushTokens,
  removePushTokenByValue,
  isValidExpoPushToken,
  MAX_ACTIVE_PUSH_TOKENS,
};
