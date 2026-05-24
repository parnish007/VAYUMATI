/*
 * VayuMitti — Node B (Soil)
 * ESP8266 NodeMCU / Wemos D1 Mini
 *
 * Current state: DEMO_SENSOR_MODE 1 — simulated soil readings with slow
 * random drift. No physical sensors connected yet.
 *
 * Adding sensors later:
 *   1. Set DEMO_SENSOR_MODE 0 in config.h
 *   2. Uncomment the sensor stub sections marked // [SENSOR STUB] below
 *   3. Wire sensors per the circuit diagram in the plan doc
 *
 * Required Arduino libraries (install via Library Manager):
 *   PubSubClient  by Nick O'Leary   (v2.8+)
 *
 * Future sensor libraries (install when adding sensors):
 *   OneWire             by Jim Studt et al.
 *   DallasTemperature   by Miles Burton
 *
 * Board: "NodeMCU 1.0 (ESP-12E Module)"  OR  "LOLIN(Wemos) D1 mini"
 * Upload speed: 115200
 */

#include <ESP8266WiFi.h>
#include <ESP8266WebServer.h>
#include <PubSubClient.h>
#include <time.h>

#include "config.h"

// ── [SENSOR STUB] OneWire / DallasTemperature ─────────────────────────────────
// Uncomment when DS18B20 is wired to PIN_DS18B20 (D2, GPIO4):
//
// #include <OneWire.h>
// #include <DallasTemperature.h>
// OneWire oneWire(PIN_DS18B20);
// DallasTemperature ds(&oneWire);

// ── Hardware objects ──────────────────────────────────────────────────────────
WiFiClient       wifiClient;
PubSubClient     mqttClient(wifiClient);
ESP8266WebServer httpServer(HTTP_PORT);

// ── State ─────────────────────────────────────────────────────────────────────
float g_ph          = DEMO_PH_START;
float g_moisture    = DEMO_MOISTURE_START;
float g_ec          = DEMO_EC_START;
float g_soilTemp    = DEMO_TEMP_START;
int   g_mlClass     = 0;
float g_mlConf      = 0.70f;

char          g_jsonBuf[512];
unsigned long g_lastReadMs  = 0;
unsigned long g_wifiRetryMs = 0;

// ── LED helpers ───────────────────────────────────────────────────────────────

inline void ledOn()  { digitalWrite(PIN_LED, LED_ACTIVE_LOW ? LOW  : HIGH); }
inline void ledOff() { digitalWrite(PIN_LED, LED_ACTIVE_LOW ? HIGH : LOW ); }

void ledBlink(int n, int onMs = 80, int offMs = 120) {
  for (int i = 0; i < n; i++) {
    ledOn();  delay(onMs);
    ledOff(); delay(offMs);
  }
}

// ── Demo random walk ──────────────────────────────────────────────────────────
//
// Each call drifts the value by a random amount in [-drift, +drift],
// then clamps it to [minVal, maxVal]. This creates a realistic slow wander
// that looks like a live sensor but never escapes plausible bounds.

float driftValue(float current, float drift, float minVal, float maxVal) {
  // ESP8266 random() returns long; map to [-drift, +drift]
  float delta = drift * ((float)random(-1000, 1001) / 1000.0f);
  return constrain(current + delta, minVal, maxVal);
}

// ── Soil health classifier (threshold-based) ───────────────────────────────
//  Same logic as the ESP32 version so backend sees consistent ml_class values.
//    0 = healthy (all params in optimal range)
//    1 = borderline
//    2 = stressed (at least one param severely out of range)

int classifySoil(float ph, float moisture, float ec) {
  bool ph_ok    = (ph >= 6.0f && ph <= 7.5f);
  bool moist_ok = (moisture >= 35.0f && moisture <= 70.0f);
  bool ec_ok    = (ec >= 0.8f && ec <= 2.5f);
  if (ph_ok && moist_ok && ec_ok) return 0;

  bool ph_sev    = (ph < 5.0f || ph > 8.5f);
  bool moist_sev = (moisture < 15.0f || moisture > 90.0f);
  bool ec_sev    = (ec < 0.3f || ec > 4.0f);
  if (ph_sev || moist_sev || ec_sev) return 2;
  return 1;
}

// ── Sensor reads ──────────────────────────────────────────────────────────────

