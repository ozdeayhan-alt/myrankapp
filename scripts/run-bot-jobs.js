#!/usr/bin/env node
/**
 * Bot automation: welcome queue, weekly posts, weekly combo.
 * Schedule via crontab (e.g. every 6 hours).
 *
 * Usage: node scripts/run-bot-jobs.js
 */
require("dotenv").config();

const { processWelcomeQueue } = require("../src/features/bots/botWelcomeService");
const {
  processWeeklyPosts,
  processWeeklyCombo,
} = require("../src/features/bots/botWeeklyService");

async function main() {
  console.log("[bot-jobs] Welcome queue...");
  const welcome = await processWelcomeQueue();
  console.log(`[bot-jobs] welcome actions: ${welcome.length}`);

  console.log("[bot-jobs] Weekly posts...");
  const weeklyPosts = await processWeeklyPosts();
  console.log(`[bot-jobs] weekly posts: ${weeklyPosts.length}`);

  console.log("[bot-jobs] Weekly combo...");
  const combo = await processWeeklyCombo();
  if (combo.skipped) {
    console.log(`[bot-jobs] weekly combo skipped: ${combo.reason}`);
  } else {
    console.log(
      `[bot-jobs] weekly combo actions: ${combo.results?.length ?? 0}`
    );
  }

  console.log("[bot-jobs] Done.");
}

main().catch((err) => {
  console.error("[bot-jobs] Failed:", err);
  process.exit(1);
});
