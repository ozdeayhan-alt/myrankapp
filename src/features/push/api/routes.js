const express = require("express");
const { verifyAuth } = require("../../../lib/verifyAuth");
const {
  registerPushToken,
  unregisterPushToken,
} = require("../pushTokenService");

const router = express.Router();

router.post("/push/register", verifyAuth, async (req, res) => {
  try {
    const expoPushToken =
      typeof req.body?.expoPushToken === "string" ? req.body.expoPushToken : "";
    const platform =
      typeof req.body?.platform === "string" ? req.body.platform : "android";

    const result = await registerPushToken({
      userId: req.user.uid,
      expoPushToken,
      platform,
    });

    res.json(result);
  } catch (error) {
    res.status(400).json({
      ok: false,
      error: error.message ?? "Push token kaydedilemedi",
    });
  }
});

router.post("/push/unregister", verifyAuth, async (req, res) => {
  try {
    const expoPushToken =
      typeof req.body?.expoPushToken === "string" ? req.body.expoPushToken : "";

    const result = await unregisterPushToken({
      userId: req.user.uid,
      expoPushToken,
    });

    res.json(result);
  } catch (error) {
    res.status(400).json({
      ok: false,
      error: error.message ?? "Push token silinemedi",
    });
  }
});

module.exports = router;
