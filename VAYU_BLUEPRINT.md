# VAYU MITTI — CLAUDE CODE BLUEPRINT
## VayuMitti Community Edition v2.0
## "Soil, Sky, and Community Intelligence for Nepal"

---

## HOW TO READ THIS FILE

This blueprint is written for Claude Code. Every section is an executable instruction.
Read the entire file before touching any code. The order matters.
Architecture → Hardware → Backend → Frontend → Features → Deployment.

When Claude Code implements a feature, reference the exact section name.
When something is marked [DEMO CRITICAL], it must work flawlessly before the event.
When something is marked [OPTIONAL], implement only after all [DEMO CRITICAL] items pass.

---

## 1. SYSTEM ARCHITECTURE OVERVIEW

```
┌─────────────────────────────────────────────────────────────────┐
│                    HARDWARE LAYER                                │
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐   │
│  │  Node A      │    │  Node B      │    │  Node C..N       │   │
│  │  ESP32       │    │  ESP32       │    │  ESP32 (future)  │   │
│  │  Air sensor  │    │  Soil sensor │    │  Expandable      │   │
│  │  OLED screen │    │  TinyML      │    │                  │   │
│  └──────┬───────┘    └──────┬───────┘    └────────┬─────────┘   │
│         │                  │                      │             │
│         └──────────────────┴──────────────────────┘             │
│                        WiFi / MQTT                               │
└────────────────────────────┬────────────────────────────────────┘
                             │
                    ┌────────▼────────┐
                    │  CLOUD MQTT     │
                    │  HiveMQ Free    │
                    │  broker.hivemq  │
                    │  .com:1883      │
                    └────────┬────────┘
                             │
             ┌───────────────┴────────────────┐
             │                                │
    ┌────────▼──────────┐           ┌─────────▼──────────┐
    │   BACKEND         │           │   FRONTEND          │
    │   Node.js 20      │◄──REST───►│   Next.js 14        │
    │   Express 4       │           │   App Router        │
    │   Railway.app     │           │   Vercel            │
    │                   │           │                     │
    │   InfluxDB Cloud  │           │   Mobile: Ward Mbr  │
    │   Mosquitto sub   │           │   Desktop: Exec     │
    │   Claude API      │           │                     │
    │   Twilio WA       │           │                     │
    └───────────────────┘           └─────────────────────┘
```

### Deployment URLs (configure before hackathon)

```
BACKEND_URL=https://vayu-backend.railway.app
FRONTEND_URL=https://vayu-mitti.vercel.app
MQTT_BROKER=broker.hivemq.com
MQTT_PORT=1883
INFLUXDB_URL=https://us-east-1-1.aws.cloud2.influxdata.com
```

---

## 2. SENSOR DEPLOYMENT OPTIONS

### Option A: Centerpoint Tower

One sensor cluster mounted at the geographic center of a ward, ideally at elevation
(rooftop of a public building, water tower, school rooftop). Single physical installation
per ward. This is the hackathon demo configuration.

```
Ward boundary
┌─────────────────────────────┐
│                             │
│                             │
│                             │
│         ★ Node A            │  ★ = sensor at ward center/peak
│         ★ Node B            │  One air node + one soil node
│                             │
│                             │
└─────────────────────────────┘

Coverage: Represents the ward's aggregate air quality.
Limitation: Cannot show pollution gradients within the ward.
Best for: Early deployment, low cost, single-ward demo.
```

### Option B: Distributed Grid (Every 5 Homes)

Multiple nodes distributed throughout the ward. Each node is a combined air+soil unit
placed at every fifth household boundary. Reveals intra-ward pollution gradients.

```
Ward boundary
┌─────────────────────────────┐
│  ●     ●     ●     ●        │
│                             │
│  ●     ●     ●     ●        │  ● = sensor node
│                             │     (one per ~5 homes)
│  ●     ●     ●     ●        │
│                             │
│  ●     ●     ●     ●        │
└─────────────────────────────┘

Coverage: Full intra-ward spatial resolution.
Advantage: Can identify pollution hotspots inside a ward.
Best for: Scaled deployment after pilot validation.
Node count estimate: Ward area ~0.5km² ÷ ~150m spacing = 9 to 16 nodes per ward.
```

### For the hackathon

Use Option A with two nodes: Node A (air) and Node B (soil) at one location.
The UI is built to support Option B from day one — the sensor grid view in the
ward executive dashboard renders any number of nodes, not just two.
The hardware constraint does not limit the UI's ability to demonstrate the scaled vision.

---

## 3. PROJECT INITIALIZATION

### 3.1 Repository structure

