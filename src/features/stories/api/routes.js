const express = require("express");
const { verifyAuth } = require("../../../lib/verifyAuth");
const { writeRateLimit } = require("../../../lib/rateLimit");
const { createStory } = require("../createStory");
const { listStoriesFeed, getStoryById } = require("../listStoriesFeed");
const { StoryError } = require("../storyErrors");

const router = express.Router();
router.use(writeRateLimit);

function mapStoryError(error, res) {
  if (error instanceof StoryError) {
    return res.status(error.status).json({ error: error.message });
  }
  return res.status(500).json({ error: error.message ?? "Story işlemi başarısız" });
}

router.get("/stories/feed", verifyAuth, async (req, res) => {
  try {
    const result = await listStoriesFeed(req.user.uid, {
      limit: req.query.limit,
    });
    res.json(result);
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
