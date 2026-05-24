const { writeSoilReading }            = require("../../influx/client");
const { registerNode, updateNodeSeen } = require("../../services/healthCheck");
const { broadcastToClients }          = require("../../routes/sse");
const { runMatiAgent }                = require("../../agent/mati");
const { push: pushAdvisory }          = require("../../services/advisoryStore");
const { getDemoMembers }              = require("../../services/demoMembers");
const { getApproved }                 = require("../../services/users");
const { sendWhatsAppBulk }            = require("../../services/whatsapp");

function validateSoilPayload(p) {
  return (
    p &&
    typeof p.node_id  === "string" &&
    typeof p.ward_id  === "string" &&
    typeof p.field_id === "string" &&
    typeof p.ph       === "number" && p.ph >= 0 && p.ph <= 14 &&
    typeof p.moisture === "number" && p.moisture >= 0 && p.moisture <= 100
  );
}

async function handleSoilMessage(topic, payload) {
  if (!validateSoilPayload(payload)) {
    console.error("[SOIL] invalid payload on topic:", topic, payload);
    return;
  }

  const { node_id, ward_id, field_id, moisture, ph, ec, soil_temp, ml_class, ml_confidence, source, rssi } = payload;

  registerNode(node_id, "soil", ward_id, field_id);
  updateNodeSeen(node_id, { rssi });

  try {
    await writeSoilReading(payload);
  } catch (e) {
    console.error("[SOIL] InfluxDB write failed:", e.message);
  }

  checkSoilAnomalies(payload).catch((e) =>
    console.error("[SOIL] anomaly check error:", e.message)
  );

  broadcastToClients("soil_update", {
    node_id, ward_id, field_id, ph, moisture, ec,
    soil_temp, ml_class, ml_confidence,
    source: source || "live",
    ts: payload.ts || Math.floor(Date.now() / 1000),
  });

  console.log(`[SOIL] ${node_id} field=${field_id} pH=${ph} moisture=${moisture}%`);
}

// ─── Anomaly thresholds ────────────────────────────────────────────────────────
const ANOMALY_PH_LOW   = 5.5;   // Acidic — crop damage risk, acid deposition signature
const ANOMALY_PH_HIGH  = 8.0;   // Alkaline — nutrient lockout
const ANOMALY_ML_CLASS = 2;     // TinyML: critical soil condition

// Cooldown: 10 minutes per field
const ADVISORY_COOLDOWN_MS = 10 * 60 * 1000;
const lastAdvisoryFired = new Map(); // field_id → timestamp
const STARTUP_TIME = Date.now();

async function checkSoilAnomalies(p) {
  const phLowAnomaly  = p.ph < ANOMALY_PH_LOW;
  const phHighAnomaly = p.ph > ANOMALY_PH_HIGH;
  const mlAnomaly     = p.ml_class === ANOMALY_ML_CLASS;

  if (!phLowAnomaly && !phHighAnomaly && !mlAnomaly) return;

  if (Date.now() - STARTUP_TIME < 90_000) {
    console.log("[SOIL] startup grace: anomaly suppressed for 90s after boot");
    return;
  }

  const now  = Date.now();
  const last = lastAdvisoryFired.get(p.field_id) || 0;
  const remaining = ADVISORY_COOLDOWN_MS - (now - last);

  if (remaining > 0) {
    console.log(
      `[SOIL] anomaly on ${p.node_id} (pH=${p.ph}) — advisory cooldown ${Math.round(remaining / 1000)}s remaining`
    );
    return;
  }

  lastAdvisoryFired.set(p.field_id, now);

  let reason;
  if (phLowAnomaly)  reason = `low_soil_ph (pH ${p.ph} on field ${p.field_id} — acid deposition risk)`;
  else if (phHighAnomaly) reason = `high_soil_ph (pH ${p.ph} on field ${p.field_id} — alkaline anomaly)`;
  else reason = `ml_critical_class (TinyML class ${p.ml_class} on field ${p.field_id})`;

  console.log(`[SOIL] firing MATI advisory: ${reason}`);

  const advisory = await runMatiAgent({
    ward_id:    p.ward_id,
    field_id:   p.field_id,
    reason,
    ph:         p.ph,
    moisture:   p.moisture,
    ec:         p.ec   ?? null,
    ml_class:   p.ml_class ?? null,
    lat:        parseFloat(process.env.DEFAULT_LAT) || 27.717,
    lng:        parseFloat(process.env.DEFAULT_LNG) || 85.324,
  });

  pushAdvisory(advisory);
  broadcastToClients("advisory_update", advisory);

  if (advisory.severity >= 3) {
    await dispatchWhatsApp(p.ward_id, advisory);
  }
}

async function dispatchWhatsApp(ward_id, advisory) {
  const [demo, users] = await Promise.all([getDemoMembers(ward_id), getApproved(ward_id)]);
  const demoPhones = demo.map((m) => m.phone);
  const userPhones = users.filter((u) => u.phone).map((u) => u.phone);
  const phones     = [...new Set([...demoPhones, ...userPhones])];

  if (phones.length === 0) {
    console.log("[SOIL] advisory severity >= 3 but no registered phones for ward", ward_id);
    return;
  }

  const results = await sendWhatsAppBulk(phones, advisory.body_ne, advisory.body_en, "urgent");
  console.log(`[SOIL] WhatsApp dispatched to ${phones.length} recipients:`, results.map((r) => r.delivery_status));
}

module.exports = { handleSoilMessage };
