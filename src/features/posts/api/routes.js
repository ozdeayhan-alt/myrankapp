const express = require("express");
const { verifyAuth } = require("../../../lib/verifyAuth");
const { writeRateLimit } = require("../../../lib/rateLimit");
const { deletePost } = require("../deletePost");
const { updatePostContent } = require("../updatePostContent");
const { repostPost } = require("../repostPost");
const { createPost } = require("../createPost");
const { mapPostError } = require("../postErrors");
const {
  createNotification,
} = require("../../notifications/createNotification");
const { resolveMentions } = require("../resolveMentions");
const { notifyMentions } = require("../notifyMentions");
const { enqueueFanOut } = require("../../../lib/jobQueue");
const { fetchPostById } = require("../../profile/fetchProfileSummary");
const { fetchPostComments } = require("../fetchPostComments");
const { invalidateFeedCachesForPost } = require("../../feed/feedCache");
const { unfurlLink } = require("../unfurlLink");
const { PostError } = require("../postErrors");

const router = express.Router();
router.use(writeRateLimit);

router.post("/posts", verifyAuth, async (req, res) => {
  try {
    const result = await createPost(req.user.uid, req.body ?? {});
    res.status(201).json(result);
  } catch (error) {
    mapPostError(error, res);
  }
});

router.post("/posts/mentions/resolve", verifyAuth, async (req, res) => {
  try {
    const { tokens } = req.body ?? {};
    const result = await resolveMentions(tokens, req.user.uid);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message ?? "Mention çözümlenemedi" });
  }
});

router.post("/posts/mentions/notify", verifyAuth, async (req, res) => {
  try {
    const { postId, mentionUserIds } = req.body ?? {};
    const result = await notifyMentions(
      req.user.uid,
      postId,
      mentionUserIds
    );
    res.json(result);
  } catch (error) {
    const status = error.statusCode === 403 ? 403 : 400;
    res.status(status).json({ error: error.message ?? "Mention bildirimi başarısız" });
  }
});

router.post("/posts/:postId/fan-out", verifyAuth, async (req, res) => {
  try {
    const postId = req.params.postId;
    const post = await fetchPostById(postId);
    if (!post) {
      return res.status(404).json({ error: "Gönderi bulunamadı" });
    }
    if (post.authorId !== req.user.uid) {
      return res.status(403).json({ error: "Bu gönderi size ait değil" });
    }

    const fanOut = await enqueueFanOut(postId);
    void invalidateFeedCachesForPost({
      authorId: post.authorId,
      segmentKey: post.segmentKey,
      hashtags: [],
    });

    res.json({ ok: true, ...fanOut });
  } catch (error) {
    res.status(500).json({ error: error.message ?? "Fan-out failed" });
  }
});

router.post("/links/preview", verifyAuth, async (req, res) => {
  try {
    const { url } = req.body ?? {};
    if (!url || !String(url).trim()) {
      return res.status(400).json({ error: "url is required" });
    }

    const preview = await unfurlLink(url);
    if (!preview.linkUrl) {
      return res.status(400).json({ error: "Geçersiz link" });
    }

    res.json({ ok: true, preview });
  } catch (error) {
    if (error instanceof PostError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    res.status(500).json({ error: error.message ?? "Link önizlemesi alınamadı" });
  }
});

router.get("/posts/:postId/comments", verifyAuth, async (req, res) => {
  try {
    const limit =
      typeof req.query.limit === "string" ? req.query.limit : undefined;
    const comments = await fetchPostComments(req.params.postId, limit);
    res.json({ ok: true, comments });
  } catch (error) {
    res.status(500).json({
      error: error.message ?? "Post comments request failed",
    });
  }
});

router.get("/posts/:postId", verifyAuth, async (req, res) => {
  try {
    const post = await fetchPostById(req.params.postId);
    if (!post) {
      return res.status(404).json({ error: "Gönderi bulunamadı" });
    }
    res.json({ ok: true, post });
  } catch (error) {
    res.status(500).json({ error: error.message ?? "Post fetch failed" });
  }
});

router.delete("/posts/:postId", verifyAuth, async (req, res) => {
  try {
    const result = await deletePost(req.params.postId, req.user.uid);
    res.json(result);
  } catch (error) {
    mapPostError(error, res);
  }
});

router.post("/posts/repost", verifyAuth, async (req, res) => {
  try {
    const { postId, caption } = req.body ?? {};
    const result = await repostPost(postId, req.user.uid, caption);

    if (
      result.originalAuthorId &&
      result.originalAuthorId !== req.user.uid
    ) {
      void createNotification({
        recipientId: result.originalAuthorId,
        actorId: req.user.uid,
        type: "post_reposted",
        payload: {
          postId: result.originalPostId,
          repostId: result.repostId,
        },
      }).catch((err) => {
        console.error("[notification]", err.message ?? err);
      });
    }

    res.json(result);
  } catch (error) {
    mapPostError(error, res);
  }
});

router.patch("/posts/:postId", verifyAuth, async (req, res) => {
  try {
    const { content } = req.body ?? {};
    const result = await updatePostContent(
      req.params.postId,
      req.user.uid,
      content
    );
    res.json(result);
  } catch (error) {
    mapPostError(error, res);
  }
});

module.exports = router;
