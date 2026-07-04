const express = require("express");
const { verifyAuth } = require("../../../lib/verifyAuth");
const { feedInvalidateRateLimit } = require("../../../lib/rateLimit");
const { filterPostsForViewer } = require("../../blocks/blockService");
const {
  getCached,
  setCached,
  getCacheKey,
  invalidateFeedCachesForUser,
  FEED_RECENT_TTL_MS,
  FEED_EXPLORE_TTL_MS,
  FEED_FOLLOWING_TTL_MS,
  FEED_AUTHOR_TTL_MS,
  FEED_HASHTAG_TTL_MS,
  FEED_SAVED_TTL_MS,
} = require("../feedCache");
const { attachEngagementsToFeedPage } = require("../feedEngagement");
const { parseFeedContentTypeQuery } = require("../feedContentType");
const { fetchSavedPostsPage } = require("../fetchSavedPosts");
const {
  fetchRecentFeedPage,
  fetchExploreFeedPage,
  fetchFollowingFeedPage,
  fetchAuthorFeedPage,
  fetchHashtagFeedPage,
} = require("../fetchFeedPosts");

const router = express.Router();

function readFeedContentType(req) {
  const raw =
    typeof req.query.contentType === "string" ? req.query.contentType : undefined;
  return parseFeedContentTypeQuery(raw);
}

async function buildFeedResponse(viewerId, page, cacheKey, ttlMs) {
  const filtered = await filterPostsForViewer(viewerId, page);
  const pageForCache = { ...filtered };
  delete pageForCache.engagements;
  await setCached(cacheKey, pageForCache, ttlMs);
  return attachEngagementsToFeedPage(viewerId, filtered);
}

async function respondFeedPage(res, viewerId, cacheKey, ttlMs, fetchPage) {
  const cached = await getCached(cacheKey);
  if (cached) {
    res.setHeader("X-Cache-Status", "HIT");
    const withEngagement = await attachEngagementsToFeedPage(viewerId, cached);
    return res.json({ ok: true, ...withEngagement });
  }

  const page = await buildFeedResponse(
    viewerId,
    await fetchPage(),
    cacheKey,
    ttlMs
  );
  res.setHeader("X-Cache-Status", "MISS");
  return res.json({ ok: true, ...page });
}

router.post(
  "/feed/invalidate",
  verifyAuth,
  feedInvalidateRateLimit,
  async (req, res) => {
    try {
      await invalidateFeedCachesForUser(req.user.uid);
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({
        error: error.message ?? "Feed invalidate failed",
      });
    }
  }
);

router.get("/feed/saved", verifyAuth, async (req, res) => {
  try {
    const cursor =
      typeof req.query.cursor === "string" ? req.query.cursor : undefined;
    const limit =
      typeof req.query.limit === "string" ? req.query.limit : undefined;
    const cacheKey = getCacheKey([
      "feed",
      "saved",
      req.user.uid,
      cursor ?? "",
      limit ?? "",
    ]);

    await respondFeedPage(
      res,
      req.user.uid,
      cacheKey,
      FEED_SAVED_TTL_MS,
      () =>
        fetchSavedPostsPage({
          userId: req.user.uid,
          cursor,
          limit,
        })
    );
  } catch (error) {
    res.status(500).json({
      error: error.message ?? "Saved feed request failed",
    });
  }
});

router.get("/feed/recent", verifyAuth, async (req, res) => {
  try {
    const cursor =
      typeof req.query.cursor === "string" ? req.query.cursor : undefined;
    const limit =
      typeof req.query.limit === "string" ? req.query.limit : undefined;
    const feedContentType = readFeedContentType(req);
    const cacheKey = getCacheKey([
      "feed",
      "recent",
      req.user.uid,
      feedContentType,
      cursor ?? "",
      limit ?? "",
    ]);

    await respondFeedPage(
      res,
      req.user.uid,
      cacheKey,
      FEED_RECENT_TTL_MS,
      () => fetchRecentFeedPage({ cursor, limit, feedContentType })
    );
  } catch (error) {
    res.status(500).json({
      error: error.message ?? "Feed recent request failed",
    });
  }
});

