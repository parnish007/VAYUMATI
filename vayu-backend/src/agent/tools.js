const axios    = require("axios");
const { getLatestAir, getLatestSoil } = require("../influx/queries");
const { nodeRegistry }                = require("../services/healthCheck");
const { sendWhatsAppBulk }            = require("../services/whatsapp");
const { getDemoMembers }              = require("../services/demoMembers");
const { getApproved }                 = require("../services/users");
const { detectMask }                  = require("../services/maskDetection");

// ─── Tool schemas ─────────────────────────────────────────────────────────────

const tools = [
  {
    name: "get_air_quality",
    description:
      "Get current air quality for a ward. Aggregates all active sensor nodes in the ward. " +
      "Returns AQI, PM2.5, PM10, NO2, CO2, temperature, humidity, node_count, spatial_variation, " +
      "and a confidence_modifier (0.0–1.0 — higher with more nodes). " +
      "When node_count == 1, treat results with more caution (single sensor). " +
      "When high_variation is true, pollution is unevenly distributed across the ward.",
    input_schema: {
      type: "object",
      properties: {
        ward_id: { type: "string", description: "Ward identifier, e.g. '11'" },
      },
      required: ["ward_id"],
    },
  },
  {
    name: "get_soil_health",
    description:
      "Get current soil health for a field. Returns pH, moisture, EC (or 'unavailable' in fallback), " +
      "soil temperature, TinyML class and confidence. " +
      "pH is always a number. When EC is 'unavailable', omit it from advisory text.",
    input_schema: {
      type: "object",
      properties: {
        field_id: { type: "string", description: "Field identifier, e.g. 'A1'" },
      },
      required: ["field_id"],
    },
  },
  {
    name: "get_weather_forecast",
    description:
      "Get 24-hour weather forecast from Open-Meteo. Returns wind speed, wind direction, " +
      "and precipitation probability for the next 4 hours. Use to assess pollution dispersion.",
    input_schema: {
      type: "object",
      properties: {
        lat: { type: "number" },
        lng: { type: "number" },
      },
      required: ["lat", "lng"],
    },
  },
  {
    name: "get_ward_members",
    description:
      "Get the phone numbers of registered ward members who should receive WhatsApp advisories. " +
      "Returns an array of E.164 phone numbers. Always call this before send_whatsapp " +
      "to get the correct recipient list — never invent phone numbers.",
    input_schema: {
      type: "object",
      properties: {
        ward_id: { type: "string", description: "Ward identifier, e.g. '11'" },
      },
      required: ["ward_id"],
    },
  },
  {
    name: "send_whatsapp",
    description:
      "Send a WhatsApp advisory to one or more registered users. " +
      "message_ne must be under 900 characters. Nepali script is preferred. " +
      "Only call this when severity >= 3. Call get_ward_members first to get recipients.",
    input_schema: {
      type: "object",
      properties: {
        recipients: {
          type: "array",
          items: { type: "string" },
          description: "E.164 phone numbers from get_ward_members",
        },
        message_en: { type: "string" },
        message_ne: { type: "string", description: "Nepali advisory, under 900 chars" },
        priority:   { type: "string", enum: ["normal", "urgent"] },
      },
      required: ["recipients", "message_ne"],
    },
  },
  {
    name: "validate_mask_selfie",
    description:
      "Check whether an uploaded image shows a person wearing a face mask. " +
      "Returns mask_detected (boolean) and confidence (0.0–1.0).",
    input_schema: {
      type: "object",
      properties: {
        image_base64: { type: "string" },
        media_type:   { type: "string", enum: ["image/jpeg", "image/png", "image/webp"] },
      },
      required: ["image_base64", "media_type"],
    },
  },
];

// ─── Dispatch ─────────────────────────────────────────────────────────────────

async function dispatchTool(name, input) {
  switch (name) {
    case "get_air_quality":      return fetchAirForAgent(input.ward_id);
    case "get_soil_health":      return fetchSoilForAgent(input.field_id);
    case "get_weather_forecast": return fetchWeatherForAgent(input.lat, input.lng);
    case "get_ward_members":     return fetchWardMembers(input.ward_id);
    case "send_whatsapp":        return sendWhatsAppFromAgent(input);
    case "validate_mask_selfie": return validateMaskVision(input);
    default: return { error: `Unknown tool: ${name}` };
  }
}

// ─── Implementations ──────────────────────────────────────────────────────────

/**
 * Aggregate air quality across ALL nodes in a ward.
 * Returns node_count, spatial_variation, and confidence_modifier so MATI can
 * reason about how reliable the reading is and whether pollution is localised.
 */
