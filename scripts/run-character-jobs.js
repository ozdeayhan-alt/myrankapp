#!/usr/bin/env node
/**
 * Character content jobs: due Whisp slots → compose → createBotPost.
 * Schedule via crontab (e.g. every 20 minutes).
 *
 * Usage: node scripts/run-character-jobs.js
 */
require("dotenv").config();

const { processDueCharacterPosts } = require("../src/features/bots/characterPostService");

async function main() {
  console.log("[character-jobs] Processing due character slots...");
  const result = await processDueCharacterPosts(new Date());

  if (!result.enabled) {
    console.log("[character-jobs] Disabled (CHARACTER_POSTS_ENABLED=0)");
    return;
  }

  console.log(
    `[character-jobs] due=${result.dueCount} processed=${result.processed.length}`
  );

  for (const entry of result.processed) {
    if (entry.error) {
      console.log(`  - FAIL ${entry.characterUid}#${entry.slotIndex}: ${entry.error}`);
    } else {
      console.log(
        `  - OK ${entry.characterUid} post=${entry.postId} type=${entry.contentType}`
      );
    }
  }

  console.log("[character-jobs] Done.");
}

main().catch((err) => {
  console.error("[character-jobs] Failed:", err);
  process.exit(1);
});
