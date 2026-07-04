const express = require("express");
const { verifyAuth } = require("../../../lib/verifyAuth");
const { voteRateLimit } = require("../../../lib/rateLimit");
const { fetchDuelMatch } = require("../fetchDuelMatch");
const { applyDuelVoteBatch } = require("../applyDuelVoteBatch");
const { mapVoteError } = require("../../ranking/voteErrors");

const router = express.Router();

router.get("/duel/match", verifyAuth, async (req, res) => {
  try {
    const excludeRaw = req.query.excludeIds;
    let excludeIds = [];
    if (typeof excludeRaw === "string" && excludeRaw.trim()) {
      excludeIds = excludeRaw.split(",").map((id) => id.trim()).filter(Boolean);
    }

    const match = await fetchDuelMatch({
      viewerId: req.user.uid,
      excludeIds,
    });

    res.json({ ok: true, ...match });
  } catch (error) {
    const status = error.message === "Not enough Glow posts for duel" ? 404 : 500;
    res.status(status).json({
      error: error.message ?? "Duel match request failed",
    });
  }
});

router.post("/duel/votes/batch", verifyAuth, voteRateLimit, async (req, res) => {
  try {
    const { votes } = req.body;
    const result = await applyDuelVoteBatch({
      actorId: req.user.uid,
      votes,
    });
    res.json({ ok: true, ...result });
  } catch (error) {
    return mapVoteError(error, res, "Duel vote batch failed");
  }
});

module.exports = router;
