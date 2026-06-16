#!/usr/bin/env node
/**
 * Send a test push via Expo to the first registered device token.
 * Usage: node scripts/test-expo-push.js [userId]
 */
require("dotenv").config();

const { db } = require("../src/lib/firestore");
const { getLatestPushToken } = require("../src/features/push/pushTokenService");
const { sendExpoPushBatch } = require("../src/features/push/sendExpoPush");

async function findUserWithToken(explicitUserId) {
  if (explicitUserId) {
    const token = await getLatestPushToken(explicitUserId);
    if (!token) {
      throw new Error(`Kullanıcıda push token yok: ${explicitUserId}`);
    }
    return { userId: explicitUserId, token };
  }

  const usersSnap = await db.collection("users").limit(100).get();
  for (const doc of usersSnap.docs) {
    const token = await getLatestPushToken(doc.id);
    if (token) {
      return { userId: doc.id, token };
    }
  }

  throw new Error("Kayıtlı push token bulunamadı (uygulamada giriş + bildirim izni gerekir).");
}

async function main() {
  const userIdArg = process.argv[2]?.trim();
  const { userId, token } = await findUserWithToken(userIdArg);

  console.log(`[test-push] userId=${userId}`);
  console.log(`[test-push] latest token=${token.slice(0, 28)}...`);

  const result = await sendExpoPushBatch([
    {
      to: token,
      title: "MyRank",
      body: "Test bildirimi — push altyapısı çalışıyor.",
      sound: "default",
      channelId: "default",
      data: {
        type: "test",
        actorId: "",
        actorDisplayName: "MyRank",
        payload: "{}",
        notificationId: "",
      },
    },
  ]);

  if (!result.ok) {
    throw new Error("Expo push HTTP hatası");
  }

  const ticket = result.tickets?.[0];
  if (ticket?.status === "error") {
    console.error("[test-push] ticket error:", ticket.details?.error, ticket.message);
    process.exit(1);
  }

  console.log("[test-push] OK — ticket:", ticket?.status ?? "unknown");
}

main().catch((error) => {
  console.error("[test-push] Failed:", error?.message ?? error);
  process.exit(1);
});
