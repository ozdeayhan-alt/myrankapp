const { FieldValue } = require("firebase-admin/firestore");
const { db } = require("../../lib/firestore");
const { BOT_PERSONAS, WEEKLY_POST_TEMPLATES } = require("./botPersonas");
const { daysBetween, toDate, randomInt } = require("./botUtils");
const { isBotAccount } = require("./botUserService");
const { createBotPost, findLatestPostId } = require("./botPostService");
const { botLikePost, botLikeBonus99 } = require("./botInteractionService");

const WEEKLY_STATE_COLLECTION = "botWeeklyState";
const NEW_USER_WINDOW_DAYS = 14;

function weeklyStateRef(botId) {
  return db.collection(WEEKLY_STATE_COLLECTION).doc(botId);
}

async function processWeeklyPosts() {
  const results = [];

  for (const persona of BOT_PERSONAS) {
    const stateRef = weeklyStateRef(persona.uid);
    const stateSnap = await stateRef.get();
    const lastPostAt = stateSnap.exists
      ? toDate(stateSnap.data().lastPostAt)
      : null;

    if (lastPostAt && daysBetween(new Date(), lastPostAt) < 6.5) {
      continue;
    }

    const template =
      WEEKLY_POST_TEMPLATES[
        randomInt(0, WEEKLY_POST_TEMPLATES.length - 1)
      ];
    const mediaSeed = template.mediaSeed
      ? `${persona.uid}-${template.mediaSeed}-${Date.now()}`
      : undefined;

    try {
      const postId = await createBotPost({
        authorId: persona.uid,
        contentType: template.contentType,
        content: template.content,
        mediaSeed,
      });

      await stateRef.set(
        {
          lastPostAt: FieldValue.serverTimestamp(),
          lastPostId: postId,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      results.push({ botId: persona.uid, postId, type: "weekly_post" });
    } catch (error) {
      console.error(
        `[bot-weekly-post] failed bot=${persona.uid}:`,
        error.message ?? error
      );
      results.push({
        botId: persona.uid,
        type: "weekly_post",
        error: error.message ?? String(error),
      });
    }
  }

  return results;
}

async function findRecentRealUsers() {
  const usersSnap = await db.collection("users").get();
  const now = Date.now();
  const users = [];

  for (const doc of usersSnap.docs) {
    const data = doc.data();
    if (data.isBot === true) continue;

    const createdAt = toDate(data.createdAt);
    if (!createdAt) continue;

    const ageDays = (now - createdAt.getTime()) / (1000 * 60 * 60 * 24);
    if (ageDays > NEW_USER_WINDOW_DAYS) continue;

    users.push({ userId: doc.id, createdAt });
  }

  return users;
}

async function processWeeklyCombo() {
  const comboStateRef = db.collection("botWeeklyState").doc("_combo");
  const comboSnap = await comboStateRef.get();
  const lastComboAt = comboSnap.exists
    ? toDate(comboSnap.data().lastComboAt)
    : null;

  if (lastComboAt && daysBetween(new Date(), lastComboAt) < 6.5) {
    return { skipped: true, reason: "combo_cooldown" };
  }

  const recentUsers = await findRecentRealUsers();
  const results = [];

  for (const { userId } of recentUsers) {
    if (await isBotAccount(userId)) continue;

    const postId = await findLatestPostId(userId);
    if (!postId) continue;

    for (const persona of BOT_PERSONAS) {
      try {
        await botLikePost({ botId: persona.uid, postId, notify: false });
        await botLikeBonus99({ botId: persona.uid, postId });
        results.push({
          userId,
          postId,
          botId: persona.uid,
          type: "weekly_combo",
        });
      } catch (error) {
        console.error(
          `[bot-weekly-combo] failed user=${userId} bot=${persona.uid}:`,
          error.message ?? error
        );
        results.push({
          userId,
          postId,
          botId: persona.uid,
          type: "weekly_combo",
          error: error.message ?? String(error),
        });
      }
    }
  }

  await comboStateRef.set(
    {
      lastComboAt: FieldValue.serverTimestamp(),
      lastRunCount: results.filter((entry) => !entry.error).length,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return { skipped: false, results };
}

module.exports = {
  processWeeklyPosts,
  processWeeklyCombo,
};
