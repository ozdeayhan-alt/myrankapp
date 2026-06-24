const express = require("express");
const { verifyAuth } = require("../../../lib/verifyAuth");
const {
  getFollowStatus,
  followUser,
  unfollowUser,
  getFollowCounts,
  listFollowing,
  listFollowers,
} = require("../followService");
const { mapFollowError } = require("../followErrors");
const { invalidateFollowingAuthors } = require("../../feed/feedCache");

const router = express.Router();

router.get("/follows/me/counts", verifyAuth, async (req, res) => {
  try {
    const result = await getFollowCounts(req.user.uid);
    res.json(result);
  } catch (error) {
    mapFollowError(error, res);
  }
});

router.get("/follows/me/following", verifyAuth, async (req, res) => {
  try {
    const result = await listFollowing(req.user.uid, {
      cursor: req.query.cursor ?? null,
      limit: req.query.limit,
    });
    res.json(result);
  } catch (error) {
    mapFollowError(error, res);
  }
});

router.get("/follows/me/followers", verifyAuth, async (req, res) => {
  try {
    const result = await listFollowers(req.user.uid, {
      cursor: req.query.cursor ?? null,
      limit: req.query.limit,
    });
    res.json(result);
  } catch (error) {
    mapFollowError(error, res);
  }
});

router.get("/follows/:targetUserId/status", verifyAuth, async (req, res) => {
  try {
    const result = await getFollowStatus(req.user.uid, req.params.targetUserId);
    res.json(result);
  } catch (error) {
    mapFollowError(error, res);
  }
});

router.post("/follows/:targetUserId", verifyAuth, async (req, res) => {
  try {
    const result = await followUser(req.user.uid, req.params.targetUserId);
    await invalidateFollowingAuthors(req.user.uid);
    res.json(result);
  } catch (error) {
    mapFollowError(error, res);
  }
});

router.delete("/follows/:targetUserId", verifyAuth, async (req, res) => {
  try {
    const result = await unfollowUser(req.user.uid, req.params.targetUserId);
    await invalidateFollowingAuthors(req.user.uid);
    res.json(result);
  } catch (error) {
    mapFollowError(error, res);
  }
});

module.exports = router;
