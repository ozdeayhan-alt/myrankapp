#!/usr/bin/env node
/**
 * Her karakter için henüz post yoksa bir başlangıç Whisp atar.
 *
 * Usage: node scripts/backfill-character-starter-posts.js
 */
require("dotenv").config();

const { CHARACTER_PERSONAS } = require("../src/features/bots/characterPersonas");
const { countPostsByAuthor } = require("../src/features/bots/botPostService");
const { composeAndPublishCharacterWhisp } = require("../src/features/bots/characterCompose");
const { CHARACTER_CONTENT_TYPES } = require("../src/features/bots/characterContentTypes");

async function main() {
  let created = 0;

  for (const persona of CHARACTER_PERSONAS) {
    const count = await countPostsByAuthor(persona.uid);
    if (count > 0) {
      console.log(`[backfill-character] skip ${persona.uid} (${count} posts)`);
      continue;
    }

    const result = await composeAndPublishCharacterWhisp({
      characterUid: persona.uid,
      slotType: "normal",
      contentType: CHARACTER_CONTENT_TYPES.EVERGREEN,
    });

    console.log(
      `[backfill-character] ${persona.displayName} → ${result.postId}`
    );
    created += 1;
  }

  console.log(`[backfill-character] Done. created=${created}`);
}

main().catch((err) => {
  console.error("[backfill-character] Failed:", err);
  process.exit(1);
});