```
vayu-mitti/
├── vayu-backend/           ← Node.js backend, deploy to Railway
│   ├── src/
│   │   ├── mqtt/
│   │   │   ├── client.js           ← MQTT subscriber and message router
│   │   │   └── handlers/
│   │   │       ├── airHandler.js   ← Process air node payloads
│   │   │       └── soilHandler.js  ← Process soil node payloads
│   │   ├── influx/
│   │   │   ├── client.js           ← InfluxDB write and query client
│   │   │   └── queries.js          ← Named Flux query functions
│   │   ├── routes/
│   │   │   ├── air.js              ← /api/air/* endpoints
│   │   │   ├── soil.js             ← /api/soil/* endpoints
│   │   │   ├── nodes.js            ← /api/nodes/* endpoints
│   │   │   ├── advisory.js         ← /api/advisory/* endpoints
│   │   │   ├── ward.js             ← /api/ward/* endpoints
│   │   │   ├── exposure.js         ← /api/exposure/* endpoints
│   │   │   ├── community.js        ← /api/community/* endpoints
│   │   │   └── data.js             ← /api/data/* export endpoints
│   │   ├── agent/
│   │   │   ├── mati.js             ← Claude agent orchestrator
│   │   │   ├── tools.js            ← Tool definitions and dispatch
│   │   │   ├── prompts.js          ← System prompt and advisory templates
│   │   │   └── templates.js        ← 10 fallback advisory templates
│   │   ├── services/
│   │   │   ├── healthCheck.js      ← Node online/offline/fallback state machine
│   │   │   ├── fallback.js         ← OpenAQ and SoilGrids fallback fetchers
│   │   │   ├── whatsapp.js         ← Twilio WhatsApp sender
│   │   │   ├── scoring.js          ← Protective Action Score computation
│   │   │   ├── leaderboard.js      ← Ward leaderboard computation
│   │   │   ├── selfie.js           ← Mask selfie vision validation
│   │   │   └── pdf.js              ← Governance advisory PDF generator
│   │   ├── middleware/
│   │   │   ├── auth.js             ← JWT auth middleware
│   │   │   └── upload.js           ← Multer selfie upload config
│   │   └── app.js                  ← Express app setup and route mounting
│   ├── server.js                   ← Entry point, starts MQTT + Express
│   ├── .env                        ← All secrets (never commit)
│   ├── .env.example                ← Template for secrets
│   └── package.json
│
├── vayu-frontend/          ← Next.js 14 frontend, deploy to Vercel
│   ├── app/
│   │   ├── layout.tsx              ← Root layout, font imports, providers
│   │   ├── page.tsx                ← Root redirects to /dashboard
│   │   ├── (auth)/
│   │   │   └── login/
│   │   │       └── page.tsx        ← Login page
│   │   ├── (app)/
│   │   │   ├── layout.tsx          ← App shell with responsive nav
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx        ← Overview (mobile: personal, desktop: ward)
│   │   │   ├── map/
│   │   │   │   └── page.tsx        ← Live AQI heatmap
│   │   │   ├── exposure/
│   │   │   │   └── page.tsx        ← Personal tracking (mobile-first)
│   │   │   ├── farm/
│   │   │   │   └── page.tsx        ← Soil health
│   │   │   ├── ward/
│   │   │   │   └── page.tsx        ← Ward sensor grid (desktop-primary)
│   │   │   ├── rewards/
│   │   │   │   └── page.tsx        ← Badges, leaderboard, rewards
│   │   │   ├── community/
│   │   │   │   └── page.tsx        ← Mask wall, ward board
│   │   │   ├── alerts/
│   │   │   │   └── page.tsx        ← Alert center
│   │   │   ├── chat/
│   │   │   │   └── page.tsx        ← MATI AI chat
│   │   │   └── data/
│   │   │       └── page.tsx        ← Trends and export
│   │   └── api/
│   │       └── proxy/
│   │           └── [...path]/
│   │               └── route.ts    ← Proxy to backend (avoids CORS in dev)
│   ├── components/
│   │   ├── ui/                     ← Primitive components
│   │   │   ├── Card.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── Button.tsx
│   │   │   ├── Pill.tsx
│   │   │   ├── Stat.tsx
│   │   │   └── Skeleton.tsx
│   │   ├── sensors/
│   │   │   ├── AQIGauge.tsx        ← SVG gauge
│   │   │   ├── SoilMeter.tsx       ← Four soil dials
│   │   │   ├── SoilStory.tsx       ← pH color cross-section visualization
│   │   │   └── NodeStatusDot.tsx   ← Green/amber/red live indicator
│   │   ├── ward/
│   │   │   ├── SensorGrid.tsx      ← Ward sensor grid with status cards
│   │   │   ├── SensorCard.tsx      ← Individual node card
│   │   │   ├── WardMap.tsx         ← Leaflet ward heatmap
│   │   │   └── NodeOfflineAlert.tsx← Inline alert when node drops
│   │   ├── exposure/
│   │   │   ├── DayTimeline.tsx     ← Horizontal scroll hour-by-hour
│   │   │   ├── RouteLogger.tsx     ← One-tap commute entry
│   │   │   ├── ExposureSummary.tsx ← Cigarette equiv + dose card
│   │   │   └── WeeklyBars.tsx      ← 7-day bar chart
│   │   ├── rewards/
│   │   │   ├── ScoreRing.tsx       ← Circular PA score meter
│   │   │   ├── BadgeGrid.tsx       ← Earned + locked badge grid
│   │   │   ├── WardRank.tsx        ← User's rank in ward leaderboard
│   │   │   └── RewardCard.tsx      ← Current reward + progress to next
│   │   ├── community/
│   │   │   ├── MaskWall.tsx        ← Circular selfie grid
│   │   │   ├── SelfieButton.tsx    ← Camera trigger + upload
│   │   │   └── CleanWardBoard.tsx  ← Ranked ward table
│   │   ├── advisory/
│   │   │   ├── AdvisoryCard.tsx    ← Structured advisory display
│   │   │   ├── ReasoningTrace.tsx  ← Collapsible agent tool-call log
│   │   │   └── AudienceTabs.tsx    ← Switch individual/farmer/hospital/govt
│   │   ├── chat/
│   │   │   ├── ChatWindow.tsx      ← MATI conversation UI
│   │   │   └── ToolCallBadge.tsx   ← Shows which tools fired
│   │   └── layout/
│   │       ├── Sidebar.tsx         ← Desktop sidebar nav
│   │       ├── BottomNav.tsx       ← Mobile bottom tab bar
│   │       ├── TopBar.tsx          ← Page header + AQI pill
│   │       └── NotifPanel.tsx      ← Slide-in notification drawer
│   ├── hooks/
│   │   ├── useNodes.ts             ← SWR polling for node status
│   │   ├── useAir.ts               ← SWR polling for air data
│   │   ├── useSoil.ts              ← SWR polling for soil data
│   │   ├── useAdvisory.ts          ← SWR polling for latest advisory
│   │   ├── useExposure.ts          ← Local exposure log state + persistence
│   │   ├── useRewards.ts           ← User score and badges
│   │   └── useSSE.ts               ← Server-Sent Events for live push
│   ├── lib/
│   │   ├── api.ts                  ← Typed fetch wrappers for all endpoints
│   │   ├── aqi.ts                  ← AQI color, label, cigarette equiv utils
│   │   ├── scores.ts               ← PA score computation client-side
│   │   └── constants.ts            ← Ward configs, kiln coords, thresholds
│   ├── types/
│   │   └── index.ts                ← Shared TypeScript types
│   ├── public/
│   │   └── icons/                  ← PWA icons
│   ├── tailwind.config.ts
│   ├── next.config.ts
│   ├── .env.local                  ← Frontend env vars
│   └── package.json
│
└── vayu-firmware/          ← Arduino / PlatformIO firmware
    ├── node-a-air/
    │   ├── node-a-air.ino          ← Air node main sketch
    │   ├── aqi.h                   ← EPA AQI formula
    │   ├── display.h               ← OLED rendering
    │   └── config.h                ← WiFi credentials, MQTT settings
    └── node-b-soil/
        ├── node-b-soil.ino         ← Soil node main sketch
        ├── soil_model.h            ← TinyML C array from m2cgen
        ├── ph_calibration.h        ← V7, V4, slope, intercept constants
        └── config.h                ← WiFi credentials, MQTT settings
```

