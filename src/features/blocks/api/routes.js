const express = require("express");
const { verifyAuth } = require("../../../lib/verifyAuth");
const {
  getBlockStatus,
  blockUser,
  unblockUser,
} = require("../blockService");
const { createReport } = require("../reportService");
const { mapBlockError } = require("../blockErrors");

const router = express.Router();

router.get("/blocks/:targetUserId/status", verifyAuth, async (req, res) => {
  try {
    const result = await getBlockStatus(req.user.uid, req.params.targetUserId);
    res.json(result);
  } catch (error) {
    mapBlockError(error, res);
  }
});

router.post("/blocks/:targetUserId", verifyAuth, async (req, res) => {
  try {
    const result = await blockUser(req.user.uid, req.params.targetUserId);
    res.json(result);
  } catch (error) {
    mapBlockError(error, res);
  }
});

router.delete("/blocks/:targetUserId", verifyAuth, async (req, res) => {
  try {
    const result = await unblockUser(req.user.uid, req.params.targetUserId);
    res.json(result);
  } catch (error) {
    mapBlockError(error, res);
  }
});

router.post("/reports", verifyAuth, async (req, res) => {
  try {
    const { targetUserId, targetPostId, reason, details } = req.body ?? {};
    const result = await createReport({
      reporterId: req.user.uid,
      targetUserId,
      targetPostId,
      reason,
      details,
    });
    res.json(result);
  } catch (error) {
    mapBlockError(error, res);
  }
});

module.exports = router;
