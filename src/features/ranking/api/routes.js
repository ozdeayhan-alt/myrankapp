const express = require("express");
const { verifyAuth } = require("../../../lib/verifyAuth");
const { writeRateLimit } = require("../../../lib/rateLimit");
const {
  applyInteraction,
  getEngagementStatus,
  getBatchEngagementStatus,
} = require("../engine/applyInteraction");
const { applyInteractionSession } = require("../engine/applyInteractionSession");
const { applyLikeBonus } = require("../engine/applyLikeBonus");
const { applyDislikeBonus } = require("../engine/applyDislikeBonus");
const { LIKE_BONUS_TIERS } = require("../../../config/scoring");
const {
  applyProfileVoteBatch,
  parseDelta,
  MAX_PROFILE_VOTE_DELTA,
} = require("../engine/applyProfileVoteBatch");
const { INTERACTION_TYPES } = require("../../../config/scoring");
const {
  notifyPostInteraction,
  notifyProfileVotes,
} = require("../../notifications/createNotification");

const router = express.Router();
router.use(writeRateLimit);

function fireNotification(promise) {
  void promise.catch((err) => {
    console.error("[notification]", err.message ?? err);
  });
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

router.post("/profile-votes/batch", verifyAuth, async (req, res) => {
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

    const result = await applyProfileVoteBatch({
      actorId: req.user.uid,
      targetUserId,
      delta,
    });

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
    res.status(500).json({
      error: error.message ?? "Profile vote batch failed",
    });
  }
});

router.post("/interactions/like-bonus", verifyAuth, async (req, res) => {
  try {
    const { postId, bonusPoints } = req.body;

    if (!postId || typeof postId !== "string") {
      return res.status(400).json({ error: "postId is required" });
    }

    if (!LIKE_BONUS_TIERS.includes(bonusPoints)) {
      return res.status(400).json({
        error: `bonusPoints must be one of: ${LIKE_BONUS_TIERS.join(", ")}`,
      });
    }

    const result = await applyLikeBonus({
      postId,
      actorId: req.user.uid,
      bonusPoints,
    });

    res.json({ ok: true, ...result });
  } catch (error) {
    res.status(500).json({
      error: error.message ?? "Like bonus failed",
    });
  }
});

router.post("/interactions/dislike-bonus", verifyAuth, async (req, res) => {
  try {
    const { postId, bonusPoints } = req.body;

    if (!postId || typeof postId !== "string") {
      return res.status(400).json({ error: "postId is required" });
    }

    if (!LIKE_BONUS_TIERS.includes(bonusPoints)) {
      return res.status(400).json({
        error: `bonusPoints must be one of: ${LIKE_BONUS_TIERS.join(", ")}`,
      });
    }

    const result = await applyDislikeBonus({
      postId,
      actorId: req.user.uid,
      bonusPoints,
    });

    res.json({ ok: true, ...result });
  } catch (error) {
    res.status(500).json({
      error: error.message ?? "Dislike bonus failed",
    });
  }
});

router.post("/interactions/session", verifyAuth, async (req, res) => {
  try {
    const { postId, liked, disliked } = req.body;

    if (!postId || typeof postId !== "string") {
      return res.status(400).json({ error: "postId is required" });
    }

    if (typeof liked !== "boolean" || typeof disliked !== "boolean") {
      return res.status(400).json({
        error: "liked and disliked must be booleans",
      });
    }

    if (liked && disliked) {
      return res.status(400).json({
        error: "liked and disliked cannot both be true",
      });
    }

    const result = await applyInteractionSession({
      postId,
      actorId: req.user.uid,
      liked,
      disliked,
    });

    const actorId = req.user.uid;
    if (
      !result.unchanged &&
      result.authorId &&
      result.authorId !== actorId &&
      result.notifyType === "like" &&
      result.engagement?.liked
    ) {
      fireNotification(
        notifyPostInteraction({
          authorId: result.authorId,
          actorId,
          postId,
          type: "like",
        })
      );
    }

    res.json({ ok: true, ...result });
  } catch (error) {
    res.status(500).json({
      error: error.message ?? "Interaction session failed",
    });
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

    const actorId = req.user.uid;
    if (result.authorId && result.authorId !== actorId) {
      const { engagement, firstAction } = result;
      if (type === "like" && engagement?.liked) {
        fireNotification(
          notifyPostInteraction({
            authorId: result.authorId,
            actorId,
            postId,
            type: "like",
          })
        );
      } else if (type === "comment") {
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