### 3.2 Initialization commands

```bash
# Clone or create repo
mkdir vayu-mitti && cd vayu-mitti

# Backend
mkdir vayu-backend && cd vayu-backend
npm init -y
npm install express mqtt @influxdata/influxdb-client @anthropic-ai/sdk \
  twilio multer sharp pdfkit jsonwebtoken bcryptjs cors helmet \
  dotenv node-cron axios swr

# Dev dependencies
npm install -D nodemon

# Create entry point
touch server.js src/app.js

# Return to root
cd ..

# Frontend
npx create-next-app@latest vayu-frontend \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*"

cd vayu-frontend
npm install swr leaflet react-leaflet @types/leaflet \
  recharts framer-motion lucide-react \
  @radix-ui/react-dialog @radix-ui/react-tabs \
  @radix-ui/react-progress class-variance-authority clsx

cd ..

# Firmware (if using PlatformIO)
mkdir vayu-firmware
cd vayu-firmware
mkdir node-a-air node-b-soil
```

---

## 4. ENVIRONMENT VARIABLES

### Backend (.env)

```env
# Server
NODE_ENV=production
PORT=3001

# MQTT — HiveMQ Cloud free tier
MQTT_HOST=broker.hivemq.com
MQTT_PORT=1883
MQTT_USERNAME=
MQTT_PASSWORD=
# HiveMQ free allows anonymous connections, leave blank for demo

# InfluxDB Cloud free tier
INFLUXDB_URL=https://us-east-1-1.aws.cloud2.influxdata.com
INFLUXDB_TOKEN=your_influxdb_api_token_here
INFLUXDB_ORG=vayu-mitti
INFLUXDB_BUCKET=sensor-readings

# Anthropic
ANTHROPIC_API_KEY=your_anthropic_key_here
CLAUDE_MODEL=claude-sonnet-4-20250514

# Twilio WhatsApp
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_WA_FROM=whatsapp:+14155238886
# ^^ This is the Twilio sandbox number, use it for demo

# Fallback APIs (no keys required)
OPENAQ_API_URL=https://api.openaq.org/v2
SOILGRIDS_API_URL=https://rest.soilgrids.org/soilgrids/v2.0
OPENMETEO_API_URL=https://api.open-meteo.com/v1

# Auth
JWT_SECRET=generate_a_random_64_char_string_here
JWT_EXPIRY=7d

# Frontend URL (for CORS)
FRONTEND_URL=https://vayu-mitti.vercel.app

# Node health check interval (ms)
HEALTH_CHECK_INTERVAL=30000
NODE_TIMEOUT_MS=90000

# Ward configuration
DEFAULT_WARD_ID=11
DEFAULT_FIELD_ID=A1
DEFAULT_LAT=27.717
DEFAULT_LNG=85.324

# Kiln coordinates (comma-separated lat:lng pairs)
KILN_COORDS=27.672:85.430,27.681:85.405,27.688:85.386

# Demo mode (uses simulated data if sensors offline)
DEMO_MODE=false
```

### Frontend (.env.local)

```env
NEXT_PUBLIC_BACKEND_URL=https://vayu-backend.railway.app
NEXT_PUBLIC_WS_URL=wss://vayu-backend.railway.app
NEXT_PUBLIC_DEFAULT_WARD=11
NEXT_PUBLIC_DEFAULT_LAT=27.717
NEXT_PUBLIC_DEFAULT_LNG=85.324
NEXT_PUBLIC_APP_NAME=VayuMitti
```

---

## 5. BACKEND IMPLEMENTATION

### 5.1 server.js (entry point)

```javascript
require("dotenv").config();
const { startMqttClient } = require("./src/mqtt/client");
const app = require("./src/app");

const PORT = process.env.PORT || 3001;

// Start MQTT subscriber first
startMqttClient();

// Start Express server
app.listen(PORT, () => {
  console.log(`VayuMitti backend running on port ${PORT}`);
});
```

### 5.2 src/app.js

```javascript
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const path = require("path");

const app = express();

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true
}));
app.use(express.json({ limit: "10mb" })); // Large enough for selfie base64

// Static uploads folder for selfie thumbnails
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// Routes
app.use("/api/air", require("./routes/air"));
app.use("/api/soil", require("./routes/soil"));
app.use("/api/nodes", require("./routes/nodes"));
app.use("/api/advisory", require("./routes/advisory"));
app.use("/api/ward", require("./routes/ward"));
app.use("/api/exposure", require("./routes/exposure"));
app.use("/api/community", require("./routes/community"));
app.use("/api/data", require("./routes/data"));

// SSE endpoint for live push to frontend
app.get("/api/live", require("./routes/sse"));

module.exports = app;
```

### 5.3 src/mqtt/client.js

```javascript
const mqtt = require("mqtt");
const { handleAirMessage } = require("./handlers/airHandler");
const { handleSoilMessage } = require("./handlers/soilHandler");
const { nodeRegistry } = require("../services/healthCheck");

let client;

function startMqttClient() {
  client = mqtt.connect(`mqtt://${process.env.MQTT_HOST}:${process.env.MQTT_PORT}`, {
    username: process.env.MQTT_USERNAME || undefined,
    password: process.env.MQTT_PASSWORD || undefined,
    clientId: `vayu-backend-${Math.random().toString(16).slice(3)}`,
    reconnectPeriod: 3000,
  });

  client.on("connect", () => {
    console.log("MQTT connected to", process.env.MQTT_HOST);
    client.subscribe("vayu/#");    // All air nodes
    client.subscribe("mitti/#");   // All soil nodes
  });

  client.on("message", (topic, message) => {
    try {
      const payload = JSON.parse(message.toString());
      payload._receivedAt = Date.now();

      if (topic.startsWith("vayu/")) {
        handleAirMessage(topic, payload);
      } else if (topic.startsWith("mitti/")) {
        handleSoilMessage(topic, payload);
      }
    } catch (e) {
      console.error("MQTT parse error:", e.message, "topic:", topic);
    }
  });

  client.on("error", (err) => console.error("MQTT error:", err));
  client.on("reconnect", () => console.log("MQTT reconnecting..."));
}

module.exports = { startMqttClient };
```

### 5.4 InfluxDB schema

Two measurements in the bucket `sensor-readings`:

```
Measurement: air_quality
  Tags:   node_id (string), ward_id (string)
  Fields: pm25 (float), pm10 (float), co2 (float), no2 (float),
          temperature (float), humidity (float), aqi (integer),
          source (string: "live"|"fallback_openaq")
  Time:   nanosecond precision unix timestamp

