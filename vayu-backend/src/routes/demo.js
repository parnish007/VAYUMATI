/**
 * Demo Tweaker routes — manual sensor injection and member management for demo use.
 *
 * POST /api/demo/inject-air    — push a synthetic air reading through the full pipeline
 * POST /api/demo/inject-soil   — push a synthetic soil reading through the full pipeline
 * POST /api/demo/fire-advisory — force-trigger MATI + WhatsApp for a ward
 * GET  /api/demo/members       — list demo members (optionally filtered by ward_id)
 * POST /api/demo/members       — add a demo member {name, phone, ward_id}
 * DELETE /api/demo/members/:id — remove a demo member
 */

const express = require("express");
const twilio  = require("twilio");
const { handleAirMessage, clearAdvisoryCooldown, _wardState, _config }  = require("../mqtt/handlers/airHandler");
const { handleSoilMessage } = require("../mqtt/handlers/soilHandler");
const { runMatiAgent }      = require("../agent/mati");
const { push: pushAdvisory } = require("../services/advisoryStore");
const { broadcastToClients } = require("./sse");
const { getDemoMembers, addDemoMember, removeDemoMember } = require("../services/demoMembers");
const { getApproved }       = require("../services/users");
const { sendWhatsAppBulk }  = require("../services/whatsapp");

const router = express.Router();

// ─── Member management ────────────────────────────────────────────────────────

