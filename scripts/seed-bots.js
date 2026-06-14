#!/usr/bin/env node
/**
 * Create/update 10 community bots, initial posts (today), ranking entries.
 *
 * Usage: node scripts/seed-bots.js
 */
require("dotenv").config();

const { BOT_PERSONAS } = require("../src/features/bots/botPersonas");
const { backfillBotPostPhotos } = require("../src/features/bots/backfillBotPostPhotos");
const { seedAllBotUsers } = require("../src/features/bots/botUserService");
const { createInitialPostsForBots } = require("../src/features/bots/botPostService");

async function main() {
  console.log("[seed-bots] Upserting bot users...");
  const users = await seedAllBotUsers();
  console.log(`[seed-bots] ${users.length} bots ready`);

  console.log("[seed-bots] Creating initial posts (today)...");
  const posts = await createInitialPostsForBots(BOT_PERSONAS);
  console.log(`[seed-bots] ${posts.length} new posts created`);

  for (const entry of posts) {
    console.log(`  - ${entry.userId} → post ${entry.postId}`);
  }

  console.log("[seed-bots] Backfilling post avatars...");
  const postsUpdated = await backfillBotPostPhotos();
  console.log(`[seed-bots] ${postsUpdated} posts updated`);

  console.log("[seed-bots] Done. Run: npm run rebuild-rankings");
}

main().catch((err) => {
  console.error("[seed-bots] Failed:", err);
  process.exit(1);
});