Measurement: soil_health
  Tags:   node_id (string), field_id (string), ward_id (string)
  Fields: moisture (float), ph (float), ec (float), soil_temp (float),
          ml_class (integer), ml_confidence (float),
          source (string: "live"|"fallback_soilgrids")
  Time:   nanosecond precision unix timestamp
```

Query example (Flux) — last reading for a ward:
```flux
from(bucket: "sensor-readings")
  |> range(start: -5m)
  |> filter(fn: (r) => r._measurement == "air_quality")
  |> filter(fn: (r) => r.ward_id == "11")
  |> last()
  |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
```

### 5.5 Node health check state machine

```javascript
// src/services/healthCheck.js

const nodeRegistry = new Map();
// Shape: { id, type, ward_id, field_id, status, lastSeen, fallbackSource }

const STATUS = {
  LIVE: "live",
  FALLBACK: "fallback",
  OFFLINE: "offline",
};

function registerNode(nodeId, type, wardId, fieldId) {
  if (!nodeRegistry.has(nodeId)) {
    nodeRegistry.set(nodeId, {
      id: nodeId,
      type,      // "air" | "soil"
      ward_id: wardId,
      field_id: fieldId,
      status: STATUS.LIVE,
      lastSeen: Date.now(),
      fallbackSource: null,
      battery: null,
      rssi: null,
    });
  }
}

function updateNodeSeen(nodeId, extras = {}) {
  const node = nodeRegistry.get(nodeId);
  if (node) {
    node.lastSeen = Date.now();
    node.status = STATUS.LIVE;
    node.fallbackSource = null;
    if (extras.battery !== undefined) node.battery = extras.battery;
    if (extras.rssi !== undefined) node.rssi = extras.rssi;
  }
}

// Run every HEALTH_CHECK_INTERVAL ms
function startHealthCheckLoop() {
  setInterval(() => {
    const now = Date.now();
    const timeout = parseInt(process.env.NODE_TIMEOUT_MS) || 90000;

    for (const [id, node] of nodeRegistry.entries()) {
      const elapsed = now - node.lastSeen;

      if (elapsed > timeout * 3) {
        node.status = STATUS.OFFLINE;
        broadcastNodeEvent(id, "offline");
      } else if (elapsed > timeout) {
        node.status = STATUS.FALLBACK;
        node.fallbackSource = node.type === "air" ? "openaq" : "soilgrids";
        activateFallback(node);
        broadcastNodeEvent(id, "fallback");
      }
    }
  }, parseInt(process.env.HEALTH_CHECK_INTERVAL) || 30000);
}

module.exports = { nodeRegistry, registerNode, updateNodeSeen, startHealthCheckLoop, STATUS };
```

### 5.6 Complete REST API contract

All endpoints return JSON. Authentication uses Bearer JWT.
Public endpoints (no auth): /api/nodes/status, /api/advisory/latest, /api/ward/board

```
AIR ENDPOINTS
─────────────
GET  /api/air/:ward_id
     Returns: { aqi, pm25, pm10, co2, no2, temp, humidity, source, ts, node_id }

GET  /api/air/:ward_id/history?hours=168&interval=5m
     Returns: { points: [{time, aqi, pm25, no2}], ward_id }

GET  /api/air/all
     Returns: [{ ward_id, aqi, source, ts }] — all wards latest

SOIL ENDPOINTS
──────────────
GET  /api/soil/:field_id
     Returns: { moisture, ph, ec, soil_temp, ml_class, ml_confidence, source, ts, node_id }

GET  /api/soil/:field_id/history?hours=168
     Returns: { points: [{time, ph, moisture, ec}], field_id }

NODE STATUS ENDPOINTS
─────────────────────
GET  /api/nodes/status
     Returns: [{ id, type, ward_id, status, lastSeen, battery, fallbackSource }]
     This is the primary endpoint for the Ward Sensor Grid UI

GET  /api/nodes/:node_id
     Returns: single node detail with 24h uptime history

POST /api/nodes/:node_id/ping
     Body: { lat, lng }
     Used by ESP32 HTTP fallback to register presence

ADVISORY ENDPOINTS
──────────────────
GET  /api/advisory/latest?ward_id=11&field_id=A1
     Returns: latest advisory object

GET  /api/advisory/history?ward_id=11&limit=20
     Returns: [advisory objects]

POST /api/advisory/trigger
     Body: { ward_id, field_id, reason }
     Auth: required
     Triggers agent immediately, returns advisory

WARD ENDPOINTS
──────────────
GET  /api/ward/board
     Returns: [{ ward_id, rank, adjusted_score, trend, pa_count, aqi }]

GET  /api/ward/:ward_id/summary
     Returns: { sensors, avg_aqi, worst_node, best_node, weekly_trend }

GET  /api/ward/:ward_id/nodes
     Returns: all nodes in this ward with full status

GET  /api/ward/:ward_id/governance-pdf
     Auth: required, role=executive
     Returns: PDF buffer as application/pdf

EXPOSURE ENDPOINTS
──────────────────
GET  /api/exposure/:user_id/today
     Returns: { stops, total_dose_ug, cigarette_equiv, weighted_aqi }

POST /api/exposure/log
     Auth: required
     Body: { stops: [{ place, lat, lng, aqi_at_time, duration_min, time }] }
     Returns: { score_delta, new_score, message }

GET  /api/exposure/:user_id/history?days=7
     Returns: [{ date, dose_ug, cigarette_equiv }]

COMMUNITY ENDPOINTS
───────────────────
GET  /api/community/selfies/:ward_id
     Returns: [{ id, thumbnail_url, ts, user_initials }]

POST /api/community/selfie
     Auth: required
     Body: { image_base64, ward_id }
     Returns: { approved, message, wall_entry? }

GET  /api/community/leaderboard/:ward_id
     Returns: [{ rank, display_name, score, badge_count }]

GET  /api/community/rewards/:user_id
     Returns: { score, rank, badges, next_reward, progress_pct }

POST /api/community/action
     Auth: required
     Body: { action_type, metadata }
     action_type: one of "mask_worn"|"alt_route"|"child_indoors"|"soil_compliance"|"report_submitted"
     Returns: { points_earned, new_score, badge_unlocked? }

