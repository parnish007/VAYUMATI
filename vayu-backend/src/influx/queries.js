const { getQueryApi } = require("./client");

/**
 * Latest air reading for a ward (looks back 5 minutes).
 */
async function getLatestAir(wardId) {
  const query = `
from(bucket: "${process.env.INFLUXDB_BUCKET}")
  |> range(start: -5m)
  |> filter(fn: (r) => r._measurement == "air_quality" and r.ward_id == "${wardId}")
  |> last()
  |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
`;
  return collectRows(query);
}

/**
 * Latest soil reading for a field (looks back 5 minutes).
 */
async function getLatestSoil(fieldId) {
  const query = `
from(bucket: "${process.env.INFLUXDB_BUCKET}")
  |> range(start: -5m)
  |> filter(fn: (r) => r._measurement == "soil_health" and r.field_id == "${fieldId}")
  |> last()
  |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
`;
  return collectRows(query);
}

/**
 * 7-day air history at 5-minute aggregation for a ward.
 */
async function getAirHistory(wardId, hours = 168, interval = "5m") {
  const query = `
from(bucket: "${process.env.INFLUXDB_BUCKET}")
  |> range(start: -${hours}h)
  |> filter(fn: (r) => r._measurement == "air_quality" and r.ward_id == "${wardId}")
  |> filter(fn: (r) => r._field == "aqi" or r._field == "pm25")
  |> aggregateWindow(every: ${interval}, fn: mean, createEmpty: false)
`;
  return collectRows(query);
}

/**
 * 7-day soil history for a field.
 */
async function getSoilHistory(fieldId, hours = 168) {
  const query = `
from(bucket: "${process.env.INFLUXDB_BUCKET}")
  |> range(start: -${hours}h)
  |> filter(fn: (r) => r._measurement == "soil_health" and r.field_id == "${fieldId}")
  |> filter(fn: (r) => r._field == "ph" or r._field == "moisture" or r._field == "ec")
  |> aggregateWindow(every: 5m, fn: mean, createEmpty: false)
`;
  return collectRows(query);
}

/**
 * 30-day rolling baseline mean for a specific field (anomaly detection).
 */
async function getAirBaseline(wardId, field = "no2") {
  const query = `
from(bucket: "${process.env.INFLUXDB_BUCKET}")
  |> range(start: -720h)
  |> filter(fn: (r) => r._measurement == "air_quality" and r.ward_id == "${wardId}" and r._field == "${field}")
  |> mean()
`;
  return collectRows(query);
}

/**
 * Collect all rows from a Flux query into an array.
 */
function collectRows(query) {
  return new Promise((resolve, reject) => {
    const rows = [];
    getQueryApi().queryRows(query, {
      next(row, tableMeta) {
        rows.push(tableMeta.toObject(row));
      },
      error(err) {
        console.error("[INFLUX] query error:", err.message);
        reject(err);
      },
      complete() {
        resolve(rows);
      },
    });
  });
}

/**
 * Mean PM2.5 over the last N hours for a ward. Used to compute accumulated
 * inhaled dose against the WHO 24h guideline (15 μg/m³).
 * Returns a single row { _value: meanPm25 } or empty array if no data.
 */
async function getMeanPm25(wardId, hours = 168) {
  const query = `
from(bucket: "${process.env.INFLUXDB_BUCKET}")
  |> range(start: -${hours}h)
  |> filter(fn: (r) => r._measurement == "air_quality" and r.ward_id == "${wardId}" and r._field == "pm25")
  |> mean()
`;
  return collectRows(query);
}

module.exports = {
  getLatestAir,
  getLatestSoil,
  getAirHistory,
  getSoilHistory,
  getAirBaseline,
  getMeanPm25,
};
