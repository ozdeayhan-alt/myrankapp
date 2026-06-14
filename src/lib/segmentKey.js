/** Mirrors myrank-mobile buildSegmentKey / category partial keys */

const METADATA_FIELDS = [
  "country",
  "city",
  "gender",
  "age",
  "profession",
  "maritalStatus",
];

/** Global leaderboard document id under rankings/ */
const GLOBAL_RANKING_SEGMENT = "global";

const EMPTY_METADATA = {
  country: "",
  city: "",
  age: null,
  gender: "",
  profession: "",
  maritalStatus: "",
};

function buildSegmentKey(metadata) {
  const parts = [
    `country:${metadata.country ?? ""}`,
    `city:${metadata.city ?? ""}`,
    `gender:${metadata.gender ?? ""}`,
    `age:${metadata.age ?? ""}`,
    `profession:${metadata.profession ?? ""}`,
    `maritalStatus:${metadata.maritalStatus ?? ""}`,
  ];
  return parts.join("|");
}

function isMetadataComplete(metadata) {
  if (!metadata) return false;
  return (
    String(metadata.country ?? "").trim().length > 0 &&
    String(metadata.city ?? "").trim().length > 0 &&
    metadata.age !== null &&
    Number(metadata.age) > 0 &&
    String(metadata.gender ?? "").trim().length > 0 &&
    String(metadata.profession ?? "").trim().length > 0 &&
    String(metadata.maritalStatus ?? "").trim().length > 0
  );
}

/** Full segment + one-field partial segments (profile category rankings). */
function getRankingSegmentKeys(metadata) {
  if (!metadata) return [GLOBAL_RANKING_SEGMENT];
  const keys = new Set();
  keys.add(GLOBAL_RANKING_SEGMENT);
  keys.add(buildSegmentKey(metadata));
  for (const field of METADATA_FIELDS) {
    keys.add(
      buildSegmentKey({
        ...EMPTY_METADATA,
        [field]: metadata[field],
      })
    );
  }
  return [...keys];
}

module.exports = {
  GLOBAL_RANKING_SEGMENT,
  METADATA_FIELDS,
  EMPTY_METADATA,
  buildSegmentKey,
  isMetadataComplete,
  getRankingSegmentKeys,
};