DATA ENDPOINTS
──────────────
GET  /api/data/export.csv?ward_id=11&days=30
     Returns: CSV file download
     Columns: time, ward_id, pm25, aqi, ph, moisture, ec, source

GET  /api/data/stats
     Returns: { total_readings, nodes_online, wards_covered, advisories_sent }
```

### 5.7 SSE (Server-Sent Events) for live push

```javascript
// src/routes/sse.js
// Frontend subscribes to this to get push updates without polling

const clients = new Set();

function broadcastToClients(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  clients.forEach(client => {
    try { client.write(payload); }
    catch (e) { clients.delete(client); }
  });
}

module.exports = function sseHandler(req, res) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  clients.add(res);

  // Send keepalive every 15s
  const keepalive = setInterval(() => res.write(": ping\n\n"), 15000);

  req.on("close", () => {
    clearInterval(keepalive);
    clients.delete(res);
  });
};

module.exports.broadcastToClients = broadcastToClients;
```

Events broadcast:
- `air_update` — new air reading from any node
- `soil_update` — new soil reading
- `advisory` — new advisory generated
- `node_offline` — node went offline
- `node_fallback` — node switched to fallback
- `node_online` — node came back online
- `selfie_posted` — new mask selfie approved
- `score_update` — user PA score changed

### 5.8 MATI agent (src/agent/mati.js)

```javascript
const Anthropic = require("@anthropic-ai/sdk");
const { tools, dispatchTool } = require("./tools");
const { SYSTEM_PROMPT } = require("./prompts");
const { getClosestTemplate } = require("./templates");

const client = new Anthropic();

async function runMatiAgent(triggerContext) {
  const messages = [
    {
      role: "user",
      content: buildTriggerMessage(triggerContext)
    }
  ];

  // Agentic loop with tool-use
  let response;
  const toolCallLog = [];

  for (let turn = 0; turn < 5; turn++) {
    const TIMEOUT_MS = 8000;
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("LLM_TIMEOUT")), TIMEOUT_MS)
    );

    try {
      response = await Promise.race([
        client.messages.create({
          model: process.env.CLAUDE_MODEL,
          max_tokens: 1024,
          system: SYSTEM_PROMPT,
          tools: tools,
          messages,
        }),
        timeoutPromise
      ]);
    } catch (e) {
      if (e.message === "LLM_TIMEOUT") {
        console.warn("MATI agent timed out, serving template fallback");
        return getClosestTemplate(triggerContext);
      }
      throw e;
    }

    if (response.stop_reason === "end_turn") break;

    // Handle tool use blocks
    const toolUseBlocks = response.content.filter(b => b.type === "tool_use");
    if (toolUseBlocks.length === 0) break;

    const toolResults = [];
    for (const block of toolUseBlocks) {
      toolCallLog.push({ tool: block.name, input: block.input });
      const result = await dispatchTool(block.name, block.input);
      toolResults.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: JSON.stringify(result),
      });
    }

    messages.push({ role: "assistant", content: response.content });
    messages.push({ role: "user", content: toolResults });
  }

  const advisory = extractAdvisory(response);
  advisory.tool_call_log = toolCallLog; // Attach reasoning trace
  return advisory;
}

module.exports = { runMatiAgent };
```

### 5.9 Tool definitions (src/agent/tools.js)

```javascript
// Define all tools MATI can call

const tools = [
  {
    name: "get_air_quality",
    description: "Get current air quality data for a ward including AQI, PM2.5, NO2, CO2, and statistical deviation from baseline",
    input_schema: {
      type: "object",
      properties: {
        ward_id: { type: "string", description: "Ward identifier e.g. '11'" }
      },
      required: ["ward_id"]
    }
  },
  {
    name: "get_soil_health",
    description: "Get current soil health data for a field including pH, moisture, EC, temperature, and TinyML classification",
    input_schema: {
      type: "object",
      properties: {
        field_id: { type: "string", description: "Field identifier e.g. 'A1'" }
      },
      required: ["field_id"]
    }
  },
  {
    name: "get_weather_forecast",
    description: "Get 24h weather forecast from Open-Meteo including wind direction, speed, and precipitation",
    input_schema: {
      type: "object",
      properties: {
        lat: { type: "number" },
        lng: { type: "number" }
      },
      required: ["lat", "lng"]
    }
  },
  {
    name: "send_whatsapp",
    description: "Send a WhatsApp message to one or more registered users. Message should be under 900 characters. Nepali script is supported.",
    input_schema: {
      type: "object",
      properties: {
        recipients: { type: "array", items: { type: "string" } },
        message_en: { type: "string" },
        message_ne: { type: "string", description: "Nepali script version of the advisory" },
        priority: { type: "string", enum: ["normal", "urgent"] }
      },
      required: ["recipients", "message_ne"]
    }
  },
  {
    name: "validate_mask_selfie",
    description: "Check whether an uploaded image shows a person wearing a face mask. Returns mask_detected and confidence.",
    input_schema: {
      type: "object",
      properties: {
        image_base64: { type: "string" },
        media_type: { type: "string", enum: ["image/jpeg", "image/png", "image/webp"] }
      },
      required: ["image_base64", "media_type"]
    }
  }
];

async function dispatchTool(name, input) {
  switch (name) {
    case "get_air_quality":   return fetchAirForAgent(input.ward_id);
    case "get_soil_health":   return fetchSoilForAgent(input.field_id);
    case "get_weather_forecast": return fetchWeatherForAgent(input.lat, input.lng);
    case "send_whatsapp":     return sendWhatsAppFromAgent(input);
    case "validate_mask_selfie": return validateMaskVision(input);
    default: return { error: `Unknown tool: ${name}` };
  }
}

module.exports = { tools, dispatchTool };
```

---

## 6. FRONTEND IMPLEMENTATION

### 6.1 Responsive behavior contract

The app serves two distinct UX modes based on screen width AND user role.

```
Screen < 768px (mobile)          →  Ward Member UX
  - Bottom tab navigation (5 tabs)
  - Full-screen pages
  - Large tap targets (min 48px)
  - Primary focus: personal exposure, rewards, community
  - Secondary: advisory, chat

Screen >= 768px (desktop/tablet) →  Ward Executive UX (if role=executive)
  - Sidebar navigation
  - Multi-column layouts
  - Dense information display
  - Primary focus: ward sensor grid, analytics, governance
  - Secondary: all member features in condensed form

Both screen sizes show:
  - Overview/Dashboard (different layout per size)
  - Advisory cards
  - MATI chat
  - Live AQI indicator
