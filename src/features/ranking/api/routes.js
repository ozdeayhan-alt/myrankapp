const express = require("express");
const { verifyAuth } = require("../../../lib/verifyAuth");
const { writeRateLimit, voteRateLimit } = require("../../../lib/rateLimit");
const { parseFiltersFromQuery } = require("../../../lib/segmentFilters");
const {
  getCached,
  setCached,
  getCacheKey,
} = require("../../feed/feedCache");
const {
  fetchRankingEntries,
  ABSOLUTE_MAX,
} = require("../fetchRankingEntries");

const RANKING_ENTRIES_TTL_MS =
  Number(process.env.RANKING_ENTRIES_CACHE_TTL_MS) || 90_000;
const {
  applyInteraction,
  getEngagementStatus,
  getBatchEngagementStatus,
} = require("../engine/applyInteraction");
const {
  applyProfileVoteBatch,
  parseDelta,
  MAX_PROFILE_VOTE_DELTA,
} = require("../engine/applyProfileVoteBatch");
const {
  applyPostVoteBatch,
  MAX_POST_VOTE_DELTA,
} = require("../engine/applyPostVoteBatch");
const {
  applyStoryVoteBatch,
  MAX_STORY_VOTE_DELTA,
} = require("../../stories/applyStoryVoteBatch");
const { INTERACTION_TYPES } = require("../../../config/scoring");
const {
  notifyPostInteraction,
  notifyProfileVotes,
  notifyPostVotes,
} = require("../../notifications/createNotification");
const { afterAuthorScoreChange } = require("../rankingScoreSync");
const { mapVoteError } = require("../voteErrors");

const router = express.Router();
router.use(writeRateLimit);

router.get("/ranking/entries", verifyAuth, async (req, res) => {
  try {
    const filters = parseFiltersFromQuery(req.query);
    const limitRaw =
      typeof req.query.limit === "string" ? req.query.limit : undefined;
    const limit = Math.min(
      Math.max(Number(limitRaw) || ABSOLUTE_MAX, 1),
      ABSOLUTE_MAX
    );

    const cacheKey = getCacheKey([
      "ranking",
      "entries",
      JSON.stringify(filters),
      String(limit),
    ]);

    const cached = await getCached(cacheKey);
    if (cached) {
      res.setHeader("X-Cache-Status", "HIT");
      return res.json({ ok: true, entries: cached });
    }

    const entries = await fetchRankingEntries(filters, limit);
    await setCached(cacheKey, entries, RANKING_ENTRIES_TTL_MS);
    res.setHeader("X-Cache-Status", "MISS");
    return res.json({ ok: true, entries });
  } catch (error) {
    res.status(500).json({
      error: error.message ?? "Ranking entries request failed",
    });
  }
});

function fireNotification(promise) {
  void promise.catch((err) => {
    console.error("[notification]", err.message ?? err);
  });
}

function logVoteBatch({ userId, postId, storyId, targetUserId, delta }) {
  if (process.env.NODE_ENV === "production") {
    return;
  }
  console.log(
    JSON.stringify({
      event: "vote_batch",
      userId,
      ...(postId ? { postId } : {}),
      ...(storyId ? { storyId } : {}),
      ...(targetUserId ? { targetUserId } : {}),
      delta,
      ts: new Date().toISOString(),
    })
  );
}

router.get("/interactions/engagement", verifyAuth, async (req, res) => {
  try {
    const { postId } = req.query;
    if (!postId || typeof postId !== "string") {
      return res.status(400).json({ error: "postId query param is required" });
    }

    const status = await getEngagementStatus({
      postId,
      actorId: req.user.uid,
    });

    res.json({ ok: true, postId, ...status });
  } catch (error) {
    res.status(500).json({
      error: error.message ?? "Engagement status failed",
    });
  }
});

router.post("/interactions/engagements/batch", verifyAuth, async (req, res) => {
  try {
    const { postIds } = req.body;

    if (!Array.isArray(postIds)) {
      return res.status(400).json({ error: "postIds array is required" });
    }

    const engagements = await getBatchEngagementStatus({
      postIds,
      actorId: req.user.uid,
    });

    res.json({ ok: true, engagements });
  } catch (error) {
    res.status(500).json({
      error: error.message ?? "Batch engagement status failed",
    });
  }
});

