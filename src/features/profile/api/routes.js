const express = require("express");
const { verifyAuth } = require("../../../lib/verifyAuth");
const { ensureUserRankingEntries } = require("../ensureUserRankingEntries");
const { fetchProfileSummary } = require("../fetchProfileSummary");
const { getCached, setCached, getCacheKey } = require("../../feed/feedCache");
const { attachEngagementsToFeedPage } = require("../../feed/feedEngagement");

const router = express.Router();

router.post("/profile/ensure-ranking-entries", verifyAuth, async (req, res) => {
  try {
    const result = await ensureUserRankingEntries(req.user.uid);
    res.json({ ok: true, ...result });
  } catch (error) {
    res.status(500).json({
      error: error.message ?? "Ensure ranking entries failed",
    });
  }
});

router.get("/profile/:userId/summary", verifyAuth, async (req, res) => {
  try {
    const userId = req.params.userId;
    const limit =
      typeof req.query.postsLimit === "string" ? req.query.postsLimit : "15";
    const cacheKey = getCacheKey([
      "profile",
      "summary",
      req.user.uid,
      userId,
      limit,
    ]);

    const cached = await getCached(cacheKey);
    if (cached) {
      return res.json({ ok: true, ...cached });
    }

    const summary = await fetchProfileSummary({
      userId,
      postsLimit: Number(limit) || 15,
    });

    const postsPage = summary.postsPage
      ? await attachEngagementsToFeedPage(req.user.uid, summary.postsPage)
      : summary.postsPage;

    const payload = {
      ...summary,
      postsPage,
    };

    await setCached(cacheKey, payload, 60_000);
    res.json({ ok: true, ...payload });
  } catch (error) {
    res.status(500).json({
      error: error.message ?? "Profile summary request failed",
    });
  }
});

module.exports = router;
