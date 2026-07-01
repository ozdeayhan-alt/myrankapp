const {
  buildSegmentKey,
  isMetadataComplete,
  EMPTY_METADATA,
  GLOBAL_RANKING_SEGMENT,
  METADATA_FIELDS,
} = require("./segmentKey");

const FILTER_FIELD_KEYS = METADATA_FIELDS;

function hasActiveSegmentFilters(filters) {
  if (!filters) return false;
  return (
    String(filters.country ?? "").trim().length > 0 ||
    String(filters.city ?? "").trim().length > 0 ||
    String(filters.gender ?? "").trim().length > 0 ||
    (filters.age !== null &&
      filters.age !== undefined &&
      Number(filters.age) > 0) ||
    String(filters.profession ?? "").trim().length > 0 ||
    String(filters.maritalStatus ?? "").trim().length > 0
  );
}

function fieldHasValue(filters, key) {
  if (key === "age") {
    return filters.age !== null && filters.age !== undefined && Number(filters.age) > 0;
  }
  return String(filters[key] ?? "").trim().length > 0;
}

function buildSingleFieldSegmentKey(filters) {
  const activeKeys = FILTER_FIELD_KEYS.filter((key) => fieldHasValue(filters, key));
  if (activeKeys.length !== 1) return null;
  const key = activeKeys[0];
  return buildSegmentKey({
    ...EMPTY_METADATA,
    [key]: filters[key],
  });
}

function entryMatchesSegmentFilters(entryMetadata, filters) {
  if (!hasActiveSegmentFilters(filters)) {
    return true;
  }
  if (!entryMetadata) {
    return false;
  }

  if (
    String(filters.country ?? "").trim() &&
    entryMetadata.country !== String(filters.country).trim()
  ) {
    return false;
  }
  if (
    String(filters.city ?? "").trim() &&
    entryMetadata.city !== String(filters.city).trim()
  ) {
    return false;
  }
  if (
    String(filters.gender ?? "").trim() &&
    entryMetadata.gender !== String(filters.gender).trim()
  ) {
    return false;
  }
  if (
    filters.age !== null &&
    filters.age !== undefined &&
    Number(filters.age) > 0 &&
    entryMetadata.age !== Number(filters.age)
  ) {
    return false;
  }
  if (
    String(filters.profession ?? "").trim() &&
    entryMetadata.profession !== String(filters.profession).trim()
  ) {
    return false;
  }
  if (
    String(filters.maritalStatus ?? "").trim() &&
    entryMetadata.maritalStatus !== String(filters.maritalStatus).trim()
  ) {
    return false;
  }

  return true;
}

function parseAgeQuery(value) {
  if (value == null || value === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseFiltersFromQuery(query) {
  return {
    country:
      typeof query.country === "string" ? query.country.trim() : "",
    city: typeof query.city === "string" ? query.city.trim() : "",
    gender: typeof query.gender === "string" ? query.gender.trim() : "",
    age: parseAgeQuery(query.age),
    profession:
      typeof query.profession === "string" ? query.profession.trim() : "",
    maritalStatus:
      typeof query.maritalStatus === "string"
        ? query.maritalStatus.trim()
        : "",
  };
}

function getRankingSegmentKey(filters) {
  if (!filters || !hasActiveSegmentFilters(filters)) {
    return GLOBAL_RANKING_SEGMENT;
  }
  return buildSegmentKey(filters);
}

module.exports = {
  FILTER_FIELD_KEYS,
  hasActiveSegmentFilters,
  buildSingleFieldSegmentKey,
  entryMatchesSegmentFilters,
  parseFiltersFromQuery,
  getRankingSegmentKey,
  isMetadataComplete,
  GLOBAL_RANKING_SEGMENT,
};
