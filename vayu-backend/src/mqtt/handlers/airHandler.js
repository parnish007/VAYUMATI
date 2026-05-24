const { writeAirReading }              = require("../../influx/client");
const { registerNode, updateNodeSeen } = require("../../services/healthCheck");
const { broadcastToClients }           = require("../../routes/sse");
const { runMatiAgent }                 = require("../../agent/mati");
const { push: pushAdvisory }           = require("../../services/advisoryStore");
const { getDemoMembers }               = require("../../services/demoMembers");
const { getApproved }                  = require("../../services/users");
const { sendWhatsAppBulk, verifyDeliveryStatus } = require("../../services/whatsapp");

// ═══════════════════════════════════════════════════════════════════════════
//  Anomaly Decision Engine — Design
// ═══════════════════════════════════════════════════════════════════════════
//
//  Sensor sends one reading every 5 seconds. We see ~17,280 readings per day.
//  We must NOT send a WhatsApp for every reading. The decision logic:
//
//  PER WARD: a state machine ── NORMAL ←→ SPIKED ──
//
//  Inputs to the decision:
//    aqiSmooth  = median of last SMOOTHING_WINDOW readings (rejects single-sample noise)
//    sinceLast  = ms since this ward last fired a WhatsApp
//
//  Decision rules:
//    1. NORMAL → SPIKED        when aqiSmooth ≥ AQI_HIGH          (transition fires alert)
//    2. SPIKED → NORMAL        when aqiSmooth <  AQI_LOW           (hysteresis prevents flap)
//    3. SPIKED stays SPIKED    when AQI_LOW ≤ aqiSmooth < AQI_HIGH (no flap, no fire)
//    4. While SPIKED:
//         - First entry to SPIKED  → fire (subject to MIN_INTERVAL hard floor)
//         - Sustained SPIKED       → repeat fire every REPEAT_INTERVAL (default 2h)
//         - In between repeats     → SKIP, log skip reason occasionally
//
//  Why a hard MIN_INTERVAL on top of REPEAT_INTERVAL?
//    If AQI bounces NORMAL→SPIKED→NORMAL→SPIKED rapidly (e.g. user does two
//    burn tests 10 seconds apart), the state transitions reset fireCount and
//    each would otherwise be a "first fire". MIN_INTERVAL is a global floor.
//
//  NO2 trigger is DISABLED by default — MQ135 NO2 reading is unreliable
//  (the sensor is NH3/VOC selective, not NO2). Re-enable with ENABLE_NO2_TRIGGER=true.
//
//  All thresholds tunable via .env without code changes:
//    ANOMALY_AQI_HIGH                (default 150)
//    ANOMALY_AQI_LOW                 (default 100)
//    ENABLE_NO2_TRIGGER              (default false)
//    ANOMALY_NO2_HIGH                (default 0.2)
//    ADVISORY_REPEAT_INTERVAL_MS     (default 7200000 = 2 hours)
//    ADVISORY_MIN_INTERVAL_MS        (default 60000 = 1 minute)
//    ADVISORY_STARTUP_GRACE_MS       (default 10000 = 10 sec)
//    AQI_SMOOTHING_WINDOW            (default 3)
// ═══════════════════════════════════════════════════════════════════════════

const CFG = {
  AQI_HIGH:          Number(process.env.ANOMALY_AQI_HIGH)           || 150,
  AQI_LOW:           Number(process.env.ANOMALY_AQI_LOW)            || 100,
  ENABLE_NO2:        process.env.ENABLE_NO2_TRIGGER === "true",
  NO2_HIGH:          Number(process.env.ANOMALY_NO2_HIGH)           || 0.2,
  REPEAT_INTERVAL:   Number(process.env.ADVISORY_REPEAT_INTERVAL_MS)|| 2 * 60 * 60 * 1000, // 2h
  MIN_INTERVAL:      Number(process.env.ADVISORY_MIN_INTERVAL_MS)   || 60 * 1000,           // 1min
  STARTUP_GRACE:     Number(process.env.ADVISORY_STARTUP_GRACE_MS)  || 10 * 1000,           // 10s
  SMOOTHING_WINDOW:  Number(process.env.AQI_SMOOTHING_WINDOW)       || 3,
};

// Log the active config once at module load so the operator can see what's live
console.log("[AIR] anomaly engine config:", {
  AQI_HIGH: CFG.AQI_HIGH,
  AQI_LOW:  CFG.AQI_LOW,
  REPEAT_MIN: Math.round(CFG.REPEAT_INTERVAL / 60000) + "min",
  MIN_INTERVAL_S: Math.round(CFG.MIN_INTERVAL / 1000) + "s",
  STARTUP_GRACE_S: Math.round(CFG.STARTUP_GRACE / 1000) + "s",
  NO2_TRIGGER: CFG.ENABLE_NO2,
});