async function fetchAirForAgent(ward_id) {
  // Build map of node_id → latest reading from nodeRegistry (fast, in-memory)
  const byNode = new Map();

  for (const [id, node] of nodeRegistry.entries()) {
    if (node.type === "air" && node.ward_id === ward_id && node.latestReading) {
      byNode.set(id, {
        ...node.latestReading,
        node_id: id,
        source:  node.status === "live" ? "live" : (node.fallbackSource || "fallback"),
      });
    }
  }

  // Also try InfluxDB for nodes not in registry (e.g. restarted backend)
  try {
    const rows = await getLatestAir(ward_id);
    if (rows && rows.length > 0) {
      for (const r of rows) {
        const nid = r.node_id || r._measurement || "unknown";
        if (!byNode.has(nid)) {
          byNode.set(nid, { ...r, node_id: nid, source: r.source || "db" });
        }
      }
    }
  } catch (e) {
    console.error("[TOOLS] get_air_quality InfluxDB error:", e.message);
  }

  const nodes = [...byNode.values()];

  if (nodes.length === 0) {
    return {
      error: `No air data available for ward ${ward_id}. ` +
             `Nodes may not be connected or InfluxDB may be empty.`,
    };
  }

  if (nodes.length === 1) {
    const r = nodes[0];
    return {
      ward_id,
      aqi:      r.aqi      ?? null,
      pm25:     r.pm25     ?? null,
      pm10:     r.pm10     ?? null,
      co2:      r.co2      ?? null,
      no2:      r.no2      ?? null,
      temp:     r.temperature ?? r.temp ?? null,
      humidity: r.humidity ?? null,
      source:   r.source   || "live",
      ts:       r._time    || new Date().toISOString(),
      // Multi-node metadata
      node_count:           1,
      node_ids:             [r.node_id],
      spatial_coverage:     "single_point",
      single_node_warning:  true,
      confidence_modifier:  0.70,
      multi_node_note:      "Single sensor node — reading is from one location only. Cross-check with fallback API if available.",
    };
  }

  // Multiple nodes — aggregate
  const numericAvg = (key) => {
    const vals = nodes.map((n) => n[key] ?? n[key.replace("temp", "temperature")] ?? null).filter((v) => v != null);
    return vals.length > 0 ? Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 10) / 10 : null;
  };

  const aqiValues  = nodes.map((n) => n.aqi).filter((v) => v != null);
  const avgAqi     = Math.round(aqiValues.reduce((s, v) => s + v, 0) / aqiValues.length);
  const maxAqi     = Math.max(...aqiValues);
  const minAqi     = Math.min(...aqiValues);
  const variation  = maxAqi - minAqi;
  const highVar    = variation > 40;

  return {
    ward_id,
    aqi:      avgAqi,
    pm25:     numericAvg("pm25"),
    pm10:     numericAvg("pm10"),
    co2:      numericAvg("co2"),
    no2:      numericAvg("no2"),
    temp:     numericAvg("temp"),
    humidity: numericAvg("humidity"),
    source:   nodes.every((n) => n.source === "live") ? "live" : "mixed",
    ts:       new Date().toISOString(),
    // Multi-node metadata
    node_count:          nodes.length,
    node_ids:            nodes.map((n) => n.node_id),
    aqi_range:           { min: minAqi, max: maxAqi },
    spatial_variation:   variation,
    high_variation:      highVar,
    confidence_modifier: Math.min(0.95, 0.70 + nodes.length * 0.12),
    multi_node_note:     highVar
      ? `AQI varies ${variation} units across ${nodes.length} nodes (${minAqi}–${maxAqi}). Pollution is not uniform — conditions worse in some parts of the ward.`
      : `${nodes.length} nodes reporting. Ward-wide AQI is consistently around ${avgAqi}.`,
  };
}

async function fetchSoilForAgent(field_id) {
  try {
    const rows = await getLatestSoil(field_id);
    if (rows && rows.length > 0) {
      const r = rows[0];
      return {
        field_id,
        ph:            r.ph            ?? null,
        moisture:      r.moisture      ?? null,
        ec:            r.ec != null    ? r.ec : "unavailable",
        soil_temp:     r.soil_temp     ?? null,
        ml_class:      r.ml_class      ?? null,
        ml_confidence: r.ml_confidence ?? null,
        source:        r.source        || "live",
        ts:            r._time         || new Date().toISOString(),
      };
    }
  } catch (e) {
    console.error("[TOOLS] get_soil_health InfluxDB error:", e.message);
  }

  for (const [, node] of nodeRegistry.entries()) {
    if (node.type === "soil" && node.field_id === field_id && node.latestReading) {
      const r = node.latestReading;
      return {
        ...r,
        ec:     r.ec != null ? r.ec : "unavailable",
        ml_class: r.ml_class ?? null,
        source: node.status === "live" ? "live" : node.fallbackSource,
      };
    }
  }

  return {
    error: `No soil data for field ${field_id}. InfluxDB may be empty or Node B not connected.`,
  };
}

async function fetchWeatherForAgent(lat, lng) {
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lat}&longitude=${lng}` +
    `&hourly=wind_speed_10m,wind_direction_10m,precipitation_probability` +
    `&timezone=auto&forecast_days=1`;

  try {
    const response = await axios.get(url, { timeout: 8000 });
    const hourly   = response.data?.hourly;
    if (!hourly) return { error: "Weather data unavailable" };

    const hours = [0, 1, 2, 3].map((i) => ({
      hour:       i,
      wind_speed: hourly.wind_speed_10m?.[i]           ?? null,
      wind_dir:   hourly.wind_direction_10m?.[i]        ?? null,
      precip_pct: hourly.precipitation_probability?.[i] ?? null,
    }));

    return { lat, lng, forecast_hours: hours };
  } catch (e) {
    return { error: `Weather fetch failed: ${e.message}` };
  }
}

/** Return all registered phone numbers for a ward (demo members + approved users). */
async function fetchWardMembers(ward_id) {
  const [demo, users] = await Promise.all([
    getDemoMembers(ward_id),
    getApproved(ward_id),
  ]);
  const phones = [
    ...demo.map((m) => m.phone),
    ...users.filter((u) => u.phone).map((u) => u.phone),
  ].filter(Boolean);

  return {
    ward_id,
    member_count: phones.length,
    phones,
    note: phones.length === 0
      ? "No registered members with phone numbers. Add members via the demo tweaker UI."
      : null,
  };
}

async function sendWhatsAppFromAgent({ recipients, message_ne, message_en, priority }) {
  const results = await sendWhatsAppBulk(recipients, message_ne, message_en, priority);
  return { sent: results.length, results };
}

async function validateMaskVision({ image_base64 }) {
  const buffer = Buffer.from(image_base64, "base64");
  return detectMask(buffer);
}

module.exports = { tools, dispatchTool };
