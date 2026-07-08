#!/usr/bin/env node
/**
 * Create/update 10 character bots (botRole: character).
 *
 * Usage: node scripts/seed-character-bots.js
 */
require("dotenv").config();

const { seedAllCharacterBotUsers } = require("../src/features/bots/botUserService");

async function main() {
  console.log("[seed-character-bots] Upserting character bot users...");
  const users = await seedAllCharacterBotUsers();
  console.log(`[seed-character-bots] ${users.length} character bots ready`);

  for (const entry of users) {
    console.log(
      `  - ${entry.userId} (${entry.displayName}) score=${entry.totalScore}`
    );
  }

  console.log("[seed-character-bots] Done.");
}

main().catch((err) => {
  console.error("[seed-character-bots] Failed:", err);
  process.exit(1);
});
