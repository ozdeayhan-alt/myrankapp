const { FieldValue } = require("firebase-admin/firestore");
const { db } = require("../../lib/firestore");
const { getCharacterPersonaByUid } = require("./characterPersonas");
const { createBotPost } = require("./botPostService");
const { fetchCharacterYoutubeCandidates } = require("./characterYoutubeSearch");
const { todayKey } = require("./characterScheduler");

const SEEN_COLLECTION = "characterFlowSeen";
const DAILY_FLOW_COLLECTION = "characterDailyFlow";

const CAPTION_TEMPLATES = [
  (title) =>
    `Bu videoyu izlerken aklıma takılan şey: konu gerçekten konuşulmaya değer. "${shortTitle(title)}" — siz ne düşünüyorsunuz?`,
  (title) =>
    `Alanımda dolaşırken buna denk geldim: "${shortTitle(title)}". Abartı mı, yerinde mi?`,
  (title) =>
    `"${shortTitle(title)}" — kısa izledim, uzun düşündüm. Sizin yorumunuz ne?`,
  (title) =>
    `Bugünün Flow'u bu taraftan: "${shortTitle(title)}". Kaçırılmaması gereken bir parça gibi duruyor.`,
];

function shortTitle(title) {
  const trimmed = String(title ?? "").replace(/\s+/g, " ").trim();
  if (trimmed.length <= 72) {
    return trimmed || "bu video";
  }
  return `${trimmed.slice(0, 69)}…`;
}

function pickCaption(title, seed = Date.now()) {
  const template = CAPTION_TEMPLATES[seed % CAPTION_TEMPLATES.length];
  return template(title);
}

function seenRef(videoId) {
  return db.collection(SEEN_COLLECTION).doc(videoId);
}

function dailyFlowRef(dateKey, characterUid) {
  return db.collection(DAILY_FLOW_COLLECTION).doc(`${dateKey}_${characterUid}`);
}

async function isVideoSeen(videoId) {
  const snap = await seenRef(videoId).get();
  return snap.exists;
}

async function markVideoSeen({ videoId, characterUid, postId, title }) {
  await seenRef(videoId).set(
    {
      videoId,
      characterUid,
      postId,
      title: title ?? "",
      seenAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

async function hasPostedFlowToday(characterUid, date = new Date()) {
  const snap = await dailyFlowRef(todayKey(date), characterUid).get();
  return snap.exists && Boolean(snap.data()?.postId);
}

/**
 * Pick an unseen YouTube video for the persona and publish as Flow.
 */
async function composeAndPublishCharacterFlow({
  characterUid,
  force = false,
  now = new Date(),
}) {
  const persona = getCharacterPersonaByUid(characterUid);
  if (!persona) {
    throw new Error(`Unknown character: ${characterUid}`);
  }

  const dateKey = todayKey(now);
  if (!force && (await hasPostedFlowToday(characterUid, now))) {
    return {
      skipped: true,
      reason: "already_posted_today",
      characterUid,
      dateKey,
    };
  }

  const candidates = await fetchCharacterYoutubeCandidates(persona);
  if (candidates.length === 0) {
    throw new Error(`No YouTube candidates for ${characterUid}`);
  }

  let chosen = null;
  for (const candidate of candidates) {
    if (await isVideoSeen(candidate.videoId)) {
      continue;
    }
    chosen = candidate;
    break;
  }

  if (!chosen) {
    throw new Error(`All candidate videos already seen for ${characterUid}`);
  }

  const caption = pickCaption(chosen.title, now.getTime() + characterUid.length);
  const postId = await createBotPost({
    authorId: persona.uid,
    contentType: "flow",
    content: caption,
    providerUrl: chosen.providerUrl,
  });

  await markVideoSeen({
    videoId: chosen.videoId,
    characterUid,
    postId,
    title: chosen.title,
  });

  await dailyFlowRef(dateKey, characterUid).set(
    {
      dateKey,
      characterUid,
      postId,
      videoId: chosen.videoId,
      providerUrl: chosen.providerUrl,
      title: chosen.title,
      postedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return {
    skipped: false,
    postId,
    characterUid,
    contentType: "flow",
    videoId: chosen.videoId,
    providerUrl: chosen.providerUrl,
    title: chosen.title,
    caption,
    source: chosen.source,
    channelLabel: chosen.channelLabel,
  };
}

module.exports = {
  composeAndPublishCharacterFlow,
  hasPostedFlowToday,
  pickCaption,
  SEEN_COLLECTION,
  DAILY_FLOW_COLLECTION,
};
