/** Firestore values stored on posts / userFeeds items. */
const FEED_CONTENT_TYPES = new Set(["tweet", "image", "video", "flow"]);

/**
 * Resolves the feed slot type used for server-side pagination.
 * Matches mobile resolvePostContentType semantics (repost uses snapshot).
 */
function resolveFeedContentType(data) {
  if (!data || typeof data !== "object") {
    return "tweet";
  }

  if (data.contentType === "repost") {
    const snapshotType = data.originalSnapshot?.contentType;
    if (
      snapshotType === "image" ||
      snapshotType === "video" ||
      snapshotType === "tweet" ||
      snapshotType === "flow"
    ) {
      return snapshotType;
    }
    return "tweet";
  }

  const raw = data.contentType ?? "tweet";
  return FEED_CONTENT_TYPES.has(raw) ? raw : "tweet";
}

/**
 * Parses API query param. Default `all`. Accepts whisp/glow and legacy tweet/image.
 * @returns {'all' | 'tweet' | 'image' | 'flow'}
 */
function parseFeedContentTypeQuery(raw) {
  if (raw == null || raw === "") {
    return "all";
  }

  const normalized = String(raw).trim().toLowerCase();
  if (normalized === "all") {
    return "all";
  }
  if (normalized === "whisp" || normalized === "tweet") {
    return "tweet";
  }
  if (normalized === "glow" || normalized === "image") {
    return "image";
  }
  if (normalized === "flow") {
    return "flow";
  }

  return "all";
}

/** Applies feed content filter to a Firestore query ref (equality / in). */
function applyFeedContentTypeFilter(queryRef, feedContentType) {
  if (
    feedContentType === "tweet" ||
    feedContentType === "image" ||
    feedContentType === "flow"
  ) {
    return queryRef.where("feedContentType", "==", feedContentType);
  }

  return queryRef.where("feedContentType", "in", ["tweet", "image", "flow"]);
}

module.exports = {
  resolveFeedContentType,
  parseFeedContentTypeQuery,
  applyFeedContentTypeFilter,
};
