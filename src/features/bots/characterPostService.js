const {
  isCharacterPostsEnabled,
  ensureDailySchedules,
  listDueSlots,
  markSlotPosted,
  recoverUnmarkedSlots,
} = require("./characterScheduler");
const { composeAndPublishCharacterWhisp } = require("./characterCompose");

async function processDueCharacterPosts(now = new Date()) {
  if (!isCharacterPostsEnabled()) {
    return { enabled: false, processed: [] };
  }

  await ensureDailySchedules(now);
  const recovered = await recoverUnmarkedSlots();
  if (recovered > 0) {
    console.log(`[characterPostService] recovered ${recovered} unmarked slots`);
  }
  const dueSlots = await listDueSlots(now);
  const processed = [];

  for (const slot of dueSlots) {
    try {
      const result = await composeAndPublishCharacterWhisp({
        characterUid: slot.characterUid,
        slotType: slot.slotType,
      });

      await markSlotPosted({
        dateKey: slot.dateKey,
        characterUid: slot.characterUid,
        slotIndex: slot.slotIndex,
        postId: result.postId,
      });

      processed.push({
        ...result,
        slotIndex: slot.slotIndex,
        slotType: slot.slotType,
      });
    } catch (error) {
      console.error(
        `[characterPostService] slot failed ${slot.characterUid}#${slot.slotIndex}:`,
        error.message ?? error
      );
      processed.push({
        characterUid: slot.characterUid,
        slotIndex: slot.slotIndex,
        error: error.message ?? String(error),
      });
    }
  }

  return { enabled: true, processed, dueCount: dueSlots.length };
}

module.exports = {
  processDueCharacterPosts,
};
