const {
  InfluxDB,
  Point,
  WriteApi,
} = require("@influxdata/influxdb-client");

let _influxDB;
let _writeApi;

function getInfluxDB() {
  if (!_influxDB) {
    _influxDB = new InfluxDB({
      url:   process.env.INFLUXDB_URL,
      token: process.env.INFLUXDB_TOKEN,
    });
  }
  return _influxDB;
}

function getWriteApi() {
  if (!_writeApi) {
    const { WritePrecision } = require("@influxdata/influxdb-client");
    _writeApi = getInfluxDB().getWriteApi(
      process.env.INFLUXDB_ORG,
      process.env.INFLUXDB_BUCKET,
      "s",   // second precision — matches firmware ts field
      { batchSize: 10, flushInterval: 5000 }
    );
    _writeApi.useDefaultTags({ env: process.env.NODE_ENV || "development" });
  }
  return _writeApi;
}

function getQueryApi() {
  return getInfluxDB().getQueryApi(process.env.INFLUXDB_ORG);
}

/**
 * Write a live air reading from the MQTT handler.
 * @param {object} p - parsed MQTT payload from Node A
 */
async function writeAirReading(p) {
  const point = new Point("air_quality")
    .tag("node_id", p.node_id)
    .tag("ward_id", p.ward_id)
    .floatField("pm25",        p.pm25)
    .floatField("pm10",        p.pm10)
    .floatField("co2",         p.co2)
    .floatField("no2",         p.no2)
    .floatField("temperature", p.temp)
    .floatField("humidity",    p.humidity)
    .floatField("aqi",         p.aqi)
    .stringField("source",     p.source || "live")
    .timestamp(p.ts ? new Date(p.ts * 1000) : new Date());

  getWriteApi().writePoint(point);
  await getWriteApi().flush().catch((e) =>
    console.error("[INFLUX] write air error:", e.message)
  );
}

/**
 * Write a live soil reading from the MQTT handler.
 * @param {object} p - parsed MQTT payload from Node B
 */
async function writeSoilReading(p) {
  const point = new Point("soil_health")
    .tag("node_id",  p.node_id)
    .tag("field_id", p.field_id)
    .tag("ward_id",  p.ward_id)
    .floatField("moisture",      p.moisture)
    .floatField("ph",            p.ph)
    .floatField("ec",            p.ec)
    .floatField("soil_temp",     p.soil_temp)
    .floatField("ml_class",      p.ml_class)
    .floatField("ml_confidence", p.ml_confidence)
    .stringField("source",       p.source || "live")
    .timestamp(p.ts ? new Date(p.ts * 1000) : new Date());

  getWriteApi().writePoint(point);
  await getWriteApi().flush().catch((e) =>
    console.error("[INFLUX] write soil error:", e.message)
  );
}

module.exports = { writeAirReading, writeSoilReading, getQueryApi, getWriteApi };
