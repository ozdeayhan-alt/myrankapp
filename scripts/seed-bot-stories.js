#!/usr/bin/env node
/**
 * 10 community bot için story oluşturur; belirtilen kullanıcı hepsini takip eder.
 *
 * Usage:
 *   node scripts/seed-bot-stories.js --user=YOUR_FIREBASE_UID
 *   SEED_FOLLOWER_USER_ID=... node scripts/seed-bot-stories.js
 */
require("dotenv").config();

const admin = require("../firebase-config");
const { db } = require("../src/lib/firestore");
const { BOT_PERSONAS, postImageUrl } = require("../src/features/bots/botPersonas");
const { createStory, STORY_TTL_MS } = require("../src/features/stories/createStory");
const { followUser } = require("../src/features/follows/followService");
const { buildFollowId } = require("../src/features/follows/followId");

function parseFollowerUserId() {
  const fromArg = process.argv
    .find((arg) => arg.startsWith("--user="))
    ?.slice("--user=".length)
    ?.trim();
  const fromEnv = process.env.SEED_FOLLOWER_USER_ID?.trim();
  const userId = fromArg || fromEnv;
  if (!userId) {
    throw new Error(
      "Takip edecek kullanıcı UID gerekli: --user=UID veya SEED_FOLLOWER_USER_ID"
    );
  }
  return userId;
}

async function botHasRecentStory(userId) {
  const since = admin.firestore.Timestamp.fromMillis(Date.now() - STORY_TTL_MS);
  const snap = await db
    .collection("stories")
    .where("userId", "==", userId)
    .where("createdAt", ">=", since)
    .limit(1)
    .get();
  return !snap.empty;
}

function storyCaptionForPersona(persona) {
  const post = persona.initialPost;
  if (post?.contentType === "tweet" && post.content) {
    return String(post.content).slice(0, 40);
  }
  if (typeof persona.bio === "string" && persona.bio.trim()) {
    return persona.bio.trim().slice(0, 40);
  }
  return "Merhaba!";
}

function storyMediaSeedForPersona(persona) {
  const post = persona.initialPost;
  if (post?.mediaSeed) {
    return `${post.mediaSeed}-story`;
  }
  return `${persona.uid}-story`;
}

async function seedBotStory(persona) {
  const hasRecent = await botHasRecentStory(persona.uid);
  if (hasRecent) {
    return { userId: persona.uid, skipped: true, reason: "recent_story_exists" };
  }

  const result = await createStory(persona.uid, {
    mediaType: "image",
    mediaURL: postImageUrl(storyMediaSeedForPersona(persona)),
    caption: storyCaptionForPersona(persona),
  });

  return {
    userId: persona.uid,
    displayName: persona.displayName,
    storyId: result.story.id,
    created: true,
  };
}

async function followBot(followerUserId, botUserId) {
  const ref = db.collection("follows").doc(buildFollowId(followerUserId, botUserId));
  const snap = await ref.get();
  if (snap.exists) {
    await followUser(followerUserId, botUserId);
    return { botUserId, following: true, already: true };
  }
  await followUser(followerUserId, botUserId);
  return { botUserId, following: true, already: false };
}

async function main() {
  const followerUserId = parseFollowerUserId();
  const followerSnap = await db.collection("users").doc(followerUserId).get();
  if (!followerSnap.exists) {
    throw new Error(`Kullanıcı bulunamadı: ${followerUserId}`);
  }
  if (followerSnap.data()?.isBot === true) {
    throw new Error("Takip eden kullanıcı bot olamaz");
  }

  console.log(
    `[seed-bot-stories] follower=${followerUserId} (${followerSnap.data()?.displayName ?? "?"})`
  );

  console.log("[seed-bot-stories] Creating stories for 10 community bots...");
  for (const persona of BOT_PERSONAS) {
    try {
      const result = await seedBotStory(persona);
      if (result.skipped) {
        console.log(`  skip ${persona.uid} (${persona.displayName}) — active story var`);
        continue;
      }
      console.log(`  story ${persona.uid} (${persona.displayName}) → ${result.storyId}`);
    } catch (error) {
      console.error(
        `  fail ${persona.uid} (${persona.displayName}):`,
        error.message ?? error
      );
    }
  }

  console.log("[seed-bot-stories] Following all community bots...");
  for (const persona of BOT_PERSONAS) {
    try {
      const result = await followBot(followerUserId, persona.uid);
      const label = result.already ? "already following" : "now following";
      console.log(`  ${label} ${persona.displayName} (${persona.uid})`);
    } catch (error) {
      console.error(
        `  follow fail ${persona.uid} (${persona.displayName}):`,
        error.message ?? error
      );
    }
  }

  console.log("[seed-bot-stories] Done.");
}

main().catch((error) => {
  console.error("[seed-bot-stories] Failed:", error.message ?? error);
  process.exit(1);
});
