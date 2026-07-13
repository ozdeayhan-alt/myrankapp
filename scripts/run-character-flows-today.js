#!/usr/bin/env node
/**
 * One-shot: every character bot posts one Flow for today (idempotent).
 *
 * Usage: node scripts/run-character-flows-today.js
 *        FORCE=1 node scripts/run-character-flows-today.js   # ignore daily guard
 */
require("dotenv").config();

const {
  processCharacterDailyFlows,
} = require("../src/features/bots/characterFlowService");

async function main() {
  const force = process.env.FORCE === "1" || process.env.FORCE === "true";
  console.log(`[character-flows-today] force=${force}`);

  const result = await processCharacterDailyFlows({ force });
  console.log(
    `[character-flows-today] posted=${result.posted} skipped=${result.skipped} failed=${result.failed}`
  );

  for (const entry of result.processed) {
    if (entry.error) {
      console.log(`FAIL ${entry.characterUid}: ${entry.error}`);
    } else if (entry.skipped) {
      console.log(`SKIP ${entry.characterUid}: ${entry.reason}`);
    } else {
      console.log(
        `OK ${entry.characterUid} post=${entry.postId} ${entry.providerUrl} (${entry.channelLabel})`
      );
    }
  }

  if (result.failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("[character-flows-today] Failed:", err);
  process.exit(1);
});
