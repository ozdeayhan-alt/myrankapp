const { FieldValue } = require("firebase-admin/firestore");
const { db } = require("../../lib/firestore");
const { buildSegmentKey, isMetadataComplete, getRankingSegmentKeys } = require("../../lib/segmentKey");
const { ensureAuthUser, syncPublicProfile } = require("./botUserService");
const { createBotPost } = require("./botPostService");
const {
  SEGMENT_BOT_COUNT,
  segmentKeyHash,
  buildSegmentBotPersonas,
  BIO_CATEGORY_VISIBILITY,
  buildBio,
  avatarUrl,
} = require("./segmentBotPersonas");

const SEGMENT_BOT_STATE_COLLECTION = "segmentBotState";

function segmentBotStateRef(segmentKey) {
  return db
    .collection(SEGMENT_BOT_STATE_COLLECTION)
    .doc(segmentKeyHash(segmentKey));
}

async function upsertSegmentBotUser(persona, segmentKey) {
  const photoURL = avatarUrl({
    gender: persona.metadata.gender,
    avatarIndex: persona.avatarIndex,
  });
  const bio = persona.bio || buildBio({ bio: "" });
  const userRef = db.collection("users").doc(persona.uid);
  const existing = await userRef.get();
  const now = FieldValue.serverTimestamp();

  const payload = {
    email: `${persona.uid}@bots.myrank.local`,
    displayName: persona.displayName,
    photoURL,
    bio,
    bioCategoryVisibility: BIO_CATEGORY_VISIBILITY,
    metadata: persona.metadata,
    isBot: true,
    botRole: "segment",
    segmentBotKey: segmentKey,
    totalScore: persona.totalScore,
    weekdayIndex: persona.weekdayIndex,
    updatedAt: now,
  };

  if (!existing.exists) {
    payload.createdAt = now;
  }

  await userRef.set(payload, { merge: true });

  await syncPublicProfile(persona.uid, {
    displayName: persona.displayName,
    photoURL,
    bio,
    bioCategoryVisibility: BIO_CATEGORY_VISIBILITY,
    metadata: persona.metadata,
    totalScore: persona.totalScore,
    isBot: true,
    botRole: "segment",
  });

  return persona.uid;
}

async function writeSegmentRankingEntry(persona, segmentKey) {
  const coll = db.collection("rankings").doc(segmentKey).collection("entries");
  const higherSnap = await coll
    .where("totalScore", ">", persona.totalScore)
    .count()
    .get();
  const rank = higherSnap.data().count + 1;
  const totalSnap = await coll.count().get();
  const segmentTotal = Math.max(totalSnap.data().count, rank);

  await coll.doc(persona.uid).set(
    {
      userId: persona.uid,
      totalScore: persona.totalScore,
      displayName: persona.displayName,
      photoURL: avatarUrl({
        gender: persona.metadata.gender,
        avatarIndex: persona.avatarIndex,
      }),
      metadata: persona.metadata,
      rank,
      segmentTotal,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

async function seedSegmentBots(metadata) {
  const segmentKey = buildSegmentKey(metadata);
  const stateRef = segmentBotStateRef(segmentKey);
  const existingState = await stateRef.get();

  if (existingState.exists && existingState.data().completed === true) {
    return {
      skipped: true,
      segmentKey,
      botIds: existingState.data().botIds ?? [],
    };
  }

  if (existingState.exists && existingState.data().seeding === true) {
    return {
      skipped: true,
      segmentKey,
      reason: "seeding_in_progress",
    };
  }

  await stateRef.set(
    {
      segmentKey,
      seeding: true,
      completed: false,
      startedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  const personas = buildSegmentBotPersonas(metadata, segmentKey);
  const botIds = [];

  try {
    for (const persona of personas) {
      await ensureAuthUser({
        uid: persona.uid,
        displayName: persona.displayName,
      });
      await upsertSegmentBotUser(persona, segmentKey);
      for (const rankingKey of getRankingSegmentKeys(persona.metadata)) {
        await writeSegmentRankingEntry(persona, rankingKey);
      }

      const postCount = await db
        .collection("posts")
        .where("authorId", "==", persona.uid)
        .limit(1)
        .get();

      if (postCount.empty) {
        await createBotPost({
          authorId: persona.uid,
          contentType: "tweet",
          content: persona.initialTweet,
        });
      }

      botIds.push(persona.uid);
    }

    await stateRef.set(
      {
        segmentKey,
        botIds,
        botCount: SEGMENT_BOT_COUNT,
        seeding: false,
        completed: true,
        seededAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    console.log(
      `[segment-bots] seeded ${botIds.length} bots for segment: ${segmentKey}`
    );

    return { seeded: true, segmentKey, botIds };
  } catch (error) {
    await stateRef.set(
      {
        seeding: false,
        lastError: error.message ?? String(error),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    throw error;
  }
}

/**
 * Ensures 7 segment bots exist for the user's full metadata league.
 */
async function ensureSegmentBotsForMetadata(metadata) {
  if (!isMetadataComplete(metadata)) {
    return { skipped: true, reason: "metadata_incomplete" };
  }

  return seedSegmentBots(metadata);
}

module.exports = {
  SEGMENT_BOT_STATE_COLLECTION,
  ensureSegmentBotsForMetadata,
  seedSegmentBots,
  upsertSegmentBotUser,
};