```

Role detection: stored in JWT payload. Two roles: `member` and `executive`.
Login page allows role selection. No verification needed for hackathon demo.

### 6.2 useNodes hook (primary data source for Ward Sensor Grid)

```typescript
// hooks/useNodes.ts
import useSWR from "swr";

export interface NodeStatus {
  id: string;
  type: "air" | "soil";
  ward_id: string;
  field_id?: string;
  status: "live" | "fallback" | "offline";
  lastSeen: number;
  battery: number | null;
  rssi: number | null;
  fallbackSource: string | null;
  // Latest reading snapshot
  latestReading?: Record<string, number | string>;
}

export function useNodes(wardId?: string) {
  const url = wardId
    ? `/api/ward/${wardId}/nodes`
    : `/api/nodes/status`;

  const { data, error, isLoading, mutate } = useSWR<NodeStatus[]>(
    url,
    fetcher,
    { refreshInterval: 30000 } // Poll every 30s
  );

  // Also subscribe to SSE for instant push updates
  useSSE("node_offline",  () => mutate());
  useSSE("node_fallback", () => mutate());
  useSSE("node_online",   () => mutate());

  return { nodes: data ?? [], error, isLoading };
}
```

### 6.3 Ward Sensor Grid component spec

```
SensorGrid component renders all nodes for a ward.
Layout: responsive grid, 2 columns on mobile, 3-4 on desktop.

For each node, SensorCard shows:
  - Node ID and location name
  - Type icon (air vs soil)
  - Status indicator:
      LIVE:     green pulsing dot + "Live · Xs ago"
      FALLBACK: amber static dot + "Fallback · source name"
      OFFLINE:  red static dot  + "Offline · Xm ago"
  - Battery percentage (if available, shown as bar)
  - Signal strength / RSSI (if available)
  - Latest reading preview:
      Air node:  AQI value + PM2.5
      Soil node: pH value + ML class badge
  - Last seen timestamp (relative: "12s ago", "4m ago", "1h ago")

When a node goes offline:
  - Card border turns red
  - NodeOfflineAlert banner appears at top of page
  - Alert says which node is down and what fallback is active
  - Alert is dismissible
  - Ward exec gets WhatsApp notification (auto-sent by backend)

Interaction:
  - Tap/click card → expanded drawer showing 24h history chart
  - Long press / right-click → option to manually trigger fallback check
```

### 6.4 Personal Tracking — intuitive design spec

The exposure tracker must require zero cognitive load to use. One tap per action.

```
RouteLogger component:
  NOT a form with inputs.
  A vertical timeline the user builds by tapping "Add Stop."
  Each stop is auto-timestamped.
  Place is selected from a list of known locations in the ward
  (pre-loaded from constants.ts) OR typed freely.
  AQI at that location is auto-filled from the nearest sensor.
  Duration is entered via a simple slider (0-480 min in 30-min steps).

  Visual: looks like a messaging app — bubbles on a timeline.
  Adding a stop feels like sending a message, not filling a form.

DayTimeline component:
  24-hour horizontal scroll bar.
  Each hour block colored by the AQI the user was in that hour.
  Tapping a block shows: location, AQI, dose accumulated in that hour.
  Summary bar at top: total dose, cigarette equiv, worst hour.

ExposureSummary component:
  Three numbers, always visible:
    1. Today's PM2.5 dose in μg (large number, colored by severity)
    2. Cigarette equivalent (e.g. "2.8 cigarettes")
    3. Difference vs yesterday (up/down arrow + delta)
  Below the numbers: a horizontal dose bar showing where the user
  sits relative to WHO daily limit (15 μg/m³ × 24h = 360 μg daily target).
  The bar fills left-to-right and turns amber at 50%, red at 100%.
```

### 6.5 Rewards and badge system spec

```
PA SCORE
────────
Displayed as a circular ring meter (0-100).
Ring color: green (70+), amber (40-69), red (0-39).
Center: score number in large bold font.
Below: rank in ward ("You are #7 in Ward 11 this week")

BADGE DEFINITIONS (implement as static data in lib/constants.ts)
────────────────────────────────────────────────────────────────
id: "first_report"
  name: "First Step"
  description: "Logged your first exposure report"
  icon: "footprints"
  points: 10
  condition: "exposure_reports >= 1"

id: "mask_hero"
  name: "Mask Hero"
  description: "Wore a mask on a red-AQI day and proved it"
  icon: "shield"
  points: 25
  condition: "selfie_approved >= 1"

id: "clean_commuter"
  name: "Clean Commuter"
  description: "Took alternate route 3 times in a week"
  icon: "route"
  points: 30
  condition: "alt_route_count_7d >= 3"

id: "guardian"
  name: "Guardian"
  description: "Kept a vulnerable person indoors during 2 hazardous events"
  icon: "heart"
  points: 40
  condition: "child_protection_events >= 2"

id: "soil_ally"
  name: "Soil Ally"
  description: "Followed a MATI soil advisory (farmer)"
  icon: "sprout"
  points: 35
  condition: "soil_compliance_events >= 1"

id: "7day_streak"
  name: "7-Day Protector"
  description: "Logged exposure every day for 7 days"
  icon: "flame"
  points: 50
  condition: "log_streak >= 7"

id: "ward_top3"
  name: "Ward Champion"
  description: "Reached top 3 in ward PA leaderboard"
  icon: "trophy"
  points: 100
  condition: "ward_rank <= 3"

BADGE DISPLAY
─────────────
BadgeGrid: 3 columns on mobile, 4 on desktop.
Earned badges: full color + glow effect.
Locked badges: desaturated with lock icon overlay.
Tapping a locked badge shows condition tooltip: "Wear a mask on a red-AQI day"