void readSensors() {
#if DEMO_SENSOR_MODE

  // Slow random walk — looks like live sensors, stays within realistic bounds
  g_ph       = driftValue(g_ph,       DEMO_PH_DRIFT,       DEMO_PH_MIN,       DEMO_PH_MAX);
  g_moisture = driftValue(g_moisture, DEMO_MOISTURE_DRIFT, DEMO_MOISTURE_MIN, DEMO_MOISTURE_MAX);
  g_ec       = driftValue(g_ec,       DEMO_EC_DRIFT,       DEMO_EC_MIN,       DEMO_EC_MAX);
  g_soilTemp = driftValue(g_soilTemp, DEMO_TEMP_DRIFT,     DEMO_TEMP_MIN,     DEMO_TEMP_MAX);

#else

  // [SENSOR STUB] — uncomment and adapt when sensors are wired:

  // DS18B20 soil temperature (requires OneWire + DallasTemperature)
  // ds.requestTemperatures();
  // float t = ds.getTempCByIndex(0);
  // if (t != DEVICE_DISCONNECTED_C) g_soilTemp = t;

  // pH probe on A0 (0–1V range after voltage divider):
  // int raw = analogRead(PIN_PH_ADC);    // 0–1023 on ESP8266 (10-bit)
  // float v = raw * (1.0f / 1023.0f);   // convert to 0–1V
  // // Two-point calibration: V7 = ADC voltage at pH 7.0, V4 = ADC voltage at pH 4.0
  // // Replace V7_VOLTS and V4_VOLTS with measured values from buffer solutions.
  // const float V7_VOLTS = 0.60f;  // REPLACE with your measured value
  // const float V4_VOLTS = 0.43f;  // REPLACE with your measured value
  // float slope = (7.0f - 4.0f) / (V7_VOLTS - V4_VOLTS);
  // g_ph = constrain(7.0f + slope * (v - V7_VOLTS), 3.0f, 10.0f);

  // Moisture (capacitive sensor analog output via external ADS1115 or similar):
  // g_moisture = readMoistureFromExternalADC();

  // EC (conductivity probe analog):
  // g_ec = readECFromExternalADC();

#endif

  g_mlClass = classifySoil(g_ph, g_moisture, g_ec);
  g_mlConf  = DEMO_SENSOR_MODE ? 0.70f : 0.91f;
}

// ── WiFi ─────────────────────────────────────────────────────────────────────

bool tryConnect(const char* ssid, const char* pass) {
  Serial.printf("[WiFi] trying %s ... ", ssid);
  WiFi.begin(ssid, pass);
  unsigned long t = millis();
  while (WiFi.status() != WL_CONNECTED) {
    if (millis() - t > WIFI_TIMEOUT_MS) {
      Serial.println("timeout");
      WiFi.disconnect(true);
      return false;
    }
    delay(500);
    Serial.print(".");
  }
  Serial.printf(" connected! IP=%s\n", WiFi.localIP().toString().c_str());
  return true;
}

void connectWiFi() {
  WiFi.mode(WIFI_STA);
  if (tryConnect(WIFI_SSID_1, WIFI_PASS_1)) return;
  if (tryConnect(WIFI_SSID_2, WIFI_PASS_2)) return;
  Serial.println("[WiFi] both SSIDs failed — will retry");
}

void ensureWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;
  if (millis() - g_wifiRetryMs < WIFI_RETRY_MS) return;
  g_wifiRetryMs = millis();
  connectWiFi();
  if (WiFi.status() == WL_CONNECTED) {
    syncNTP();
    mqttClient.disconnect();
  }
}

// ── NTP ──────────────────────────────────────────────────────────────────────

void syncNTP() {
  configTime(0, 0, "pool.ntp.org", "time.nist.gov");
  Serial.print("[NTP] syncing");
  time_t now;
  unsigned long t = millis();
  while ((now = time(nullptr)) < 1700000000L) {
    if (millis() - t > 10000) { Serial.println(" timed out"); return; }
    delay(500);
    Serial.print(".");
  }
  Serial.printf(" ok, epoch=%ld\n", (long)now);
}

long getTimestamp() {
  time_t now = time(nullptr);
  return (now < 1700000000L) ? (long)(millis() / 1000) : (long)now;
}

// ── MQTT ─────────────────────────────────────────────────────────────────────

void reconnectMQTT() {
  if (WiFi.status() != WL_CONNECTED) return;

  char clientId[32];
  // ESP8266 uses getChipId() — no getEfuseMac()
  snprintf(clientId, sizeof(clientId), "vayu-B1-%08X", ESP.getChipId());

  int retries = 0;
  while (!mqttClient.connected() && retries < 3) {
    Serial.printf("[MQTT] connecting as %s ... ", clientId);
    if (mqttClient.connect(clientId)) {
      Serial.println("ok");
      ledBlink(3);
    } else {
      Serial.printf("failed rc=%d, retry in 3s\n", mqttClient.state());
      delay(3000);
      retries++;
    }
  }
}

