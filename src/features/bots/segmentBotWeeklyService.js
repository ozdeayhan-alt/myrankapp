const { FieldValue } = require("firebase-admin/firestore");
const { db } = require("../../lib/firestore");
const { daysBetween, toDate } = require("./botUtils");
const { createBotPost } = require("./botPostService");
const { buildSegmentBotPersonas } = require("./segmentBotPersonas");

const SEGMENT_WEEKLY_STATE_COLLECTION = "segmentBotWeeklyState";

function weeklyStateRef(botId) {
  return db.collection(SEGMENT_WEEKLY_STATE_COLLECTION).doc(botId);
}

function isBotPostDay(weekdayIndex) {
  const today = new Date().getDay();
  const mondayBased = today === 0 ? 6 : today - 1;
  return mondayBased === weekdayIndex % 7;
}

async function processSegmentBotWeeklyPosts() {
  const botsSnap = await db.collection("users").where("isBot", "==", true).get();

  const results = [];

  for (const doc of botsSnap.docs) {
    const data = doc.data();
    if (data.botRole !== "segment") {
      continue;
    }

    const botId = doc.id;
    const segmentKey = data.segmentBotKey;
    const metadata = data.metadata;
    const weekdayIndex =
      typeof data.weekdayIndex === "number" ? data.weekdayIndex : 0;

    if (!segmentKey || !metadata) {
      continue;
    }

    if (!isBotPostDay(weekdayIndex)) {
      continue;
    }

    const stateRef = weeklyStateRef(botId);
    const stateSnap = await stateRef.get();
    const lastPostAt = stateSnap.exists
      ? toDate(stateSnap.data().lastPostAt)
      : null;

    if (lastPostAt && daysBetween(new Date(), lastPostAt) < 6.5) {
      continue;
    }

    const personas = buildSegmentBotPersonas(metadata, segmentKey);
    const persona =
      personas.find((entry) => entry.uid === botId) ?? personas[0];

    try {
      const postId = await createBotPost({
        authorId: botId,
        contentType: "tweet",
        content: persona.weeklyTweet,
      });

      await stateRef.set(
        {
          lastPostAt: FieldValue.serverTimestamp(),
          lastPostId: postId,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      results.push({ botId, postId, type: "segment_weekly_tweet" });
    } catch (error) {
      console.error(
        `[segment-bot-weekly] failed bot=${botId}:`,
        error.message ?? error
      );
      results.push({
        botId,
        type: "segment_weekly_tweet",
        error: error.message ?? String(error),
      });
    }
  }

  return results;
}

module.exports = {
  processSegmentBotWeeklyPosts,
};
