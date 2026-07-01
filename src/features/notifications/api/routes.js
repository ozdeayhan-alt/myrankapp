const express = require("express");
const { verifyAuth } = require("../../../lib/verifyAuth");
const { getCached, setCached, getCacheKey } = require("../../feed/feedCache");
const {
  fetchNotifications,
  DEFAULT_LIMIT,
  MAX_LIMIT,
} = require("../fetchNotifications");

const NOTIFICATIONS_CACHE_TTL_MS =
  Number(process.env.NOTIFICATIONS_CACHE_TTL_MS) || 60_000;

const router = express.Router();

router.get("/notifications", verifyAuth, async (req, res) => {
  try {
    const limitRaw =
      typeof req.query.limit === "string" ? req.query.limit : undefined;
    const limit = Math.min(
      Math.max(Number(limitRaw) || DEFAULT_LIMIT, 1),
      MAX_LIMIT
    );

    const cacheKey = getCacheKey([
      "notifications",
      req.user.uid,
      String(limit),
    ]);

    const cached = await getCached(cacheKey);
    if (cached) {
      res.setHeader("X-Cache-Status", "HIT");
      return res.json({ ok: true, notifications: cached });
    }

    const notifications = await fetchNotifications(req.user.uid, limit);
    await setCached(cacheKey, notifications, NOTIFICATIONS_CACHE_TTL_MS);
    res.setHeader("X-Cache-Status", "MISS");
    return res.json({ ok: true, notifications });
  } catch (error) {
    res.status(500).json({
      error: error.message ?? "Notifications request failed",
    });
  }
});

module.exports = router;
