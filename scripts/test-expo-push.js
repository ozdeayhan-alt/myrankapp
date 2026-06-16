#!/usr/bin/env node
/**
 * Send a test push via Expo to the first registered device token.
 * Usage: node scripts/test-expo-push.js [userId]
 */
require("dotenv").config();

const { db } = require("../src/lib/firestore");
const { listPushTokens } = require("../src/features/push/pushTokenService");
const { sendExpoPushBatch } = require("../src/features/push/sendExpoPush");

async function findUserWithToken(explicitUserId) {
  if (explicitUserId) {
    const tokens = await listPushTokens(explicitUserId);
    if (!tokens.length) {
      throw new Error(`Kullanıcıda push token yok: ${explicitUserId}`);
    }
    return { userId: explicitUserId, token: tokens[0] };
  }

  const usersSnap = await db.collection("users").limit(100).get();
  for (const doc of usersSnap.docs) {
    const tokens = await listPushTokens(doc.id);
    if (tokens.length) {
      return { userId: doc.id, token: tokens[0] };
    }
  }

  throw new Error("Kayıtlı push token bulunamadı (uygulamada giriş + bildirim izni gerekir).");
}

async function main() {
  const userIdArg = process.argv[2]?.trim();
  const { userId, token } = await findUserWithToken(userIdArg);

  console.log(`[test-push] userId=${userId}`);
  console.log(`[test-push] token=${token.slice(0, 28)}...`);

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
