const express = require("express");
const { verifyAuth } = require("../../../lib/verifyAuth");
const { writeRateLimit, voteRateLimit } = require("../../../lib/rateLimit");
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
const { INTERACTION_TYPES } = require("../../../config/scoring");
const {
  notifyPostInteraction,
  notifyProfileVotes,
  notifyPostVotes,
} = require("../../notifications/createNotification");

const router = express.Router();
router.use(writeRateLimit);

function fireNotification(promise) {
  void promise.catch((err) => {
    console.error("[notification]", err.message ?? err);
  });
}

function logVoteBatch({ userId, postId, targetUserId, delta }) {
  console.log(
    JSON.stringify({
      event: "vote_batch",
      userId,
      ...(postId ? { postId } : {}),
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
    res.status(500).json({
      error: error.message ?? "Post vote batch failed",
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