const STARTUP_TIME = Date.now();

// ─── Per-ward state machine ───────────────────────────────────────────────────
//
//   state:        'normal' | 'spiked'
//   lastFiredAt:  ms timestamp of last advisory dispatch
//   recentAqi:    rolling window for smoothing (median filter)
//   fireCount:    advisories fired since this spike began
//
const wardState = new Map();

function getOrInitWard(ward_id) {
  let s = wardState.get(ward_id);
  if (!s) {
    s = {
      state:             "normal",
      lastFiredAt:       0,
      lastSkipLoggedAt:  0,
      recentAqi:         [],
      fireCount:         0,
    };
    wardState.set(ward_id, s);
  }
  return s;
}

// Median-of-N filter to suppress single-sample noise spikes/drops.
function smoothedAqi(state, aqi) {
  state.recentAqi.push(aqi);
  if (state.recentAqi.length > CFG.SMOOTHING_WINDOW) state.recentAqi.shift();
  const sorted = [...state.recentAqi].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

// Test/admin helper — resets per-ward state so next anomaly fires immediately.
function clearAdvisoryCooldown(ward_id) {
  if (ward_id) wardState.delete(ward_id);
  else wardState.clear();
}

// ═══════════════════════════════════════════════════════════════════════════
//  MQTT message handler
// ═══════════════════════════════════════════════════════════════════════════

function validateAirPayload(p) {
  return (
    p &&
    typeof p.node_id === "string" &&
    typeof p.ward_id === "string" &&
    typeof p.pm25    === "number" && p.pm25 >= 0 && p.pm25 <= 1000 &&
    typeof p.aqi     === "number" && p.aqi  >= 0 && p.aqi  <= 500
  );
}

async function handleAirMessage(topic, payload) {
  if (!validateAirPayload(payload)) {
    console.error("[AIR] invalid payload on topic:", topic, payload);
    return;
  }

  const { node_id, ward_id, pm25, pm10, co2, no2, temp, humidity, aqi, source, rssi } = payload;

  registerNode(node_id, "air", ward_id, null);
  updateNodeSeen(node_id, { rssi });

  try {
    await writeAirReading(payload);
  } catch (e) {
    console.error("[AIR] InfluxDB write failed:", e.message);
  }

  checkAirAnomalies(payload).catch((e) =>
    console.error("[AIR] anomaly check error:", e.message)
  );

  broadcastToClients("air_update", {
    node_id, ward_id, aqi, pm25, pm10, co2, no2,
    temp, humidity, source: source || "live",
    ts: payload.ts || Math.floor(Date.now() / 1000),
  });

  console.log(`[AIR] ${node_id} ward=${ward_id} AQI=${aqi} PM2.5=${pm25}`);
}

// ═══════════════════════════════════════════════════════════════════════════
//  Anomaly detection — runs on every MQTT reading (every 5s)
// ═══════════════════════════════════════════════════════════════════════════

async function checkAirAnomalies(p) {
  const now = Date.now();
  const ws  = getOrInitWard(p.ward_id);

  // Always populate the smoothing window — even during startup grace — so the
  // window is full and reliable as soon as the grace period ends. Otherwise
  // the first post-grace reading would have a 1-sample window and could
  // false-fire on a single noise spike.
  const aqiSmooth = smoothedAqi(ws, p.aqi);

  if (now - STARTUP_TIME < CFG.STARTUP_GRACE) {
    return; // silent during startup grace, but window kept warm above
  }

  const aboveHigh = aqiSmooth >= CFG.AQI_HIGH;
  const belowLow  = aqiSmooth <  CFG.AQI_LOW;
  const no2High   = CFG.ENABLE_NO2 && p.no2 != null && p.no2 >= CFG.NO2_HIGH;

  // ─── 1. State transitions ───────────────────────────────────────────────────
  if (ws.state === "normal" && (aboveHigh || no2High)) {
    ws.state     = "spiked";
    ws.fireCount = 0;
    console.log(`[AIR] ward=${p.ward_id} → SPIKED  (AQI smoothed=${aqiSmooth}, raw=${p.aqi}, threshold=${CFG.AQI_HIGH})`);
  } else if (ws.state === "spiked" && belowLow && !no2High) {
    ws.state           = "normal";
    ws.fireCount       = 0;
    ws.lastSkipLoggedAt = 0;
    console.log(`[AIR] ward=${p.ward_id} → NORMAL  (AQI smoothed=${aqiSmooth} < ${CFG.AQI_LOW})`);
    return;
  }

  if (ws.state !== "spiked") return;

  // ─── 2. Should we fire now? ──────────────────────────────────────────────────
  const sinceLast    = now - ws.lastFiredAt;
  const isFirstFire  = ws.fireCount === 0;
  const repeatDue    = sinceLast >= CFG.REPEAT_INTERVAL;
  const hardFloor    = sinceLast >= CFG.MIN_INTERVAL;

  // Log skip reason at most once per 60s so the operator can see WHY we're not firing,
  // without spamming a log line every 5 seconds.
  function logSkip(reason) {
    if (now - (ws.lastSkipLoggedAt || 0) >= 60_000) {
      console.log(`[AIR] ward=${p.ward_id} SPIKED but skip: ${reason}  (AQI=${p.aqi}, smoothed=${aqiSmooth})`);
      ws.lastSkipLoggedAt = now;
    }
  }

  if (!hardFloor) {
    logSkip(`min-interval not met (${Math.round((CFG.MIN_INTERVAL - sinceLast) / 1000)}s left)`);
    return;
  }
  if (!isFirstFire && !repeatDue) {
    const minLeft = Math.round((CFG.REPEAT_INTERVAL - sinceLast) / 60_000);
    logSkip(`already fired #${ws.fireCount}, repeat in ${minLeft}min`);
    return;
  }

  ws.lastFiredAt = now;
  ws.fireCount++;

  const triggerKind = no2High && !aboveHigh ? "high_no2_sensor" : "high_aqi_sensor";
  const reason = triggerKind === "high_no2_sensor"
    ? `high_no2_sensor (NO2 ${p.no2} ppm on node ${p.node_id})`
    : `high_aqi_sensor (AQI ${p.aqi} smoothed=${aqiSmooth} on node ${p.node_id})`;

  const fireLabel = isFirstFire ? "FIRST fire (state→SPIKED)" : `REPEAT fire #${ws.fireCount} (sustained)`;
  console.log(`[AIR] firing MATI advisory [${fireLabel}]: ${reason}`);

  let advisory;
  try {
    advisory = await runMatiAgent({
      ward_id:    p.ward_id,
      reason,
      aqi:        p.aqi,
      pm25:       p.pm25,
      no2:        p.no2,
      lat:        parseFloat(process.env.DEFAULT_LAT) || 27.717,
      lng:        parseFloat(process.env.DEFAULT_LNG) || 85.324,
      node_count_context: `Triggered by single node ${p.node_id}. Cross-check with other ward nodes if available.`,
    });
  } catch (e) {
    console.error("[AIR] MATI agent failed:", e.message);
    return;
  }

  pushAdvisory(advisory);
  broadcastToClients("advisory_update", advisory);

  if (advisory.severity >= 3) {
    await dispatchWhatsApp(p.ward_id, advisory);
  } else {
    console.log(`[AIR] advisory severity=${advisory.severity} < 3 — WhatsApp skipped`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  WhatsApp dispatch — sends and verifies actual delivery (not just "queued")
// ═══════════════════════════════════════════════════════════════════════════

async function dispatchWhatsApp(ward_id, advisory) {
  const [demo, users] = await Promise.all([getDemoMembers(ward_id), getApproved(ward_id)]);
  const demoPhones = demo.map((m) => m.phone);
  const userPhones = users.filter((u) => u.phone).map((u) => u.phone);
  const phones     = [...new Set([...demoPhones, ...userPhones])].filter(Boolean);

  if (phones.length === 0) {
    console.log("[AIR] advisory severity ≥ 3 but no registered phones for ward", ward_id);
    return;
  }

  const results = await sendWhatsAppBulk(phones, advisory.body_ne, advisory.body_en, "urgent");
  const summary = results.map((r) => `${r.to.slice(-4)}=${r.delivery_status}`).join(", ");
  console.log(`[AIR] WhatsApp dispatched to ${phones.length} recipients: ${summary}`);

  // Verify real delivery status 8s later — Twilio "queued" doesn't mean delivered,
  // especially for sandbox where un-opted-in numbers are silently dropped.
  setTimeout(() => {
    verifyDeliveryStatus(results)
      .then((verified) => {
        const dropped = verified.filter((v) => v.final_status === "undelivered" || v.final_status === "failed");
        if (dropped.length > 0) {
          console.warn(
            `[AIR] ⚠ Twilio dropped ${dropped.length}/${results.length} messages — likely not opted into sandbox:`,
            dropped.map((d) => `${d.to.slice(-4)}=${d.final_status}${d.error_code ? `/${d.error_code}` : ""}`).join(", ")
          );
        } else {
          const ok = verified.filter((v) => ["delivered", "sent", "read"].includes(v.final_status));
          console.log(`[AIR] ✓ Twilio confirmed ${ok.length}/${results.length} delivered`);
        }
      })
      .catch((e) => console.warn("[AIR] delivery status check failed:", e.message));
  }, 8_000);
}

module.exports = {
  handleAirMessage,
  clearAdvisoryCooldown,
  // Exposed for /api/demo/state debugging:
  _wardState: wardState,
  _config: CFG,
};
