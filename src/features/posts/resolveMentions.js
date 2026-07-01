const { db } = require("../../lib/firestore");
const { filterUsersForViewer } = require("../blocks/blockService");
const {
  normalizeDisplayNameForSearch,
} = require("../../lib/normalizeDisplayNameForSearch");
const { chunkArray } = require("../../lib/chunkArray");

const MENTION_LOOKUP_CHUNK = 30;

async function resolveMentions(rawTokens, viewerId) {
  const tokens = [
    ...new Set(
      (Array.isArray(rawTokens) ? rawTokens : [])
        .map((token) => String(token ?? "").trim())
        .filter((token) => token.length >= 2)
    ),
  ];

  if (tokens.length === 0) {
    return { ok: true, mentions: [] };
  }

  const normalizedByToken = new Map();
  for (const token of tokens) {
    const normalized = normalizeDisplayNameForSearch(token);
    if (normalized) {
      normalizedByToken.set(token, normalized);
    }
  }

  const uniqueNormalized = [...new Set(normalizedByToken.values())];
  const profileByNormalized = new Map();

  for (const chunk of chunkArray(uniqueNormalized, MENTION_LOOKUP_CHUNK)) {
    const snapshot = await db
      .collection("publicProfiles")
      .where("displayNameLower", "in", chunk)
      .get();

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const key =
        typeof data.displayNameLower === "string"
          ? data.displayNameLower.trim()
          : "";
      if (!key || profileByNormalized.has(key)) {
        continue;
      }
      profileByNormalized.set(key, {
        userId: doc.id,
        displayName:
          typeof data.displayName === "string" && data.displayName.trim()
            ? data.displayName.trim()
            : "Kullanıcı",
      });
    }
  }

  const mentions = [];
  for (const [token, normalized] of normalizedByToken.entries()) {
    const profile = profileByNormalized.get(normalized);
    if (!profile) {
      continue;
    }
    mentions.push({
      token,
      userId: profile.userId,
      displayName: profile.displayName,
    });
  }

  const filtered = await filterUsersForViewer(viewerId, mentions);

  return {
    ok: true,
    mentions: filtered.map((entry) => ({
      token: entry.token,
      userId: entry.userId,
      displayName: entry.displayName,
    })),
  };
}

module.exports = { resolveMentions };
