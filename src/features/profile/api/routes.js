const express = require("express");
const { verifyAuth } = require("../../../lib/verifyAuth");
const { ensureUserRankingEntries } = require("../ensureUserRankingEntries");
const { fetchProfileSummary, fetchProfileGaugeBootstrap } = require("../fetchProfileSummary");
const { fetchRankingLadderFull } = require("../fetchRankingLadderFull");
const { getCached, setCached, getCacheKey } = require("../../feed/feedCache");
const { attachEngagementsToFeedPage } = require("../../feed/feedEngagement");
const { GLOBAL_RANKING_SEGMENT } = require("../../../lib/segmentKey");
const {
  fetchPublicProfile,
  fetchRankingEntry,
  fetchRankingSnapshotMeta,
} = require("../fetchPublicProfile");
const { fetchOwnProfile } = require("../fetchOwnProfile");
const {
  saveOwnProfile,
  updateOwnProfilePhoto,
} = require("../saveOwnProfile");
const { syncOwnPublicProfile } = require("../syncOwnPublicProfile");
const { fetchProfileRankings } = require("../fetchProfileRankings");

const PROFILE_SUMMARY_CACHE_TTL_MS =
  Number(process.env.PROFILE_SUMMARY_CACHE_TTL_MS) || 120_000;
const PROFILE_GAUGE_BOOTSTRAP_CACHE_TTL_MS =
  Number(process.env.PROFILE_GAUGE_BOOTSTRAP_CACHE_TTL_MS) || 120_000;
const PROFILE_LADDER_CACHE_TTL_MS =
  Number(process.env.PROFILE_LADDER_CACHE_TTL_MS) || 30 * 60_000;
const PUBLIC_PROFILE_CACHE_TTL_MS =
  Number(process.env.PUBLIC_PROFILE_CACHE_TTL_MS) || 120_000;
const RANKING_ENTRY_CACHE_TTL_MS =
  Number(process.env.RANKING_ENTRY_CACHE_TTL_MS) || 90_000;
const RANKING_SNAPSHOT_META_CACHE_TTL_MS =
  Number(process.env.RANKING_SNAPSHOT_META_CACHE_TTL_MS) || 300_000;
const OWN_PROFILE_CACHE_TTL_MS =
  Number(process.env.OWN_PROFILE_CACHE_TTL_MS) || 120_000;
const PROFILE_RANKINGS_CACHE_TTL_MS =
  Number(process.env.PROFILE_RANKINGS_CACHE_TTL_MS) || 90_000;

const router = express.Router();

router.post("/profile/ensure-ranking-entries", verifyAuth, async (req, res) => {
  try {
    const result = await ensureUserRankingEntries(req.user.uid);
    res.json({ ok: true, ...result });
  } catch (error) {
    res.status(500).json({
      error: error.message ?? "Ensure ranking entries failed",
    });
  }
});

router.get("/profile/me", verifyAuth, async (req, res) => {
  try {
    const userId = req.user.uid;
    const cacheKey = getCacheKey(["profile", "me", userId]);

    const cached = await getCached(cacheKey);
    if (cached) {
      res.setHeader("X-Cache-Status", "HIT");
      return res.json({ ok: true, profile: cached });
    }

    const profile = await fetchOwnProfile(userId);
    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    await setCached(cacheKey, profile, OWN_PROFILE_CACHE_TTL_MS);
    res.setHeader("X-Cache-Status", "MISS");
    return res.json({ ok: true, profile });
  } catch (error) {
    res.status(500).json({
      error: error.message ?? "Own profile request failed",
    });
  }
});

router.put("/profile/me", verifyAuth, async (req, res) => {
  try {
    const result = await saveOwnProfile(req.user.uid, req.body ?? {});
    res.json(result);
  } catch (error) {
    const status = error.statusCode ?? 500;
    res.status(status).json({
      error: error.message ?? "Profile save failed",
    });
  }
});