// GET /api/demo/members?ward_id=11
router.get("/members", async (req, res) => {
  try {
    const { ward_id } = req.query;
    const members = await getDemoMembers(ward_id || null);
    res.json({ ward_id: ward_id || "all", members, count: members.length });
  } catch (err) {
    console.error("[DEMO] members error:", err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/demo/members
router.post("/members", async (req, res) => {
  try {
    const { name, phone, ward_id } = req.body;
    if (!phone) return res.status(400).json({ error: "phone is required" });

    const normalised = phone.replace(/[\s\-]/g, "");
    const e164 = normalised.startsWith("+") ? normalised : "+" + normalised;

    const member = await addDemoMember({ name, phone: e164, ward_id: ward_id || "11" });
    res.status(201).json(member);
  } catch (err) {
    console.error("[DEMO] add member error:", err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/demo/members/:id
router.delete("/members/:id", async (req, res) => {
  try {
    const ok = await removeDemoMember(req.params.id);
    if (!ok) return res.status(404).json({ error: "Member not found" });
    res.json({ removed: req.params.id });
  } catch (err) {
    console.error("[DEMO] remove member error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Data injection ───────────────────────────────────────────────────────────

/**
 * POST /api/demo/inject-air
 * Body: { ward_id, node_id?, aqi, pm25, pm10?, co2?, no2?, temp?, humidity? }
 *
 * Runs through the exact same pipeline as a live MQTT message:
 *   → writeAirReading (InfluxDB)
 *   → checkAirAnomalies (may trigger MATI + WhatsApp if AQI >= 150)
 *   → SSE broadcast
 */
router.post("/inject-air", async (req, res) => {
  const {
    ward_id  = "11",
    node_id  = "demo-air",
    aqi, pm25, pm10, co2, no2, temp, humidity,
  } = req.body;

  if (aqi == null || pm25 == null)
    return res.status(400).json({ error: "aqi and pm25 are required" });

  const payload = {
    node_id,
    ward_id,
    aqi:      Number(aqi),
    pm25:     Number(pm25),
    pm10:     pm10     != null ? Number(pm10)     : null,
    co2:      co2      != null ? Number(co2)      : null,
    no2:      no2      != null ? Number(no2)      : null,
    temp:     temp     != null ? Number(temp)     : null,
    humidity: humidity != null ? Number(humidity) : null,
    source:   "demo",
    ts:       Math.floor(Date.now() / 1000),
  };

  try {
    await handleAirMessage(`vayu/node/${node_id}/readings`, payload);
    res.json({ ok: true, injected: payload });
  } catch (e) {
    console.error("[DEMO] inject-air error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /api/demo/inject-soil
 * Body: { ward_id, field_id, node_id?, ph, moisture, ec?, soil_temp?, ml_class?, ml_confidence? }
 */
router.post("/inject-soil", async (req, res) => {
  const {
    ward_id  = "11",
    field_id = "A1",
    node_id  = "demo-soil",
    ph, moisture, ec, soil_temp, ml_class, ml_confidence,
  } = req.body;

  if (ph == null || moisture == null)
    return res.status(400).json({ error: "ph and moisture are required" });

  const payload = {
    node_id,
    ward_id,
    field_id,
    ph:            Number(ph),
    moisture:      Number(moisture),
    ec:            ec            != null ? Number(ec)            : null,
    soil_temp:     soil_temp     != null ? Number(soil_temp)     : null,
    ml_class:      ml_class      != null ? Number(ml_class)      : null,
    ml_confidence: ml_confidence != null ? Number(ml_confidence) : null,
    source:        "demo",
    ts:            Math.floor(Date.now() / 1000),
  };

  try {
    await handleSoilMessage(`mitti/node/${node_id}/readings`, payload);
    res.json({ ok: true, injected: payload });
  } catch (e) {
    console.error("[DEMO] inject-soil error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /api/demo/fire-advisory
 * Body: { ward_id, field_id?, reason?, ...snapshot_fields }
 *
 * Force-triggers MATI regardless of AQI/pH thresholds or cooldown.
 * Sends WhatsApp to all demo members + approved users if severity >= 3.
 */
router.post("/fire-advisory", async (req, res) => {
  const { ward_id = "11", field_id, reason = "manual_demo_trigger", ...extras } = req.body;

  const ctx = {
    ward_id,
    field_id: field_id || null,
    reason,
    lat: extras.lat || parseFloat(process.env.DEFAULT_LAT) || 27.717,
    lng: extras.lng || parseFloat(process.env.DEFAULT_LNG) || 85.324,
    ...extras,
  };

  try {
    const advisory = await runMatiAgent(ctx);
    pushAdvisory(advisory);
    broadcastToClients("advisory_update", advisory);

    let whatsappResult = null;
    if (advisory.severity >= 3) {
      const phones = await collectPhones(ward_id);
      if (phones.length > 0) {
        const results = await sendWhatsAppBulk(phones, advisory.body_ne, advisory.body_en, "urgent");
        whatsappResult = { sent: results.length, phones, statuses: results.map((r) => r.delivery_status) };
        console.log(`[DEMO] WhatsApp fired to ${phones.length} recipients`);
      } else {
        whatsappResult = { sent: 0, note: "No registered phones for ward " + ward_id };
      }
    }

    res.json({ advisory, whatsapp: whatsappResult });
  } catch (e) {
    console.error("[DEMO] fire-advisory error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/demo/reset-cooldown?ward_id=11
// Resets the per-ward state machine so the next anomaly fires immediately.
router.post("/reset-cooldown", (req, res) => {
  const ward_id = req.query.ward_id || req.body?.ward_id;
  clearAdvisoryCooldown(ward_id);
  res.json({
    ok: true,
    cleared: ward_id ? `ward ${ward_id}` : "all wards",
  });
});

// GET /api/demo/anomaly-state — inspect the in-memory state machine and config.
router.get("/anomaly-state", (req, res) => {
  const wards = {};
  for (const [k, v] of _wardState.entries()) wards[k] = v;
  res.json({ config: _config, wards });
});

// GET /api/demo/twilio-status?limit=20
// Fetch the most recent Twilio WhatsApp messages and report their actual
// final delivery status — this is how we prove whether messages reached
// recipients or got silently dropped by the sandbox (error 63016 = not opted in).
router.get("/twilio-status", async (req, res) => {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    return res.status(503).json({ error: "Twilio not configured" });
  }
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  try {
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    const msgs = await client.messages.list({ limit });
    const rows = msgs.map((m) => ({
      to:           m.to,
      sid:          m.sid,
      status:       m.status,        // queued|sent|delivered|undelivered|failed|read
      error_code:   m.errorCode,     // 63016 = recipient not opted in
      error_msg:    m.errorMessage,
      date_sent:    m.dateSent,
      date_updated: m.dateUpdated,
      body:         (m.body || "").slice(0, 80),
    }));
    // Aggregate to make the answer immediately readable:
    const byStatus = rows.reduce((acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    }, {});
    res.json({
      count:     rows.length,
      summary:   byStatus,
      messages:  rows,
      hint:      "If `undelivered` with error_code 63016, the recipient is not in your Twilio sandbox allowlist. They must WhatsApp `join <keyword>` to +14155238886 first.",
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

async function collectPhones(ward_id) {
  const [demoMembers, approvedUsers] = await Promise.all([
    getDemoMembers(ward_id),
    getApproved(ward_id),
  ]);
  const phones = [
    ...demoMembers.map((m) => m.phone),
    ...approvedUsers.filter((u) => u.phone).map((u) => u.phone),
  ].filter(Boolean);
  return [...new Set(phones)];
}

module.exports = router;