REWARD CARD
───────────
Shows the next physical reward the user is working toward.
For demo: "Top 3 this month → Subsidized N95 pack"
Progress bar: current score / score needed.
Small print: "Powered by VayuMitti cooperative partnership"
```

---

## 7. FEATURES — COMPLETE LIST WITH IMPLEMENTATION NOTES

### F01: Live Air Monitoring [DEMO CRITICAL]
- Node A publishes every 5s to vayu/node/A1/readings
- Backend ingests, writes to InfluxDB, broadcasts via SSE
- Dashboard AQI gauge and OLED display update in <3s from sensor event
- Fallback to OpenAQ on timeout

### F02: Live Soil Monitoring [DEMO CRITICAL]
- Node B publishes every 5s to mitti/node/B1/readings
- TinyML ml_class (0/1/2) in every payload
- pH calibrated with buffer solutions before event
- Fallback to SoilGrids on timeout

### F03: MATI AI Advisory [DEMO CRITICAL]
- Triggered by: anomaly detection OR manual POST /api/advisory/trigger
- Tool chain: get_air_quality → get_soil_health → get_weather_forecast
- Optional: send_whatsapp if severity >= 2
- Output: structured advisory with reasoning trace
- Fallback: template within 100ms if API timeout

### F04: WhatsApp Advisory [DEMO CRITICAL]
- Twilio sandbox, pre-register all demo phones night before
- Fires for: acid deposition, hazardous AQI, critical soil class
- Message in Nepali script, under 900 characters
- Shown on dashboard in WhatsApp preview card

### F05: Ward Sensor Grid (desktop-primary) [DEMO CRITICAL]
- Route: /ward
- Shows all nodes for the ward with live status
- Color-coded status cards (green/amber/red)
- Node offline alerts as dismissible banners
- Click node → 24h chart drawer
- Auto-refreshes via SSE push

### F06: Personal Exposure Tracker (mobile-primary) [DEMO CRITICAL]
- Route: /exposure
- RouteLogger: add stops by tapping, not typing forms
- DayTimeline: 24h horizontal scroll with AQI-colored hours
- ExposureSummary: dose + cigarette equiv + WHO progress bar
- WeeklyBars: 7-day history

### F07: Mask Selfie Wall [DEMO CRITICAL]
- Camera trigger on advisory card when ward AQI > 150
- Claude vision validation (2s call)
- Circular thumbnails with ward compliance glow state
- Compliance percentage displayed

### F08: Protective Action Score [DEMO CRITICAL]
- Computed on every /api/community/action POST
- Score ring on /rewards page
- Real-time update via SSE score_update event
- MATI writes personalized narrative with score

### F09: Ward Leaderboard [IMPORTANT]
- Top 10 in ward by PA score
- User's own rank always visible even if outside top 10
- Updated on every score change

### F10: Clean Ward Board [IMPORTANT]
- Ranks all monitored wards by adjusted AQI score
- Difficulty multiplier for kiln-adjacent wards
- Shown on /community page
- Weekly digest via WhatsApp every Sunday 8am (cron job)

### F11: Badge System [IMPORTANT]
- 7 badge types defined in constants.ts
- Evaluated on every action POST
- Badge unlock triggers SSE event → toast on frontend
- BadgeGrid shows earned (colored) and locked (greyed)

### F12: Soil pH Story Visualization [IMPORTANT]
- Rectangular element on /farm page
- Color shifts with pH reading: warm brown-green → cold grey-blue
- CSS linear-gradient computed from pH value
- Updates with every SSE soil_update event

### F13: People Counter [IMPORTANT]
- Overview page widget
- Formula: (ward pop estimate) × (fraction in high-AQI zones) × (time-of-day multiplier)
- Updates every 30s with air readings
- Shown as animated counter

### F14: Governance PDF [OPTIONAL]
- Triggered if ward in bottom 3 for 4 consecutive weeks
- pdfkit in Node.js, generated server-side
- Download via GET /api/ward/:id/governance-pdf
- Button on ward executive dashboard

### F15: MATI Chat [IMPORTANT]
- Route: /chat
- Conversational UI with tool-call badges shown inline
- ReasoningTrace: collapsible log of which tools fired
- Prompt injection guard: regex filter on input before sending to API
- Suggested questions grid for quick tap on mobile

### F16: Data Export [OPTIONAL]
- GET /api/data/export.csv
- Download button on /data page
- Include source flag column so users know which readings were fallback

---

## 8. FIRMWARE SPECIFICATIONS

### 8.1 Node A — config.h

```cpp
// config.h — Node A (Air)
#define WIFI_SSID_1       "venue_network_name"
#define WIFI_PASS_1       "venue_network_password"
#define WIFI_SSID_2       "phone_hotspot_name"
#define WIFI_PASS_2       "phone_hotspot_password"

#define MQTT_HOST         "broker.hivemq.com"
#define MQTT_PORT         1883
#define MQTT_TOPIC        "vayu/node/A1/readings"
#define NODE_ID           "A1"
#define WARD_ID           "11"

#define READ_INTERVAL_MS  5000
#define AQI_UNHEALTHY     150
#define AQI_HAZARDOUS     200

// OLED
#define OLED_WIDTH        128
#define OLED_HEIGHT       64
#define OLED_ADDR         0x3C

// Pin assignments
#define PIN_PMS_RX        16
#define PIN_PMS_TX        17
#define PIN_MQ135         34  // ADC1 only
#define PIN_DHT           4
#define PIN_SDA           21
#define PIN_SCL           22
```

### 8.2 Node B — config.h

```cpp
// config.h — Node B (Soil)
#define WIFI_SSID_1       "venue_network_name"
#define WIFI_PASS_1       "venue_network_password"
#define WIFI_SSID_2       "phone_hotspot_name"
#define WIFI_PASS_2       "phone_hotspot_password"

#define MQTT_HOST         "broker.hivemq.com"
#define MQTT_PORT         1883
#define MQTT_TOPIC        "mitti/node/B1/readings"
#define NODE_ID           "B1"
#define WARD_ID           "11"
#define FIELD_ID          "A1"

#define READ_INTERVAL_MS  5000

// pH calibration — FILL IN AFTER CALIBRATION
#define PH_V7             2480    // ADC raw value in pH 7.0 buffer
#define PH_V4             1860    // ADC raw value in pH 4.0 buffer
#define PH_SLOPE          ((7.0f - 4.0f) / (float)(PH_V7 - PH_V4))
#define PH_INTERCEPT      (7.0f - PH_SLOPE * (float)PH_V7)

// Pin assignments — ALL on ADC1 (required with WiFi active)
#define PIN_MOISTURE      32  // ADC1 channel 4
#define PIN_PH            33  // ADC1 channel 5
#define PIN_EC            35  // ADC1 channel 7
#define PIN_DS18B20       26