router.patch("/profile/me/photo", verifyAuth, async (req, res) => {
  try {
    const { photoURL } = req.body ?? {};
    const result = await updateOwnProfilePhoto(req.user.uid, photoURL);
    res.json(result);
  } catch (error) {
    const status = error.statusCode ?? 500;
    res.status(status).json({
      error: error.message ?? "Profile photo update failed",
    });
  }
});

router.post("/profile/me/sync-public", verifyAuth, async (req, res) => {
  try {
    const result = await syncOwnPublicProfile(req.user.uid);
    res.json({ ok: true, ...result });
  } catch (error) {
    res.status(500).json({
      error: error.message ?? "Public profile sync failed",
    });
  }
});

router.get("/profile/:userId/rankings", verifyAuth, async (req, res) => {
  try {
    const userId = req.params.userId;
    const cacheKey = getCacheKey(["profile", "rankings", userId]);

    const cached = await getCached(cacheKey);
    if (cached) {
      res.setHeader("X-Cache-Status", "HIT");
      return res.json({ ok: true, rankings: cached });
    }

    const rankings = await fetchProfileRankings(userId, req.user.uid);
    await setCached(cacheKey, rankings, PROFILE_RANKINGS_CACHE_TTL_MS);
    res.setHeader("X-Cache-Status", "MISS");
    return res.json({ ok: true, rankings });
  } catch (error) {
    res.status(500).json({
      error: error.message ?? "Profile rankings request failed",
    });
  }
});

router.get("/profile/:userId/public", verifyAuth, async (req, res) => {
  try {
    const userId = req.params.userId;
    const cacheKey = getCacheKey(["profile", "public", userId]);

    const cached = await getCached(cacheKey);
    if (cached) {
      res.setHeader("X-Cache-Status", "HIT");
      return res.json({ ok: true, profile: cached });
    }

    const profile = await fetchPublicProfile(userId);
    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    await setCached(cacheKey, profile, PUBLIC_PROFILE_CACHE_TTL_MS);
    res.setHeader("X-Cache-Status", "MISS");
    return res.json({ ok: true, profile });
  } catch (error) {
    res.status(500).json({
      error: error.message ?? "Public profile request failed",
    });
  }
});

router.get("/profile/:userId/ranking-entry", verifyAuth, async (req, res) => {
  try {
    const userId = req.params.userId;
    const segmentKey =
      typeof req.query.segmentKey === "string" && req.query.segmentKey.trim()
        ? req.query.segmentKey.trim()
        : GLOBAL_RANKING_SEGMENT;

    const cacheKey = getCacheKey([
      "profile",
      "ranking-entry",
      userId,
      segmentKey,
    ]);

    const cached = await getCached(cacheKey);
    if (cached) {
      res.setHeader("X-Cache-Status", "HIT");
      return res.json({ ok: true, entry: cached });
    }

    const entry = await fetchRankingEntry(userId, segmentKey);
    if (entry) {
      await setCached(cacheKey, entry, RANKING_ENTRY_CACHE_TTL_MS);
    }

    res.setHeader("X-Cache-Status", "MISS");
    return res.json({ ok: true, entry });
  } catch (error) {
    res.status(500).json({
      error: error.message ?? "Ranking entry request failed",
    });
  }
});

router.get("/ranking/snapshot-meta", verifyAuth, async (req, res) => {
  try {
    const cacheKey = getCacheKey(["ranking", "snapshot-meta"]);

    const cached = await getCached(cacheKey);
    if (cached) {
      res.setHeader("X-Cache-Status", "HIT");
      return res.json({ ok: true, meta: cached });
    }

    const meta = await fetchRankingSnapshotMeta();
    await setCached(cacheKey, meta, RANKING_SNAPSHOT_META_CACHE_TTL_MS);
    res.setHeader("X-Cache-Status", "MISS");
    return res.json({ ok: true, meta });
  } catch (error) {
    res.status(500).json({
      error: error.message ?? "Ranking snapshot meta request failed",
    });
  }
});

