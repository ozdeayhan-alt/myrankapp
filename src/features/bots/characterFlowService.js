const {
  isCharacterPostsEnabled,
} = require("./characterScheduler");
const { CHARACTER_PERSONAS } = require("./characterPersonas");
const { composeAndPublishCharacterFlow } = require("./characterFlowCompose");

function isCharacterFlowEnabled() {
  const raw = process.env.CHARACTER_FLOW_ENABLED?.trim().toLowerCase();
  if (raw === "0" || raw === "false") {
    return false;
  }
  // Default on when character posts are on.
  return isCharacterPostsEnabled();
}

/**
 * Daily Flow pass: each character posts at most one Flow (idempotent).
 * @param {{ force?: boolean, characterUids?: string[], now?: Date }} options
 */
async function processCharacterDailyFlows(options = {}) {
  const {
    force = false,
    characterUids = null,
    now = new Date(),
  } = options;

  if (!isCharacterFlowEnabled() && !force) {
    return { enabled: false, processed: [] };
  }

  const personas = characterUids?.length
    ? CHARACTER_PERSONAS.filter((p) => characterUids.includes(p.uid))
    : CHARACTER_PERSONAS;

  const processed = [];

  for (const persona of personas) {
    try {
      const result = await composeAndPublishCharacterFlow({
        characterUid: persona.uid,
        force,
        now,
      });
      processed.push(result);
    } catch (error) {
      console.error(
        `[characterFlowService] failed ${persona.uid}:`,
        error.message ?? error
      );
      processed.push({
        characterUid: persona.uid,
        error: error.message ?? String(error),
      });
    }
  }

  return {
    enabled: true,
    processed,
    posted: processed.filter((entry) => entry.postId && !entry.skipped).length,
    skipped: processed.filter((entry) => entry.skipped).length,
    failed: processed.filter((entry) => entry.error).length,
  };
}

module.exports = {
  isCharacterFlowEnabled,
  processCharacterDailyFlows,
};
