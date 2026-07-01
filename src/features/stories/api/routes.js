const express = require("express");
const { verifyAuth } = require("../../../lib/verifyAuth");
const { writeRateLimit } = require("../../../lib/rateLimit");
const { getCached, setCached, getCacheKey } = require("../../feed/feedCache");
const { createStory } = require("../createStory");
const { listStoriesFeed, getStoryById } = require("../listStoriesFeed");
const { recordStoryView } = require("../recordStoryView");
const { toggleStoryLike } = require("../toggleStoryLike");
const { getStoryInsights } = require("../getStoryInsights");
const { getStoryEngagement } = require("../getStoryEngagement");
const { StoryError } = require("../storyErrors");

const router = express.Router();
router.use(writeRateLimit);

function mapStoryError(error, res) {
  if (error instanceof StoryError) {
    return res.status(error.status).json({ error: error.message });
  }
  return res.status(500).json({ error: error.message ?? "Story işlemi başarısız" });
}

const STORIES_FEED_CACHE_TTL_MS =
  Number(process.env.STORIES_FEED_CACHE_TTL_MS) || 45_000;

router.get("/stories/feed", verifyAuth, async (req, res) => {
  try {
    const cacheKey = getCacheKey([
      "stories",
      "feed",
      req.user.uid,
      typeof req.query.limit === "string" ? req.query.limit : "",
    ]);
    const cached = await getCached(cacheKey);
    if (cached) {
      res.setHeader("X-Cache-Status", "HIT");
      return res.json(cached);
    }

    const result = await listStoriesFeed(req.user.uid, {
      limit: req.query.limit,
    });
    await setCached(cacheKey, result, STORIES_FEED_CACHE_TTL_MS);
    res.setHeader("X-Cache-Status", "MISS");
    res.json(result);
  } catch (error) {
    mapStoryError(error, res);
  }
});

router.get("/stories/:storyId/insights", verifyAuth, async (req, res) => {
  try {
    const result = await getStoryInsights(req.user.uid, req.params.storyId);
    res.json({ ok: true, ...result });
  } catch (error) {
    mapStoryError(error, res);
  }
});

router.get("/stories/:storyId/engagement", verifyAuth, async (req, res) => {
  try {
    const result = await getStoryEngagement(req.user.uid, req.params.storyId);
    res.json({ ok: true, ...result });
  } catch (error) {
    mapStoryError(error, res);
  }
});

router.get("/stories/:storyId", verifyAuth, async (req, res) => {
  try {
    const story = await getStoryById(req.user.uid, req.params.storyId);
    if (!story) {
      return res.status(404).json({ error: "Story bulunamadı" });
    }
    res.json({ ok: true, story });
  } catch (error) {
    mapStoryError(error, res);
  }
});

router.post("/stories/:storyId/view", verifyAuth, async (req, res) => {
  try {
    const result = await recordStoryView(req.user.uid, req.params.storyId);
    res.json({ ok: true, ...result });
  } catch (error) {
    mapStoryError(error, res);
  }
});

router.post("/stories/:storyId/like", verifyAuth, async (req, res) => {
  try {
    const result = await toggleStoryLike(req.user.uid, req.params.storyId);
    res.json({ ok: true, ...result });
  } catch (error) {
    mapStoryError(error, res);
  }
});

router.post("/stories", verifyAuth, async (req, res) => {
  try {
    const { mediaType, mediaURL, posterURL, caption } = req.body ?? {};
    const result = await createStory(req.user.uid, {
      mediaType,
      mediaURL,
      posterURL,
      caption,
    });
    res.status(201).json(result);
  } catch (error) {
    mapStoryError(error, res);
  }
});

module.exports = router;
