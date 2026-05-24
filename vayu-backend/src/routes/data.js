const express = require("express");
const router = express.Router();

router.get("/export.csv", async (req, res) => {
  res.json({ error: "not implemented" });
});

router.get("/stats", async (req, res) => {
  res.json({ total_readings: 0, nodes_online: 0, wards_covered: 0, advisories_sent: 0 });
});

module.exports = router;
