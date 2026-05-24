const mqtt = require("mqtt");

let client;

function startMqttClient() {
  const host = process.env.MQTT_HOST || "broker.hivemq.com";
  const port = process.env.MQTT_PORT || 1883;

  const options = {
    clientId: `vayu-backend-${Math.random().toString(16).slice(3)}`,
    reconnectPeriod: 3000,
    connectTimeout: 10000,
  };
  if (process.env.MQTT_USERNAME) options.username = process.env.MQTT_USERNAME;
  if (process.env.MQTT_PASSWORD) options.password = process.env.MQTT_PASSWORD;

  client = mqtt.connect(`mqtt://${host}:${port}`, options);

  client.on("connect", () => {
    console.log(`[MQTT] connected to ${host}:${port}`);
    client.subscribe("vayu/#",  { qos: 1 }, (err) => {
      if (err) console.error("[MQTT] subscribe vayu/# error:", err.message);
    });
    client.subscribe("mitti/#", { qos: 1 }, (err) => {
      if (err) console.error("[MQTT] subscribe mitti/# error:", err.message);
    });
  });

  client.on("message", (topic, message) => {
    let payload;
    try {
      payload = JSON.parse(message.toString());
    } catch (e) {
      console.error("[MQTT] parse error:", e.message, "topic:", topic);
      return;
    }
    payload._receivedAt = Date.now();

    if (topic.startsWith("vayu/")) {
      // Lazy-require to break circular dependency at load time
      require("./handlers/airHandler").handleAirMessage(topic, payload);
    } else if (topic.startsWith("mitti/")) {
      require("./handlers/soilHandler").handleSoilMessage(topic, payload);
    }
  });

  client.on("error",     (err) => console.error("[MQTT] error:", err.message));
  client.on("reconnect", ()    => console.log("[MQTT] reconnecting..."));
  client.on("offline",   ()    => console.log("[MQTT] offline"));
  client.on("close",     ()    => console.log("[MQTT] connection closed"));
}

function getMqttClient() {
  return client;
}

module.exports = { startMqttClient, getMqttClient };
