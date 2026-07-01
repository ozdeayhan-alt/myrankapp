const express = require("express");
const { verifyAuth } = require("../../../lib/verifyAuth");
const { writeRateLimit } = require("../../../lib/rateLimit");
const {
  openConversation,
  sendMessage,
  markConversationRead,
} = require("../messageService");
const { mapMessageError } = require("../messageErrors");
const { fetchInboxEntries } = require("../fetchInbox");
const { fetchConversationMessages } = require("../fetchConversationMessages");
const { getCached, setCached } = require("../../feed/feedCache");
const { inboxCacheKey, INBOX_CACHE_TTL_MS } = require("../inboxCache");

const router = express.Router();
router.use(writeRateLimit);

router.get("/messages/inbox", verifyAuth, async (req, res) => {
  try {
    const userId = req.user.uid;
    const cacheKey = inboxCacheKey(userId);

    const cached = await getCached(cacheKey);
    if (cached) {
      res.setHeader("X-Cache-Status", "HIT");
      return res.json({ ok: true, entries: cached });
    }

    const entries = await fetchInboxEntries(userId);
    await setCached(cacheKey, entries, INBOX_CACHE_TTL_MS);
    res.setHeader("X-Cache-Status", "MISS");
    return res.json({ ok: true, entries });
  } catch (error) {
    res.status(500).json({
      error: error.message ?? "Inbox request failed",
    });
  }
});

router.get(
  "/messages/conversations/:conversationId/messages",
  verifyAuth,
  async (req, res) => {
    try {
      const { conversationId } = req.params;
      const after =
        typeof req.query.after === "string" ? req.query.after : undefined;
      const limitRaw =
        typeof req.query.limit === "string" ? req.query.limit : undefined;
      const limit =
        limitRaw != null && limitRaw !== "" ? Number(limitRaw) : undefined;

      const messages = await fetchConversationMessages(
        req.user.uid,
        conversationId,
        { limit, after }
      );

      return res.json({ ok: true, messages });
    } catch (error) {
      mapMessageError(error, res);
    }
  }
);

router.post("/messages/conversations", verifyAuth, async (req, res) => {
  try {
    const { targetUserId } = req.body ?? {};
    const result = await openConversation(req.user.uid, targetUserId);
    res.json(result);
  } catch (error) {
    mapMessageError(error, res);
  }
});

router.post("/messages/send", verifyAuth, async (req, res) => {
  try {
    const { conversationId, text, type, mediaURL, posterURL } = req.body ?? {};
    const result = await sendMessage(req.user.uid, conversationId, {
      text,
      type,
      mediaURL,
      posterURL,
    });
    res.json(result);
  } catch (error) {
    mapMessageError(error, res);
  }
});

router.post("/messages/read", verifyAuth, async (req, res) => {
  try {
    const { conversationId } = req.body ?? {};
    const result = await markConversationRead(req.user.uid, conversationId);
    res.json(result);
  } catch (error) {
    mapMessageError(error, res);
  }
});

module.exports = router;
