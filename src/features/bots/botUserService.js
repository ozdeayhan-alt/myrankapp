const { FieldValue } = require("firebase-admin/firestore");
const { admin, db } = require("../../lib/firestore");
const {
  normalizeDisplayNameForSearch,
} = require("../../lib/normalizeDisplayNameForSearch");
const { buildSegmentKey } = require("../../lib/segmentKey");
const { ensureUserRankingEntries } = require("../profile/ensureUserRankingEntries");
const {
  BOT_PERSONAS,
  BIO_CATEGORY_VISIBILITY,
  buildMetadata,
  buildBio,
  avatarUrl,
} = require("./botPersonas");
const { randomInt } = require("./botUtils");

async function syncPublicProfile(userId, data) {
  const payload = {
    totalScore: data.totalScore ?? 0,
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (typeof data.displayName === "string" && data.displayName.trim()) {
    const displayName = data.displayName.trim();
    payload.displayName = displayName;
    payload.displayNameLower = normalizeDisplayNameForSearch(displayName);
  }
  if (typeof data.photoURL === "string" && data.photoURL.trim()) {
    payload.photoURL = data.photoURL.trim();
  }
  if (typeof data.bio === "string") {
    payload.bio = data.bio.trim();
  }
  if (data.bioCategoryVisibility) {
    payload.bioCategoryVisibility = data.bioCategoryVisibility;
  }
  if (data.metadata) {
    payload.metadata = data.metadata;
  }

  await db.collection("publicProfiles").doc(userId).set(payload, { merge: true });
}

async function ensureAuthUser(persona) {
  const email = `${persona.uid}@bots.myrank.local`;
  try {
    await admin.auth().getUser(persona.uid);
    await admin.auth().updateUser(persona.uid, {
      displayName: persona.displayName,
      email,
      emailVerified: true,
      disabled: false,
    });
    return { created: false };
  } catch (error) {
    if (error.code !== "auth/user-not-found") {
      throw error;
    }
  }

  await admin.auth().createUser({
    uid: persona.uid,
    email,
    emailVerified: true,
    displayName: persona.displayName,
    password: `MyRankBot!${persona.uid}`,
    disabled: false,
  });

  return { created: true };
}

async function upsertBotUser(persona, { initialScore } = {}) {
  const metadata = buildMetadata(persona);
  const bio = buildBio(persona);
  const photoURL = avatarUrl(persona);
  const userRef = db.collection("users").doc(persona.uid);
  const existing = await userRef.get();

  const totalScore =
    existing.exists && typeof existing.data().totalScore === "number"
      ? existing.data().totalScore
      : initialScore ?? randomInt(120, 380);

  const now = FieldValue.serverTimestamp();
  const payload = {
    email: `${persona.uid}@bots.myrank.local`,
    displayName: persona.displayName,
    photoURL,
    bio,
    bioCategoryVisibility: BIO_CATEGORY_VISIBILITY,
    metadata,
    isBot: true,
    botRole: "community",
    totalScore,
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
    metadata,
    totalScore,
  });

  await ensureUserRankingEntries(persona.uid);

  return {
    userId: persona.uid,
    displayName: persona.displayName,
    totalScore,
    segmentKey: buildSegmentKey(metadata),
    created: !existing.exists,
  };
}

async function seedAllBotUsers() {
  const results = [];
  for (const persona of BOT_PERSONAS) {
    await ensureAuthUser(persona);
    const result = await upsertBotUser(persona);
    results.push(result);
  }
  return results;
}

async function isBotAccount(userId) {
  if (!userId) return false;
  const snap = await db.collection("users").doc(userId).get();
  if (!snap.exists) return false;
  return snap.data().isBot === true;
}

module.exports = {
  seedAllBotUsers,
  upsertBotUser,
  syncPublicProfile,
  isBotAccount,
};