router.get("/profile/:userId/summary", verifyAuth, async (req, res) => {
  try {
    const userId = req.params.userId;
    const limit =
      typeof req.query.postsLimit === "string" ? req.query.postsLimit : "15";
    const cacheKey = getCacheKey([
      "profile",
      "summary",
      req.user.uid,
      userId,
      limit,
    ]);

    const cached = await getCached(cacheKey);
    if (cached) {
      const postsPage = cached.postsPage
        ? await attachEngagementsToFeedPage(req.user.uid, cached.postsPage)
        : cached.postsPage;
      return res.json({ ok: true, ...cached, postsPage });
    }

    const summary = await fetchProfileSummary({
      userId,
      postsLimit: Number(limit) || 15,
    });

    const payloadForCache = {
      ...summary,
      postsPage: summary.postsPage,
    };

    await setCached(cacheKey, payloadForCache, PROFILE_SUMMARY_CACHE_TTL_MS);

    const postsPage = summary.postsPage
      ? await attachEngagementsToFeedPage(req.user.uid, summary.postsPage)
      : summary.postsPage;

    res.json({ ok: true, ...summary, postsPage });
  } catch (error) {
    res.status(500).json({
      error: error.message ?? "Profile summary request failed",
    });
  }
});

router.get("/profile/:userId/gauge-bootstrap", verifyAuth, async (req, res) => {
  try {
    const userId = req.params.userId;
    const cacheKey = getCacheKey([
      "profile",
      "gauge-bootstrap",
      req.user.uid,
      userId,
    ]);

    const cached = await getCached(cacheKey);
    if (cached) {
      return res.json({ ok: true, ...cached });
    }

    const bootstrap = await fetchProfileGaugeBootstrap({ userId });

    await setCached(cacheKey, bootstrap, PROFILE_GAUGE_BOOTSTRAP_CACHE_TTL_MS);

    res.json({ ok: true, ...bootstrap });
  } catch (error) {
    res.status(500).json({
      error: error.message ?? "Profile gauge bootstrap request failed",
    });
  }
});

router.get("/profile/:userId/ladder", verifyAuth, async (req, res) => {
  try {
    const userId = req.params.userId;
    const segmentKey =
      typeof req.query.segmentKey === "string" && req.query.segmentKey.trim()
        ? req.query.segmentKey.trim()
        : GLOBAL_RANKING_SEGMENT;
    const hintRankRaw =
      typeof req.query.hintRank === "string" ? req.query.hintRank : undefined;
    const hintRank =
      hintRankRaw != null && hintRankRaw !== ""
        ? Number(hintRankRaw)
        : null;
    const maxRungsRaw =
      typeof req.query.maxRungs === "string" ? req.query.maxRungs : undefined;
    const maxRungs =
      maxRungsRaw != null && maxRungsRaw !== ""
        ? Number(maxRungsRaw)
        : null;

    const cacheKey = getCacheKey([
      "profile",
      "ladder",
      userId,
      segmentKey,
      hintRank != null && Number.isFinite(hintRank) ? String(hintRank) : "",
      maxRungs != null && Number.isFinite(maxRungs) ? String(maxRungs) : "",
    ]);

    const cached = await getCached(cacheKey);
    if (cached) {
      res.setHeader("X-Cache-Status", "HIT");
      return res.json({ ok: true, ladder: cached });
    }

    const ladder = await fetchRankingLadderFull(
      userId,
      segmentKey,
      Number.isFinite(hintRank) && hintRank > 0 ? hintRank : null,
      Number.isFinite(maxRungs) && maxRungs > 0 ? maxRungs : null
    );

    await setCached(cacheKey, ladder, PROFILE_LADDER_CACHE_TTL_MS);
    res.setHeader("X-Cache-Status", "MISS");
    return res.json({ ok: true, ladder });
  } catch (error) {
    res.status(500).json({
      error: error.message ?? "Profile ladder request failed",
    });
  }
});

module.exports = router;