// CRITICAL: Do not use GPIO 0, 2, 4, 5, 12, 15, 25 with WiFi active
// Do not use ADC2 pins (0, 2, 4, 12, 13, 14, 15, 25, 26, 27) with WiFi
// Exception: GPIO26 for OneWire (digital, not ADC) is fine
```

### 8.3 MQTT payload schema from firmware

Node A publishes this JSON every READ_INTERVAL_MS:
```json
{
  "node_id": "A1",
  "ward_id": "11",
  "ts": 1748419200,
  "pm25": 68.4,
  "pm10": 84.2,
  "co2": 418.0,
  "no2": 0.09,
  "temp": 24.1,
  "humidity": 61.0,
  "aqi": 167,
  "source": "live",
  "rssi": -72,
  "uptime_s": 3602
}
```

Node B publishes this JSON every READ_INTERVAL_MS:
```json
{
  "node_id": "B1",
  "ward_id": "11",
  "field_id": "A1",
  "ts": 1748419200,
  "moisture": 58.2,
  "ph": 6.24,
  "ec": 1.41,
  "soil_temp": 21.3,
  "ml_class": 1,
  "ml_confidence": 0.91,
  "source": "live",
  "rssi": -68,
  "uptime_s": 3598
}
```

---

## 9. DEPLOYMENT

### 9.1 Backend — Railway

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and init
railway login
cd vayu-backend
railway init
railway up

# Set all env vars
railway variables set ANTHROPIC_API_KEY=...
railway variables set INFLUXDB_TOKEN=...
railway variables set TWILIO_ACCOUNT_SID=...
# (set all variables from .env.example)

# Railway auto-detects Node.js, runs npm start
# Add to package.json:
# "scripts": { "start": "node server.js" }
```

### 9.2 Frontend — Vercel

```bash
# Install Vercel CLI
npm install -g vercel

cd vayu-frontend
vercel

# Set env vars
vercel env add NEXT_PUBLIC_BACKEND_URL
# Enter: https://vayu-backend.railway.app

# Production deploy
vercel --prod
```

### 9.3 Pre-event connectivity checklist

```
Night before:
□ Backend deployed and running on Railway
□ Frontend deployed on Vercel
□ HiveMQ broker accessible from both nodes (test with MQTT Explorer)
□ InfluxDB Cloud receiving test writes
□ Twilio WhatsApp sandbox: all demo phones opted in
  (have each phone send "join <sandbox keyword>" to +14155238886)
□ Anthropic API tested with one advisory trigger
□ Both ESP32 nodes publishing to HiveMQ successfully
□ pH calibration done: PH_V7 and PH_V4 values filled in config.h
□ TinyML model integrated in Node B firmware and tested
□ Frontend shows live sensor data from both nodes

At venue (1 hour before demo):
□ Both nodes connected to venue WiFi and publishing
□ If venue WiFi blocked: switch to phone hotspot, verify publishing
□ Recalibrate pH with buffer solutions (temperature change matters)
□ Run full demo sequence once from start to finish with timer
□ Test WhatsApp send to judge phones
□ Verify SSE connection (node status cards updating in real time)
□ Verify advisory trigger fires within 15s of vinegar pour
□ Load the selfie wall with pre-uploaded team selfies
```

---

## 10. DEMO MODE

When DEMO_MODE=true in backend .env, the health check loop publishes synthetic
sensor data at realistic values. This allows full demo of UI without hardware.

```javascript
// Activated by: process.env.DEMO_MODE === "true"
// Injects synthetic readings every 5 seconds
// Values drift slowly with occasional spikes (to trigger advisories)
// Node IDs: A1, B1
// Does NOT send WhatsApp in demo mode (set DEMO_WHATSAPP=true to override)
```

Use demo mode only as absolute last resort if both hardware nodes fail.
Prefer any hardware fallback (HTTP polling, cached readings) over demo mode.
Demo mode is detectable by sharp repeating patterns in the data — judges who
look closely will notice. Label it clearly on screen: "SIMULATION MODE".

---

## 11. CONSTANTS TO CONFIGURE BEFORE BUILD

Edit `vayu-frontend/lib/constants.ts`:

```typescript
export const WARDS = [
  { id: "11", name: "Ward 11 — New Baneshwor", lat: 27.717, lng: 85.324, pop: 32000 },
  { id: "8",  name: "Ward 8 — Bansbari",       lat: 27.725, lng: 85.315, pop: 28000 },
  { id: "15", name: "Ward 15 — Ratnapark",      lat: 27.705, lng: 85.320, pop: 45000 },
  // Add more as deployment scales
];

export const KILN_COORDS = [
  { name: "Bhaktapur Corridor A", lat: 27.672, lng: 85.430 },
  { name: "Sallaghari B",         lat: 27.681, lng: 85.405 },
  { name: "Madhyapur Thimi C",    lat: 27.688, lng: 85.386 },
];

export const AQI_THRESHOLDS = {
  advisory: 100,     // Send advisory
  unhealthy: 150,    // Enable mask selfie button
  hazardous: 200,    // Send urgent WhatsApp
  extreme: 300,      // Maximum emergency alert
};

export const PA_SCORE_WEIGHTS = {
  report_submitted: 20,
  alt_route: 20,
  mask_worn: 20,
  child_indoors: 20,
  soil_compliance: 20,
};

// Ward population estimates for People Counter
export const WARD_POPULATIONS: Record<string, number> = {
  "11": 32000,
  "8":  28000,
  "15": 45000,
};

// WHO daily PM2.5 limit in μg/m³ × 24h
export const WHO_DAILY_LIMIT_UG = 360;
```

---

## 12. TESTING PLAN

### Unit tests (run before deploying)
```bash
# Backend
cd vayu-backend
npm test
# Test: MQTT handler parses valid payloads
# Test: AQI threshold triggers advisory
# Test: Health check state machine transitions correctly
# Test: PA score computation with known inputs
# Test: Template fallback returns within 100ms

# Frontend
cd vayu-frontend
npm test
# Test: AQI color function returns correct colors
# Test: Cigarette equiv calculation matches reference values
# Test: SensorCard renders correct status for all three states
```

### Integration test (hardware required)
1. Power Node A. Verify reading appears in MQTT Explorer.
2. Verify reading appears in InfluxDB Cloud within 5s.
3. Verify dashboard AQI updates within 5s.
4. Unplug Node A WiFi. Wait 90s. Verify fallback label appears.
5. Restore Node A WiFi. Verify live label returns.
6. Pour vinegar into soil pot. Verify pH drops in <5s on dashboard.
7. Trigger POST /api/advisory/trigger. Verify WhatsApp sent within 15s.
8. Upload mask selfie via Community page. Verify appears on wall.
9. Submit PA action. Verify score ring updates.

---

End of VAYU_BLUEPRINT.md
This file is the single source of truth for VayuMitti V2 implementation.
All code written for this project should conform to the specifications above.