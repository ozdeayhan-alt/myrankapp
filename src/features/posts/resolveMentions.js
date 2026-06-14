const { db } = require("../../lib/firestore");
const { filterUsersForViewer } = require("../blocks/blockService");
const {
  normalizeDisplayNameForSearch,
} = require("../../lib/normalizeDisplayNameForSearch");

async function resolveMentions(rawTokens, viewerId) {
  const tokens = [...new Set(
    (Array.isArray(rawTokens) ? rawTokens : [])
      .map((token) => String(token ?? "").trim())
      .filter((token) => token.length >= 2)
  )];

  if (tokens.length === 0) {
    return { ok: true, mentions: [] };
  }

  const mentions = [];

  for (const token of tokens) {
    const normalized = normalizeDisplayNameForSearch(token);
    const snapshot = await db
      .collection("publicProfiles")
      .where("displayNameLower", "==", normalized)
      .limit(1)
      .get();

    if (snapshot.empty) {
      continue;
    }

    const doc = snapshot.docs[0];
    const data = doc.data();
    mentions.push({
      token,
      userId: doc.id,
      displayName:
        typeof data.displayName === "string" && data.displayName.trim()
          ? data.displayName.trim()
          : "Kullanıcı",
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
