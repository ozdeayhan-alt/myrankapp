const {
  getCacheKey,
  invalidateCached,
} = require("../feed/feedCache");

const INBOX_CACHE_TTL_MS =
  Number(process.env.INBOX_CACHE_TTL_MS) || 60_000;

function inboxCacheKey(userId) {
  return getCacheKey(["messages", "inbox", userId]);
}

async function invalidateInboxCache(userId) {
  if (!userId || typeof userId !== "string") {
    return;
  }
  await invalidateCached(inboxCacheKey(userId));
}

function invalidateInboxCacheQuiet(userId) {
  void invalidateInboxCache(userId).catch((error) => {
    console.warn(
      "[inboxCache] invalidate failed:",
      userId,
      error.message ?? error
    );
  });
}

module.exports = {
  INBOX_CACHE_TTL_MS,
  inboxCacheKey,
  invalidateInboxCache,
  invalidateInboxCacheQuiet,
};
