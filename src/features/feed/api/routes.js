const express = require("express");
const { verifyAuth } = require("../../../lib/verifyAuth");
const { filterPostsForViewer } = require("../../blocks/blockService");
const {
  getCached,
  setCached,
  getCacheKey,
  invalidateFeedCaches,
} = require("../feedCache");
const { attachEngagementsToFeedPage } = require("../feedEngagement");
const { fetchSavedPostsPage } = require("../fetchSavedPosts");
const {
  fetchRecentFeedPage,
  fetchTopFeedPage,
  fetchExploreFeedPage,
  fetchFollowingFeedPage,
  fetchAuthorFeedPage,
  fetchHashtagFeedPage,
} = require("../fetchFeedPosts");

const router = express.Router();

async function buildFeedResponse(viewerId, page, cacheKey, ttlMs) {
  const filtered = await filterPostsForViewer(viewerId, page);
  const withEngagement = await attachEngagementsToFeedPage(viewerId, filtered);
  setCached(cacheKey, withEngagement, ttlMs);
  return withEngagement;
}

router.post("/feed/invalidate", verifyAuth, (req, res) => {
  invalidateFeedCaches();
  res.json({ ok: true });
});

router.get("/feed/saved", verifyAuth, async (req, res) => {
  try {
    const limit =
      typeof req.query.limit === "string" ? req.query.limit : undefined;
    const cacheKey = getCacheKey([
      "feed",
      "saved",
      req.user.uid,
      limit ?? "",
    ]);

    const cached = getCached(cacheKey);
    if (cached) {
      return res.json({ ok: true, ...cached });
    }

    const page = await buildFeedResponse(
      req.user.uid,
      await fetchSavedPostsPage({ userId: req.user.uid, limit }),
      cacheKey
    );
    res.json({ ok: true, ...page });
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
    const cacheKey = getCacheKey([
      "feed",
      "recent",
      req.user.uid,
      cursor ?? "",
      limit ?? "",
    ]);

    const cached = getCached(cacheKey);
    if (cached) {
      return res.json({ ok: true, ...cached });
    }

    const page = await buildFeedResponse(
      req.user.uid,
      await fetchRecentFeedPage({ cursor, limit }),
      cacheKey
    );
    res.json({ ok: true, ...page });
  } catch (error) {
    res.status(500).json({
      error: error.message ?? "Feed recent request failed",
    });
  }
});

router.get("/feed/top", verifyAuth, async (req, res) => {
  try {
    const limit =
      typeof req.query.limit === "string" ? req.query.limit : undefined;
    const cacheKey = getCacheKey([
      "feed",
      "top",
      req.user.uid,
      limit ?? "",
    ]);

    const cached = getCached(cacheKey);
    if (cached) {
      return res.json({ ok: true, ...cached });
    }

    const page = await buildFeedResponse(
      req.user.uid,
      await fetchTopFeedPage({ limit }),
      cacheKey
    );
    res.json({ ok: true, ...page });
  } catch (error) {
    res.status(500).json({
      error: error.message ?? "Feed top request failed",
    });
  }
});

router.get("/feed/following", verifyAuth, async (req, res) => {
  try {
    const cursor =
      typeof req.query.cursor === "string" ? req.query.cursor : undefined;
    const limit =
      typeof req.query.limit === "string" ? req.query.limit : undefined;
    const cacheKey = getCacheKey([
      "feed",
      "following",
      req.user.uid,
      cursor ?? "",
      limit ?? "",
    ]);

    const cached = getCached(cacheKey);
    if (cached) {
      return res.json({ ok: true, ...cached });
    }

    const page = await buildFeedResponse(
      req.user.uid,
      await fetchFollowingFeedPage({
        userId: req.user.uid,
        cursor,
        limit,
      }),
      cacheKey,
      120_000
    );
    res.json({ ok: true, ...page });
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
    const cacheKey = getCacheKey([
      "feed",
      "author",
      req.user.uid,
      authorId,
      cursor ?? "",
      limit ?? "",
    ]);

    const cached = getCached(cacheKey);
    if (cached) {
      return res.json({ ok: true, ...cached });
    }

    const page = await buildFeedResponse(
      req.user.uid,
      await fetchAuthorFeedPage({ authorId, cursor, limit }),
      cacheKey
    );
    res.json({ ok: true, ...page });
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

    const cached = getCached(cacheKey);
    if (cached) {
      return res.json({ ok: true, ...cached });
    }

    const page = await buildFeedResponse(
      req.user.uid,
      await fetchHashtagFeedPage({ tag, cursor, limit }),
      cacheKey
    );
    res.json({ ok: true, ...page });
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
      cursor ?? "",
      limit ?? "",
    ]);

    const cached = getCached(cacheKey);
    if (cached) {
      return res.json({ ok: true, ...cached });
    }

    const page = await buildFeedResponse(
      req.user.uid,
      await fetchExploreFeedPage({
        segmentKey,
        filters,
        cursor,
        limit,
      }),
      cacheKey
    );
    res.json({ ok: true, ...page });
  } catch (error) {
    res.status(500).json({
      error: error.message ?? "Feed explore request failed",
    });
  }
});

module.exports = router;
