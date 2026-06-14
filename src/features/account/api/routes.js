const express = require("express");
const { verifyAuth } = require("../../../lib/verifyAuth");
const { deleteAccount } = require("../deleteAccount");

const router = express.Router();

router.delete("/account", verifyAuth, async (req, res) => {
  try {
    const result = await deleteAccount(req.user.uid);
    res.json(result);
  } catch (error) {
    console.error("[DELETE /api/account]", error);
    res.status(500).json({
      error: error.message ?? "Hesap silinemedi",
    });
  }
});

module.exports = router;
