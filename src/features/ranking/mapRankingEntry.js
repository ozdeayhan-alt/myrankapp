const { DEFAULT_DISPLAY_NAME } = require("./engine/updateRankings");

function parseRankingMetadata(raw) {
  if (!raw || typeof raw !== "object") {
    return undefined;
  }

  const age =
    typeof raw.age === "number"
      ? raw.age
      : raw.age !== null && raw.age !== undefined
        ? Number.parseInt(String(raw.age), 10)
        : null;

  return {
    country: String(raw.country ?? "").trim(),
    city: String(raw.city ?? "").trim(),
    gender: String(raw.gender ?? "").trim(),
    age: age !== null && !Number.isNaN(age) ? age : null,
    profession: String(raw.profession ?? "").trim(),
    maritalStatus: String(raw.maritalStatus ?? "").trim(),
  };
}

function parseTrendLabel(value) {
  if (value === "rising" || value === "falling" || value === "stable") {
    return value;
  }
  return null;
}

function parseOptionalNumber(value) {
  return typeof value === "number" ? value : null;
}

function mapRankingEntryDoc(docSnap, fallbackRank) {
  const data = docSnap.data?.() ?? docSnap.data ?? docSnap;
  const userId = docSnap.id ?? data.userId;

  const displayName =
    typeof data.displayName === "string" && data.displayName.trim()
      ? data.displayName.trim()
      : DEFAULT_DISPLAY_NAME;

  const photoURL =
    typeof data.photoURL === "string" && data.photoURL.trim()
      ? data.photoURL.trim()
      : undefined;

  return {
    userId,
    displayName,
    totalScore: typeof data.totalScore === "number" ? data.totalScore : 0,
    rank: typeof data.rank === "number" ? data.rank : fallbackRank,
    metadata: parseRankingMetadata(data.metadata),
    photoURL,
    previousRank: parseOptionalNumber(data.previousRank),
    rankChange: parseOptionalNumber(data.rankChange),
    previousTotalScore: parseOptionalNumber(data.previousTotalScore),
    tpChange: parseOptionalNumber(data.tpChange),
    trendLabel: parseTrendLabel(data.trendLabel),
  };
}

module.exports = {
  mapRankingEntryDoc,
  parseRankingMetadata,
};
