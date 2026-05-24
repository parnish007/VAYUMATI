const express = require("express");
const router = express.Router();
const { getQueryApi } = require("../influx/client");
const { fetchOpenAQFallback } = require("../services/fallback");

const DEFAULT_LAT = () => parseFloat(process.env.DEFAULT_LAT) || 27.717;
const DEFAULT_LNG = () => parseFloat(process.env.DEFAULT_LNG) || 85.324;

function hasInflux() {
  return !!(process.env.INFLUXDB_URL && process.env.INFLUXDB_TOKEN);
}

async function queryLatestAir(wardId) {
  const bucket = process.env.INFLUXDB_BUCKET || "sensor-readings";
  const flux = `
from(bucket: "${bucket}")
  |> range(start: -5m)
  |> filter(fn: (r) => r._measurement == "air_quality" and r.ward_id == "${wardId}")
  |> last()
  |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
`;
  const rows = await getQueryApi().collectRows(flux);
  return rows[0] || null;
}

async function queryAirHistory(wardId, range = "-168h") {
  const bucket = process.env.INFLUXDB_BUCKET || "sensor-readings";
  const flux = `
from(bucket: "${bucket}")
  |> range(start: ${range})
  |> filter(fn: (r) => r._measurement == "air_quality" and r.ward_id == "${wardId}")
  |> filter(fn: (r) => r._field == "aqi" or r._field == "pm25")
  |> aggregateWindow(every: 5m, fn: mean, createEmpty: false)
  |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
`;
  return getQueryApi().collectRows(flux);
}

// GET /api/air/:ward_id
router.get("/:ward_id", async (req, res) => {
  const { ward_id } = req.params;

  try {
    if (hasInflux()) {
      try {
        const row = await queryLatestAir(ward_id);
        if (row) {
          return res.json({
            ward_id:     row.ward_id     || ward_id,
            node_id:     row.node_id     || "A1",
            ts:          Math.floor(new Date(row._time).getTime() / 1000),
            pm25:        row.pm25        ?? null,
            pm10:        row.pm10        ?? null,
            co2:         row.co2         ?? null,
            no2:         row.no2         ?? null,
            temperature: row.temperature ?? null,
            humidity:    row.humidity    ?? null,
            aqi:         row.aqi         ?? null,
            source:      row.source      || "live",
          });
        }
      } catch (influxErr) {
        console.warn("[AIR] InfluxDB query failed, trying fallback:", influxErr.message);
      }
    }

    // No InfluxDB or no recent data → Open-Meteo fallback
    const data = await fetchOpenAQFallback(DEFAULT_LAT(), DEFAULT_LNG());
    return res.json({
      ward_id,
      node_id:     "fallback",
      ts:          data.ts,
      pm25:        data.pm25,
      pm10:        data.pm10,
      co2:         data.co2         ?? null,
      no2:         data.no2,
      temperature: data.temp        ?? null,
      humidity:    data.humidity    ?? null,
      aqi:         data.aqi,
      source:      data.source,
    });
  } catch (err) {
    console.error("[AIR] route error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/air/:ward_id/history?range=-168h
const SAFE_RANGE_RE = /^-\d{1,6}[mhd]$/;
router.get("/:ward_id/history", async (req, res) => {
  const { ward_id } = req.params;
  const range = SAFE_RANGE_RE.test(req.query.range) ? req.query.range : "-168h";

  if (!hasInflux()) {
    return res.json([]);
  }

  try {
    const rows = await queryAirHistory(ward_id, range);
    const points = rows.map((r) => ({
      ts:   Math.floor(new Date(r._time).getTime() / 1000),
      aqi:  r.aqi  ?? null,
      pm25: r.pm25 ?? null,
    }));
    res.json(points);
  } catch (err) {
    console.error("[AIR] history error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/air/all
router.get("/all", async (req, res) => {
  res.json([]);
});

module.exports = router;
