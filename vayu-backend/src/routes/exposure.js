const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { getScore, addAction } = require("../services/paScores");
const { broadcastToClients } = require("./sse");
const { getMeanPm25, getLatestAir } = require("../influx/queries");

const router = express.Router();

// Breathing volume: ~15 L/min × 16h active + ~6 L/min × 8h rest = ~17.3 m³/day.
// Use 14.4 m³/day (16h active only) — conservative, matches WHO exposure assessment.
const BREATH_M3_PER_DAY = 14.4;
// WHO 24h PM2.5 guideline (2021): 15 μg/m³.
const WHO_PM25_24H_UG_M3 = 15;
const WHO_WEEKLY_LIMIT_UG = WHO_PM25_24H_UG_M3 * BREATH_M3_PER_DAY * 7; // 1512

// GET /api/exposure/weekly-dose?ward_id=11
// Returns accumulated PM2.5 inhaled dose over the last 7 days for a ward,
// based on the mean PM2.5 from InfluxDB. Falls back to the latest reading
// if no 7-day history exists yet (fresh InfluxDB bucket).
router.get("/weekly-dose", async (req, res) => {
  const wardId = req.query.ward_id || process.env.DEFAULT_WARD_ID || "11";
  try {
    const rows = await getMeanPm25(wardId, 168);
    let meanPm25 = rows.length && rows[0]._value != null ? Number(rows[0]._value) : null;

    // Fresh bucket fallback — no 7d data yet, use latest reading instead.
    if (meanPm25 == null) {
      const latest = await getLatestAir(wardId);
      meanPm25 = latest.length && latest[0].pm25 != null ? Number(latest[0].pm25) : 0;
    }

    const dailyDoseUg  = meanPm25 * BREATH_M3_PER_DAY;
    const weeklyDoseUg = dailyDoseUg * 7;
    const pct          = Math.min((weeklyDoseUg / WHO_WEEKLY_LIMIT_UG) * 100, 999);

    res.json({
      ward_id: wardId,
      mean_pm25_7d_ug_m3:    Number(meanPm25.toFixed(2)),
      daily_dose_ug:         Number(dailyDoseUg.toFixed(1)),
      weekly_dose_ug:        Number(weeklyDoseUg.toFixed(1)),
      who_weekly_limit_ug:   WHO_WEEKLY_LIMIT_UG,
      pct_of_who_limit:      Number(pct.toFixed(1)),
      breath_m3_per_day:     BREATH_M3_PER_DAY,
      who_pm25_24h_ug_m3:    WHO_PM25_24H_UG_M3,
    });
  } catch (err) {
    console.error("[EXPOSURE] weekly-dose error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/exposure/score
// Returns the authenticated user's current PA score, breakdown, and badges.
router.get("/score", requireAuth, (req, res) => {
  try {
    const { id, role } = req.user;
    const score = getScore(id, role);
    res.json(score);
  } catch (err) {
    console.error("[EXPOSURE] score error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/exposure/action
// Records a PA action for the authenticated user.
// Body: { action: "report_submitted" | "child_indoors" | "alt_route" | "soil_compliance" }
router.post("/action", requireAuth, (req, res) => {
  try {
    const { id, role } = req.user;
    const { action } = req.body;
    const VALID = ["report_submitted", "child_indoors", "alt_route", "soil_compliance"];
    if (!VALID.includes(action)) {
      return res.status(400).json({ error: `Invalid action. Valid: ${VALID.join(", ")}` });
    }
    const result = addAction(id, action, role);
    broadcastToClients("score_update", { user_id: id, ...result });
    if (result.newBadges?.length > 0) {
      result.newBadges.forEach((badge) => {
        broadcastToClients("badge_unlocked", { user_id: id, badge });
      });
    }
    res.json(result);
  } catch (err) {
    console.error("[EXPOSURE] action error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Legacy stubs kept for backwards compatibility
router.get("/:user_id/today",   async (req, res) => res.json({ error: "use /api/exposure/score" }));
router.post("/log",             async (req, res) => res.json({ error: "use /api/exposure/action" }));
router.get("/:user_id/history", async (req, res) => res.json([]));

module.exports = router;
