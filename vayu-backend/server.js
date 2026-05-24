require("dotenv").config();
const { initData }                       = require("./src/services/dataInit");
const { startMqttClient, getMqttClient } = require("./src/mqtt/client");
const { startHealthCheckLoop }           = require("./src/services/healthCheck");
const { getWriteApi }                    = require("./src/influx/client");
const app = require("./src/app");

const PORT = process.env.PORT || 3001;

async function start() {
  // Create PostgreSQL tables and seed demo accounts.
  // If DATABASE_URL is not set, skip gracefully — demo mode still works fine.
  try {
    await initData();
  } catch (err) {
    console.warn("[SERVER] PostgreSQL not available — live auth/registration disabled:", err.message);
    console.warn("[SERVER] Set DATABASE_URL to enable live mode. Demo mode works without it.");
  }

  startMqttClient();
  startHealthCheckLoop();

  const server = app.listen(PORT, () => {
    console.log(`[SERVER] VayuMitti backend running on port ${PORT}`);
  });

  function shutdown(signal) {
    console.log(`[SERVER] ${signal} — shutting down gracefully`);
    server.close(async () => {
      console.log("[SERVER] HTTP server closed");

      const mqttClient = getMqttClient();
      if (mqttClient?.connected) {
        mqttClient.end(false, {}, () => console.log("[SERVER] MQTT disconnected"));
      }

      try {
        await getWriteApi().close();
        console.log("[SERVER] InfluxDB write buffer flushed");
      } catch (e) {
        console.warn("[SERVER] InfluxDB flush error:", e.message);
      }

      process.exit(0);
    });

    setTimeout(() => {
      console.error("[SERVER] forced exit after 10 s shutdown timeout");
      process.exit(1);
    }, 10_000).unref();
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT",  () => shutdown("SIGINT"));
}

start().catch((err) => {
  console.error("[SERVER] Startup failed:", err);
  process.exit(1);
});
