const express = require("express");
const { verifyAuth } = require("../../../lib/verifyAuth");
const { searchUsers } = require("../searchUsers");

const router = express.Router();

router.get("/search/users", verifyAuth, async (req, res) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q : "";
    const result = await searchUsers(q, {
      limit: req.query.limit,
      viewerId: req.user.uid,
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message ?? "Arama yapılamadı",
    });
  }
});

module.exports = router;