// ── JSON payload ──────────────────────────────────────────────────────────────

#if DEMO_SENSOR_MODE
  #define NODE_B_SOURCE "demo"
#else
  #define NODE_B_SOURCE "live"
#endif

void buildJSON() {
  snprintf(g_jsonBuf, sizeof(g_jsonBuf),
    "{"
    "\"node_id\":\"B1\","
    "\"ward_id\":\"11\","
    "\"field_id\":\"A1\","
    "\"ts\":%ld,"
    "\"moisture\":%.1f,"
    "\"ph\":%.2f,"
    "\"ec\":%.2f,"
    "\"soil_temp\":%.1f,"
    "\"ml_class\":%d,"
    "\"ml_confidence\":%.2f,"
    "\"source\":\"" NODE_B_SOURCE "\","
    "\"rssi\":%d,"
    "\"uptime_s\":%lu"
    "}",
    getTimestamp(),
    g_moisture, g_ph, g_ec, g_soilTemp,
    g_mlClass, g_mlConf,
    (int)WiFi.RSSI(),
    millis() / 1000UL
  );
}

// ── MQTT publish ──────────────────────────────────────────────────────────────

void publishMQTT() {
  if (!mqttClient.connected()) return;
  bool ok = mqttClient.publish(MQTT_TOPIC, g_jsonBuf, false);
  Serial.printf("[MQTT] publish %s  class=%d  ok=%d\n", MQTT_TOPIC, g_mlClass, ok ? 1 : 0);
  if (ok) ledBlink(1, 30, 0);
}

// ── HTTP /data fallback ───────────────────────────────────────────────────────

void handleHttpData() {
  httpServer.sendHeader("Access-Control-Allow-Origin", "*");
  httpServer.send(200, "application/json", g_jsonBuf);
}

void handleHttpRoot() {
  char buf[96];
  snprintf(buf, sizeof(buf),
    "VayuMitti Node B1 | pH=%.2f moist=%.0f%% class=%d | GET /data",
    g_ph, g_moisture, g_mlClass);
  httpServer.send(200, "text/plain", buf);
}

// ── Serial debug ──────────────────────────────────────────────────────────────

void printSerial() {
#if DEMO_SENSOR_MODE
  Serial.printf(
    "[READ] pH=%.2f  moisture=%.1f%%  EC=%.2f mS/cm  temp=%.1f C"
    "  class=%d  conf=%.2f  RSSI=%d [DEMO]\n",
    g_ph, g_moisture, g_ec, g_soilTemp,
    g_mlClass, g_mlConf, (int)WiFi.RSSI());
#else
  Serial.printf(
    "[READ] pH=%.2f  moisture=%.1f%%  EC=%.2f mS/cm  temp=%.1f C"
    "  class=%d  conf=%.2f  RSSI=%d\n",
    g_ph, g_moisture, g_ec, g_soilTemp,
    g_mlClass, g_mlConf, (int)WiFi.RSSI());
#endif
}

// ── Setup ─────────────────────────────────────────────────────────────────────

void setup() {
  Serial.begin(115200);
  Serial.println("\n[BOOT] VayuMitti Node B (ESP8266) starting...");
  Serial.printf("[BOOT] DEMO_SENSOR_MODE=%d\n", DEMO_SENSOR_MODE);

  pinMode(PIN_LED, OUTPUT);
  ledOff();

  // Seed ESP8266 random number generator with chip ID for unique drift
  randomSeed(ESP.getChipId() ^ millis());

  // [SENSOR STUB] Init DS18B20 when connected:
  // ds.begin();
  // Serial.printf("[DS18B20] found %d device(s)\n", ds.getDeviceCount());

  buildJSON();

  connectWiFi();
  if (WiFi.status() == WL_CONNECTED) syncNTP();

  mqttClient.setServer(MQTT_HOST, MQTT_PORT);
  mqttClient.setBufferSize(MQTT_BUF_SIZE);
  reconnectMQTT();

  httpServer.on("/",     handleHttpRoot);
  httpServer.on("/data", handleHttpData);
  httpServer.begin();
  Serial.printf("[HTTP] server on port %d\n", HTTP_PORT);

  ledBlink(2);
  Serial.println("[BOOT] setup complete");
}

// ── Loop ──────────────────────────────────────────────────────────────────────

void loop() {
  ensureWiFi();
  if (!mqttClient.connected()) reconnectMQTT();
  mqttClient.loop();
  httpServer.handleClient();

  if (millis() - g_lastReadMs >= READ_INTERVAL_MS) {
    g_lastReadMs = millis();
    readSensors();
    buildJSON();
    printSerial();
    publishMQTT();
  }
}
