#!/usr/bin/env node
/**
 * Prune stale Expo push tokens for one or all users.
 * Usage:
 *   node scripts/prune-push-tokens.js [userId]
 *   node scripts/prune-push-tokens.js --all
 */
require("dotenv").config();

const { db } = require("../src/lib/firestore");
const {
  prunePushTokens,
  listPushTokenDocs,
} = require("../src/features/push/pushTokenService");

async function pruneUser(userId) {
  const before = (await listPushTokenDocs(userId)).length;
  const result = await prunePushTokens(userId);
  console.log(
    `[prune-push] ${userId}: ${before} -> ${result.kept} (removed ${result.removed})`
  );
  return result;
}

async function main() {
  const arg = process.argv[2]?.trim();

  if (arg === "--all") {
    const usersSnap = await db.collection("users").get();
    let totalRemoved = 0;
    for (const doc of usersSnap.docs) {
      const { removed } = await pruneUser(doc.id);
      totalRemoved += removed;
    }
    console.log(`[prune-push] Done. Total removed: ${totalRemoved}`);
    return;
  }

  if (arg) {
    await pruneUser(arg);
    return;
  }

  console.error("Usage: node scripts/prune-push-tokens.js <userId|--all>");
  process.exit(1);
}

main().catch((error) => {
  console.error("[prune-push] Failed:", error?.message ?? error);
  process.exit(1);
});
