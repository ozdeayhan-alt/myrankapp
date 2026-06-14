const { FieldValue } = require("firebase-admin/firestore");
const { db } = require("../../lib/firestore");
const { BOT_PERSONAS } = require("./botPersonas");
const { isBotUserId, toDate } = require("./botUtils");
const { isBotAccount } = require("./botUserService");
const { findFirstPostId } = require("./botPostService");
const { botLikePost, botProfileBoost } = require("./botInteractionService");

const WELCOME_STATE_COLLECTION = "botWelcomeState";
const BOT_COUNT = BOT_PERSONAS.length;

function welcomeStateRef(userId) {
  return db.collection(WELCOME_STATE_COLLECTION).doc(userId);
}

async function ensureWelcomeStateForUser(userId) {
  if (isBotUserId(userId) || (await isBotAccount(userId))) {
    return null;
  }

  const stateRef = welcomeStateRef(userId);
  const existing = await stateRef.get();
  if (existing.exists && existing.data().completed) {
    return null;
  }

  const firstPostId = await findFirstPostId(userId);
  if (!firstPostId) {
    return null;
  }

  if (existing.exists) {
    return { userId, ...existing.data(), firstPostId };
  }

  const payload = {
    userId,
    firstPostId,
    nextBotIndex: 0,
    completed: false,
    startedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  await stateRef.set(payload);
  return payload;
}

async function discoverWelcomeCandidates() {
  const usersSnap = await db.collection("users").get();
  const candidates = [];

  for (const doc of usersSnap.docs) {
    const data = doc.data();
    if (data.isBot === true || isBotUserId(doc.id)) {
      continue;
    }
    candidates.push(doc.id);
  }

  return candidates;
}

async function processWelcomeQueue() {
  const userIds = await discoverWelcomeCandidates();
  const results = [];

  for (const userId of userIds) {
    const state = await ensureWelcomeStateForUser(userId);
    if (!state || state.completed) {
      continue;
    }

    const stateRef = welcomeStateRef(userId);
    const freshSnap = await stateRef.get();
    if (!freshSnap.exists) continue;

    const fresh = freshSnap.data();
    if (fresh.completed) continue;

    const nextBotIndex =
      typeof fresh.nextBotIndex === "number" ? fresh.nextBotIndex : 0;
    if (nextBotIndex >= BOT_COUNT) {
      await stateRef.set(
        { completed: true, updatedAt: FieldValue.serverTimestamp() },
        { merge: true }
      );
      continue;
    }

    const lastActionAt = toDate(fresh.lastActionAt);
    if (lastActionAt) {
      const hoursSince = (Date.now() - lastActionAt.getTime()) / (1000 * 60 * 60);
      if (hoursSince < 20) {
        continue;
      }
    }

    const bot = BOT_PERSONAS[nextBotIndex];
    const postId = fresh.firstPostId || (await findFirstPostId(userId));
    if (!postId) continue;

    try {
      await botLikePost({ botId: bot.uid, postId, notify: true });
      const boost = await botProfileBoost({
        botId: bot.uid,
        targetUserId: userId,
        notify: true,
      });

      await stateRef.set(
        {
          nextBotIndex: nextBotIndex + 1,
          lastActionAt: FieldValue.serverTimestamp(),
          lastBotId: bot.uid,
          completed: nextBotIndex + 1 >= BOT_COUNT,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      results.push({
        userId,
        botId: bot.uid,
        postId,
        boostDelta: boost?.delta ?? null,
      });
    } catch (error) {
      console.error(
        `[bot-welcome] failed user=${userId} bot=${bot.uid}:`,
        error.message ?? error
      );
      results.push({
        userId,
        botId: bot.uid,
        error: error.message ?? String(error),
      });
    }
  }

  return results;
}

module.exports = {
  processWelcomeQueue,
  ensureWelcomeStateForUser,
};