router.post("/profile-votes/batch", verifyAuth, voteRateLimit, async (req, res) => {
  try {
    const { targetUserId } = req.body;
    const delta = parseDelta(req.body);

    if (!targetUserId || typeof targetUserId !== "string") {
      return res.status(400).json({ error: "targetUserId is required" });
    }

    if (delta === null) {
      return res.status(400).json({
        error: "Provide delta (number) or up/down counts",
      });
    }

    if (delta === 0) {
      return res.status(400).json({ error: "delta must be non-zero" });
    }

    if (Math.abs(delta) > MAX_PROFILE_VOTE_DELTA) {
      return res.status(400).json({
        error: `delta cannot exceed ${MAX_PROFILE_VOTE_DELTA}`,
      });
    }

    logVoteBatch({
      userId: req.user.uid,
      targetUserId,
      delta,
    });

    const result = await applyProfileVoteBatch({
      actorId: req.user.uid,
      targetUserId,
      delta,
    });

    afterAuthorScoreChange(targetUserId, result.scoreDelta);

    if (delta > 0 && targetUserId !== req.user.uid) {
      fireNotification(
        notifyProfileVotes({
          targetUserId,
          actorId: req.user.uid,
          delta,
        })
      );
    }

    res.json({ ok: true, ...result });
  } catch (error) {
    return mapVoteError(error, res, "Profile vote batch failed");
  }
});

router.post("/post-votes/batch", verifyAuth, voteRateLimit, async (req, res) => {
  try {
    const { postId } = req.body;
    const delta = parseDelta(req.body);

    if (!postId || typeof postId !== "string") {
      return res.status(400).json({ error: "postId is required" });
    }

    if (delta === null) {
      return res.status(400).json({
        error: "Provide delta (number) or up/down counts",
      });
    }

    if (delta === 0) {
      return res.status(400).json({ error: "delta must be non-zero" });
    }

    if (Math.abs(delta) > MAX_POST_VOTE_DELTA) {
      return res.status(400).json({
        error: `delta cannot exceed ${MAX_POST_VOTE_DELTA}`,
      });
    }

    logVoteBatch({
      userId: req.user.uid,
      postId,
      delta,
    });

    const result = await applyPostVoteBatch({
      actorId: req.user.uid,
      postId,
      delta,
    });

    afterAuthorScoreChange(result.authorId, result.scoreDelta);

    if (
      delta > 0 &&
      result.authorId &&
      result.authorId !== req.user.uid
    ) {
      fireNotification(
        notifyPostVotes({
          authorId: result.authorId,
          actorId: req.user.uid,
          postId,
          delta,
        })
      );
    }

    res.json({ ok: true, ...result });
  } catch (error) {
    return mapVoteError(error, res, "Post vote batch failed");
  }
});

router.post("/story-votes/batch", verifyAuth, voteRateLimit, async (req, res) => {
  try {
    const { storyId } = req.body;
    const delta = parseDelta(req.body);

    if (!storyId || typeof storyId !== "string") {
      return res.status(400).json({ error: "storyId is required" });
    }

    if (delta === null) {
      return res.status(400).json({
        error: "Provide delta (number) or up/down counts",
      });
    }

    if (delta === 0) {
      return res.status(400).json({ error: "delta must be non-zero" });
    }

    if (Math.abs(delta) > MAX_STORY_VOTE_DELTA) {
      return res.status(400).json({
        error: `delta cannot exceed ${MAX_STORY_VOTE_DELTA}`,
      });
    }

    logVoteBatch({
      userId: req.user.uid,
      storyId,
      delta,
    });

    const result = await applyStoryVoteBatch({
      actorId: req.user.uid,
      storyId,
      delta,
    });

    afterAuthorScoreChange(result.authorId, result.scoreDelta);

    res.json({ ok: true, ...result });
  } catch (error) {
    return mapVoteError(error, res, "Story vote batch failed");
  }
});

router.post("/interactions", verifyAuth, async (req, res) => {
  try {
    const { postId, type, commentText } = req.body;

    if (!postId || !type) {
      return res.status(400).json({ error: "postId and type are required" });
    }

    if (!INTERACTION_TYPES.includes(type)) {
      return res.status(400).json({
        error: `type must be one of: ${INTERACTION_TYPES.join(", ")}`,
      });
    }

    if (type === "comment" && !commentText?.trim()) {
      return res.status(400).json({
        error: "commentText is required for comment interactions",
      });
    }

    const result = await applyInteraction({
      postId,
      actorId: req.user.uid,
      type,
      commentText,
    });

    afterAuthorScoreChange(result.authorId, result.scoreDelta);

    const actorId = req.user.uid;
    if (result.authorId && result.authorId !== actorId) {
      const { engagement, firstAction } = result;
      if (type === "comment") {
        fireNotification(
          notifyPostInteraction({
            authorId: result.authorId,
            actorId,
            postId,
            type: "comment",
          })
        );
      } else if (type === "save" && engagement?.saved && firstAction) {
        fireNotification(
          notifyPostInteraction({
            authorId: result.authorId,
            actorId,
            postId,
            type: "save",
          })
        );
      }
    }

    res.json({ ok: true, ...result });
  } catch (error) {
    res.status(500).json({
      error: error.message ?? "Interaction failed",
    });
  }
});

module.exports = router;
