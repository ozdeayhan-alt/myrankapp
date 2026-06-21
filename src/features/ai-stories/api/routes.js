const express = require("express");
const { verifyAuth } = require("../../../lib/verifyAuth");
const { writeRateLimit } = require("../../../lib/rateLimit");
const { createAiStory } = require("../createAiStory");
const {
  listAiStoriesFeed,
  getAiStoryById,
} = require("../listAiStoriesFeed");
const { linkStoryToPost } = require("../linkStoryPost");
const { STORY_TEMPLATES } = require("../storyTemplates");
const { AiStoryError } = require("../aiStoryErrors");

const router = express.Router();
router.use(writeRateLimit);

function mapAiStoryError(error, res) {
  if (error instanceof AiStoryError) {
    return res.status(error.status).json({ error: error.message });
  }
  return res.status(500).json({ error: error.message ?? "Story işlemi başarısız" });
}

router.get("/ai-stories/templates", verifyAuth, (_req, res) => {
  res.json({ ok: true, templates: STORY_TEMPLATES });
});

router.get("/ai-stories/feed", verifyAuth, async (req, res) => {
  try {
    const result = await listAiStoriesFeed(req.user.uid, {
      limit: req.query.limit,
    });
    res.json(result);
  } catch (error) {
    mapAiStoryError(error, res);
  }
});

router.get("/ai-stories/:storyId", verifyAuth, async (req, res) => {
  try {
    const story = await getAiStoryById(req.user.uid, req.params.storyId);
    if (!story) {
      return res.status(404).json({ error: "Story bulunamadı" });
    }
    res.json({ ok: true, story });
  } catch (error) {
    mapAiStoryError(error, res);
  }
});

router.post("/ai-stories", verifyAuth, async (req, res) => {
  try {
    const { moodKey, locationKey, actionKey, caption } = req.body ?? {};
    const result = await createAiStory(req.user.uid, {
      moodKey,
      locationKey,
      actionKey,
      caption,
    });
    res.status(201).json(result);
  } catch (error) {
    mapAiStoryError(error, res);
  }
});

router.post("/ai-stories/:storyId/share", verifyAuth, async (req, res) => {
  try {
    const { postId } = req.body ?? {};
    const result = await linkStoryToPost(
      req.user.uid,
      req.params.storyId,
      postId
    );
    res.json(result);
  } catch (error) {
    mapAiStoryError(error, res);
  }
});

module.exports = router;
