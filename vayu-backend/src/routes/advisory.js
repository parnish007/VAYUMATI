const express = require("express");
const { runMatiAgent }         = require("../agent/mati");
const { push, getLatest, getHistory } = require("../services/advisoryStore");
const { getDemoMembers }       = require("../services/demoMembers");
const { getApproved }          = require("../services/users");
const { sendWhatsAppBulk }     = require("../services/whatsapp");
const { broadcastToClients }   = require("./sse");

const router = express.Router();

// GET /api/advisory/latest?ward_id=11&field_id=A1
router.get("/latest", (req, res) => {
  const { ward_id, field_id } = req.query;
  res.json(getLatest(ward_id, field_id));
});

// GET /api/advisory/history?ward_id=11&limit=20
router.get("/history", (req, res) => {
  const { ward_id, limit = 20 } = req.query;
  res.json(getHistory(ward_id, limit));
});

// POST /api/advisory/trigger
router.post("/trigger", async (req, res) => {
  const { ward_id, field_id, reason, ...extras } = req.body;

  if (!ward_id) {
    return res.status(400).json({ error: "ward_id is required" });
  }

  const triggerContext = {
    ward_id,
    field_id:  field_id || null,
    reason:    reason   || "manual_trigger",
    lat:       extras.lat || parseFloat(process.env.DEFAULT_LAT) || 27.717,
    lng:       extras.lng || parseFloat(process.env.DEFAULT_LNG) || 85.324,
    ...extras,
  };

  try {
    const advisory = await runMatiAgent(triggerContext);
    push(advisory);
    broadcastToClients("advisory_update", advisory);

    // Auto-send WhatsApp when severity >= 3
    if (advisory.severity >= 3) {
      const phones = await collectPhones(ward_id);
      if (phones.length > 0) {
        await sendWhatsAppBulk(phones, advisory.body_ne, advisory.body_en, "urgent");
        console.log(`[ADVISORY] WhatsApp sent to ${phones.length} recipients`);
      }
    }

    res.json(advisory);
  } catch (e) {
    console.error("[ADVISORY] trigger error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

/** Collect all phone numbers for a ward: demo members + approved users with phone. */
async function collectPhones(ward_id) {
  const [demo, users] = await Promise.all([getDemoMembers(ward_id), getApproved(ward_id)]);
  const demoPhones = demo.map((m) => m.phone);
  const userPhones = users.filter((u) => u.phone).map((u) => u.phone);
  return [...new Set([...demoPhones, ...userPhones])];
}

module.exports = router;
