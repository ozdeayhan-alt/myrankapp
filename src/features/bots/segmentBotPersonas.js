const crypto = require("crypto");
const {
  BIO_CATEGORY_VISIBILITY,
  buildBio,
  avatarUrl,
} = require("./botPersonas");

const SEGMENT_BOT_COUNT = 7;

const SEGMENT_BOT_SCORES = [70, 100, 130, 160, 190, 220, 250];

const FEMALE_FIRST_NAMES = [
  "Ayşe",
  "Zeynep",
  "Elif",
  "Merve",
  "Selin",
  "Deniz",
  "Ceren",
];

const MALE_FIRST_NAMES = [
  "Mehmet",
  "Can",
  "Burak",
  "Emre",
  "Kerem",
  "Oğuz",
  "Barış",
];

const LAST_NAMES = [
  "Yılmaz",
  "Kaya",
  "Demir",
  "Çelik",
  "Arslan",
  "Koç",
  "Şahin",
];

const WEEKLY_TWEET_TEMPLATES = [
  "Kısa bir not: bu hafta da küçük adımlarla devam.",
  "Günün özeti: odaklan, paylaş, ilerle.",
  "Haftanın ortasından selam — lig hareketli kalıyor.",
  "Bugün minik bir hedef: bir paylaşım, bir teşekkür.",
  "Yeni haftaya pozitif başlangıç. Herkese başarılar!",
  "Kısa mola, kısa not. Devam ediyoruz.",
  "Bu segmentte tempoyu korumak güzel.",
];

function segmentKeyHash(segmentKey) {
  return crypto.createHash("sha256").update(segmentKey).digest("hex").slice(0, 12);
}

function pickFrom(list, seed) {
  return list[seed % list.length];
}

function buildSegmentBotUid(segmentHash, index) {
  return `bot_seg_${segmentHash}_${String(index + 1).padStart(2, "0")}`;
}

function buildInitialTweet(metadata, index) {
  const city = metadata.city?.trim() || "şehir";
  const profession = metadata.profession?.trim() || "meslek";
  const variants = [
    `${city} hattından kısa bir merhaba. ${profession} olarak haftaya başladım.`,
    `Bu hafta ${city} temposunda küçük bir paylaşım.`,
    `${profession} gözüyle bakınca ligde hareket var — selam olsun.`,
    `Yeni hafta, yeni not. ${city}'den herkese iyi haftalar.`,
  ];
  return pickFrom(variants, index);
}

function buildWeeklyTweet(metadata, index) {
  const base = pickFrom(WEEKLY_TWEET_TEMPLATES, index);
  const city = metadata.city?.trim();
  if (!city) {
    return base;
  }
  return `${city} — ${base}`;
}

/**
 * Deterministic 7 personas for a full metadata segment.
 */
function buildSegmentBotPersonas(metadata, segmentKey) {
  const hash = segmentKeyHash(segmentKey);
  const isFemale = metadata.gender === "Kadın";
  const firstPool = isFemale ? FEMALE_FIRST_NAMES : MALE_FIRST_NAMES;

  return Array.from({ length: SEGMENT_BOT_COUNT }, (_, index) => {
    const firstName = pickFrom(firstPool, index + hash.charCodeAt(0));
    const lastName = pickFrom(LAST_NAMES, index + hash.charCodeAt(1));
    const displayName = `${firstName} ${lastName}`;
    const avatarIndex = ((index + 1) * 11) % 99 || 1;

    return {
      uid: buildSegmentBotUid(hash, index),
      displayName,
      metadata: { ...metadata },
      totalScore: SEGMENT_BOT_SCORES[index],
      avatarIndex,
      bio: `${metadata.profession ?? "Üye"} — ${metadata.city ?? ""}`.trim(),
      weekdayIndex: index % 7,
      initialTweet: buildInitialTweet(metadata, index),
      weeklyTweet: buildWeeklyTweet(metadata, index),
    };
  });
}

function isSegmentBotUserId(userId) {
  return typeof userId === "string" && userId.startsWith("bot_seg_");
}

module.exports = {
  SEGMENT_BOT_COUNT,
  SEGMENT_BOT_SCORES,
  segmentKeyHash,
  buildSegmentBotPersonas,
  buildSegmentBotUid,
  isSegmentBotUserId,
  BIO_CATEGORY_VISIBILITY,
  buildBio,
  avatarUrl,
};
