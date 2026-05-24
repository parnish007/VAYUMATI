const express = require("express");
const router = express.Router();
const { getQueryApi } = require("../influx/client");
const { fetchSoilGridsFallback } = require("../services/fallback");

const DEFAULT_LAT = () => parseFloat(process.env.DEFAULT_LAT) || 27.717;
const DEFAULT_LNG = () => parseFloat(process.env.DEFAULT_LNG) || 85.324;

function hasInflux() {
  return !!(process.env.INFLUXDB_URL && process.env.INFLUXDB_TOKEN);
}

async function queryLatestSoil(fieldId) {
  const bucket = process.env.INFLUXDB_BUCKET || "sensor-readings";
  const flux = `
from(bucket: "${bucket}")
  |> range(start: -5m)
  |> filter(fn: (r) => r._measurement == "soil_health" and r.field_id == "${fieldId}")
  |> last()
  |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
`;
  const rows = await getQueryApi().collectRows(flux);
  return rows[0] || null;
}

async function querySoilHistory(fieldId, range = "-168h") {
  const bucket = process.env.INFLUXDB_BUCKET || "sensor-readings";
  const flux = `
from(bucket: "${bucket}")
  |> range(start: ${range})
  |> filter(fn: (r) => r._measurement == "soil_health" and r.field_id == "${fieldId}")
  |> filter(fn: (r) => r._field == "ph" or r._field == "moisture" or r._field == "ec")
  |> aggregateWindow(every: 5m, fn: mean, createEmpty: false)
  |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
`;
  return getQueryApi().collectRows(flux);
}

// GET /api/soil/:field_id
router.get("/:field_id", async (req, res) => {
  const { field_id } = req.params;

  try {
    if (hasInflux()) {
      try {
        const row = await queryLatestSoil(field_id);
        if (row) {
          return res.json({
            ward_id:   row.ward_id  || process.env.NEXT_PUBLIC_DEFAULT_WARD || "11",
            field_id:  row.field_id || field_id,
            node_id:   row.node_id  || "B1",
            ts:        Math.floor(new Date(row._time).getTime() / 1000),
            ph:        row.ph        ?? null,
            ec:        row.ec        ?? null,
            moisture:  row.moisture  ?? null,
            soil_temp: row.soil_temp ?? null,
            ml_class:  row.ml_class  != null ? Math.round(row.ml_class) : null,
            source:    row.source    || "live",
          });
        }
      } catch (influxErr) {
        console.warn("[SOIL] InfluxDB query failed, trying fallback:", influxErr.message);
      }
    }

    // No InfluxDB or no recent data → SoilGrids + Open-Meteo fallback
    const data = await fetchSoilGridsFallback(DEFAULT_LAT(), DEFAULT_LNG());
    return res.json({
      ward_id:   process.env.NEXT_PUBLIC_DEFAULT_WARD || "11",
      field_id,
      node_id:   "fallback",
      ts:        data.ts,
      ph:        data.ph,
      ec:        data.ec,
      moisture:  data.moisture,
      soil_temp: data.soil_temp,
      ml_class:  data.ml_class ?? null,
      source:    data.source,
    });
  } catch (err) {
    console.error("[SOIL] route error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/soil/:field_id/history?range=-168h
const SAFE_RANGE_RE = /^-\d{1,6}[mhd]$/;
router.get("/:field_id/history", async (req, res) => {
  const { field_id } = req.params;
  const range = SAFE_RANGE_RE.test(req.query.range) ? req.query.range : "-168h";

  if (!hasInflux()) {
    return res.json([]);
  }

  try {
    const rows = await querySoilHistory(field_id, range);
    const points = rows.map((r) => ({
      ts:       Math.floor(new Date(r._time).getTime() / 1000),
      ph:       r.ph       ?? null,
      moisture: r.moisture ?? null,
      ec:       r.ec       ?? null,
    }));
    res.json(points);
  } catch (err) {
    console.error("[SOIL] history error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
