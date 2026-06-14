const express = require("express");
const { verifyAuth } = require("../../../lib/verifyAuth");
const {
  openConversation,
  sendMessage,
  markConversationRead,
} = require("../messageService");
const { mapMessageError } = require("../messageErrors");

const router = express.Router();

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
