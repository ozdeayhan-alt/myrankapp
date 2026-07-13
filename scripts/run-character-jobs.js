#!/usr/bin/env node
/**
 * Character jobs: due Whisp slots + daily Flow (at most 1/character/day).
 * Schedule via crontab (e.g. every 20 minutes).
 *
 * Usage: node scripts/run-character-jobs.js
 */
require("dotenv").config();

const { processDueCharacterPosts } = require("../src/features/bots/characterPostService");
const {
  processCharacterDailyFlows,
} = require("../src/features/bots/characterFlowService");
const { runCronJobScript } = require("./lib/shutdownCronJob");

async function main() {
  console.log("[character-jobs] Processing due character Whisp slots...");
  const result = await processDueCharacterPosts(new Date());

  if (!result.enabled) {
    console.log("[character-jobs] Whisp disabled (CHARACTER_POSTS_ENABLED=0)");
  } else {
    console.log(
      `[character-jobs] whisp due=${result.dueCount} processed=${result.processed.length}`
    );
    for (const entry of result.processed) {
      if (entry.error) {
        console.log(
          `  - FAIL ${entry.characterUid}#${entry.slotIndex}: ${entry.error}`
        );
      } else {
        console.log(
          `  - OK ${entry.characterUid} post=${entry.postId} type=${entry.contentType}`
        );
      }
    }
  }

  console.log("[character-jobs] Processing daily character Flows...");
  const flows = await processCharacterDailyFlows({ force: false });
  if (!flows.enabled) {
    console.log("[character-jobs] Flow disabled");
  } else {
    console.log(
      `[character-jobs] flow posted=${flows.posted} skipped=${flows.skipped} failed=${flows.failed}`
    );
    for (const entry of flows.processed) {
      if (entry.error) {
        console.log(`  - FLOW FAIL ${entry.characterUid}: ${entry.error}`);
      } else if (entry.skipped) {
        console.log(
          `  - FLOW SKIP ${entry.characterUid}: ${entry.reason}`
        );
      } else {
        console.log(
          `  - FLOW OK ${entry.characterUid} post=${entry.postId} video=${entry.videoId}`
        );
      }
    }
  }

  console.log("[character-jobs] Done.");
}

void runCronJobScript("character-jobs", main);
