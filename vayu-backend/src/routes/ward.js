const express = require("express");
const router = express.Router();

router.get("/board", async (req, res) => {
  res.json([]);
});

router.get("/:ward_id/summary", async (req, res) => {
  res.json({ error: "not implemented" });
});

router.get("/:ward_id/nodes", async (req, res) => {
  res.json([]);
});

router.get("/:ward_id/governance-pdf", async (req, res) => {
  res.json({ error: "not implemented" });
});

module.exports = router;