router.get("/feed/following", verifyAuth, async (req, res) => {
  try {
    const cursor =
      typeof req.query.cursor === "string" ? req.query.cursor : undefined;
    const limit =
      typeof req.query.limit === "string" ? req.query.limit : undefined;
    const feedContentType = readFeedContentType(req);
    const cacheKey = getCacheKey([
      "feed",
      "following",
      req.user.uid,
      feedContentType,
      cursor ?? "",
      limit ?? "",
    ]);

    await respondFeedPage(
      res,
      req.user.uid,
      cacheKey,
      FEED_FOLLOWING_TTL_MS,
      () =>
        fetchFollowingFeedPage({
          userId: req.user.uid,
          cursor,
          limit,
          feedContentType,
        })
    );
  } catch (error) {
    res.status(500).json({
      error: error.message ?? "Feed following request failed",
    });
  }
});

router.get("/feed/author/:authorId", verifyAuth, async (req, res) => {
  try {
    const authorId = req.params.authorId;
    const cursor =
      typeof req.query.cursor === "string" ? req.query.cursor : undefined;
    const limit =
      typeof req.query.limit === "string" ? req.query.limit : undefined;
    const feedContentType = readFeedContentType(req);
    const cacheKey = getCacheKey([
      "feed",
      "author",
      req.user.uid,
      authorId,
      feedContentType,
      cursor ?? "",
      limit ?? "",
    ]);

    await respondFeedPage(
      res,
      req.user.uid,
      cacheKey,
      FEED_AUTHOR_TTL_MS,
      () => fetchAuthorFeedPage({ authorId, cursor, limit, feedContentType })
    );
  } catch (error) {
    res.status(500).json({
      error: error.message ?? "Feed author request failed",
    });
  }
});

router.get("/feed/hashtag/:tag", verifyAuth, async (req, res) => {
  try {
    const tag = req.params.tag;
    const cursor =
      typeof req.query.cursor === "string" ? req.query.cursor : undefined;
    const limit =
      typeof req.query.limit === "string" ? req.query.limit : undefined;
    const cacheKey = getCacheKey([
      "feed",
      "hashtag",
      req.user.uid,
      tag,
      cursor ?? "",
      limit ?? "",
    ]);

    await respondFeedPage(
      res,
      req.user.uid,
      cacheKey,
      FEED_HASHTAG_TTL_MS,
      () => fetchHashtagFeedPage({ tag, cursor, limit })
    );
  } catch (error) {
    res.status(500).json({
      error: error.message ?? "Feed hashtag request failed",
    });
  }
});

router.get("/feed/explore", verifyAuth, async (req, res) => {
  try {
    const segmentKey =
      typeof req.query.segmentKey === "string"
        ? req.query.segmentKey
        : undefined;
    const cursor =
      typeof req.query.cursor === "string" ? req.query.cursor : undefined;
    const limit =
      typeof req.query.limit === "string" ? req.query.limit : undefined;
    const feedContentType = readFeedContentType(req);
    const filters = {
      country:
        typeof req.query.country === "string" ? req.query.country : undefined,
      city: typeof req.query.city === "string" ? req.query.city : undefined,
      gender:
        typeof req.query.gender === "string" ? req.query.gender : undefined,
      age:
        typeof req.query.age === "string" && req.query.age.trim()
          ? Number(req.query.age)
          : undefined,
      profession:
        typeof req.query.profession === "string"
          ? req.query.profession
          : undefined,
      maritalStatus:
        typeof req.query.maritalStatus === "string"
          ? req.query.maritalStatus
          : undefined,
    };
    const cacheKey = getCacheKey([
      "feed",
      "explore",
      req.user.uid,
      segmentKey ?? "",
      JSON.stringify(filters),
      feedContentType,
      cursor ?? "",
      limit ?? "",
    ]);

    await respondFeedPage(
      res,
      req.user.uid,
      cacheKey,
      FEED_EXPLORE_TTL_MS,
      () =>
        fetchExploreFeedPage({
          segmentKey,
          filters,
          cursor,
          limit,
          feedContentType,
        })
    );
  } catch (error) {
    res.status(500).json({
      error: error.message ?? "Feed explore request failed",
    });
  }
});

module.exports = router;
