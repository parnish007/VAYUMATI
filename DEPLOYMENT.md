# VayuMitti — Deployment Guide

This document covers deploying the **frontend** (Vercel) and **backend** (Railway or Render) separately.
Demo mode works with zero external services. Live mode uses real sensor data via MQTT + InfluxDB.

---

## IMPORTANT: Backend Cannot Go on Vercel

The backend uses:
- A persistent **MQTT client** that stays connected to HiveMQ 24/7
- A `setInterval` **health check loop** that runs every 30 seconds
- **Long-lived SSE connections** (EventSource) for push updates to the frontend

Vercel is **serverless** — every request spins up a fresh isolated function. Persistent connections and timers die immediately. **The backend must run on a process-based host.**

**Recommended: Railway** (free tier, no credit card required)
**Alternative: Render** (free tier, spins down after 15 min inactivity — not ideal for demo)

---

## Part 1 — Backend on Railway

### 1.1 Create a Railway project

1. Go to railway.app → New Project → Deploy from GitHub repo
2. Select the monorepo root. Railway will prompt you to set the root directory.
3. Set **root directory** to `vayu-backend`
4. Railway detects `package.json` and runs `npm start` automatically.

### 1.2 Environment variables

Set these in Railway → your service → Variables tab. Every variable below is required for live mode. For demo-only mode, only the ones marked **[DEMO]** are needed.

```
# ── Core ──────────────────────────────────────────────────────────────────────
NODE_ENV=production
PORT=3001                    # Railway overrides this with its own port, leave as-is

# ── CORS ──────────────────────────────────────────────────────────────────────
FRONTEND_URL=https://your-app.vercel.app   # [DEMO] exact Vercel URL, no trailing slash

# ── Auth ──────────────────────────────────────────────────────────────────────
JWT_SECRET=<64-char random string>         # [DEMO] generate: openssl rand -hex 32
JWT_EXPIRY=7d

# ── MQTT (HiveMQ public broker) ───────────────────────────────────────────────
MQTT_HOST=broker.hivemq.com
MQTT_PORT=1883
MQTT_USERNAME=                             # leave blank for HiveMQ public broker
MQTT_PASSWORD=                             # leave blank for HiveMQ public broker

# ── InfluxDB Cloud ────────────────────────────────────────────────────────────
# Skip these three for demo-only. The routes fall back to Open-Meteo automatically.
INFLUXDB_URL=https://us-east-1-1.aws.cloud2.influxdata.com
INFLUXDB_TOKEN=<your InfluxDB API token>
INFLUXDB_ORG=vayu-mitti
INFLUXDB_BUCKET=sensor-readings

# ── Anthropic (MATI agent) ────────────────────────────────────────────────────
ANTHROPIC_API_KEY=<your Anthropic API key>
CLAUDE_MODEL=claude-sonnet-4-6

# ── Twilio WhatsApp ───────────────────────────────────────────────────────────
TWILIO_ACCOUNT_SID=<your Twilio account SID>
TWILIO_AUTH_TOKEN=<your Twilio auth token>
TWILIO_WA_FROM=whatsapp:+14155238886

# ── Fallback APIs (no keys, just override URLs if needed) ────────────────────
OPENMETEO_API_URL=https://api.open-meteo.com/v1

# ── Default location (Thimi, Ward 11, Bhaktapur) ─────────────────────────────
DEFAULT_WARD_ID=11
DEFAULT_FIELD_ID=A1
DEFAULT_LAT=27.717
DEFAULT_LNG=85.324

# ── Health check tuning ───────────────────────────────────────────────────────
HEALTH_CHECK_INTERVAL=30000   # ms between node health checks
NODE_TIMEOUT_MS=90000         # ms of silence before node goes FALLBACK

# ── Demo flag ────────────────────────────────────────────────────────────────
DEMO_MODE=false               # keep false; demo mode is controlled by the frontend
```

### 1.3 Verify the deploy

After Railway deploys (takes ~60 s), hit the health endpoint:

```
curl https://your-backend.railway.app/health
# → {"status":"ok","ts":1234567890123}
```

Test the air fallback (works without any sensors or InfluxDB):

```
curl https://your-backend.railway.app/api/air/11
# → {"ward_id":"11","node_id":"fallback","aqi":...,"source":"fallback_openaq",...}
```

Test the soil fallback:

```
curl https://your-backend.railway.app/api/soil/A1
# → {"ward_id":"11","field_id":"A1","node_id":"fallback","ph":...,"source":"fallback_soilgrids",...}
```

If `INFLUXDB_*` vars are not set, both endpoints automatically call Open-Meteo / SoilGrids and return real atmospheric data — no sensors needed.

---

## Part 2 — Frontend on Vercel

### 2.1 Create a Vercel project

1. Go to vercel.com → Add New Project → Import from GitHub
2. Select the monorepo root. Vercel will prompt for the root directory.
3. Set **root directory** to `vayu-frontend`
4. Framework preset: **Next.js** (auto-detected)
5. Deploy.

### 2.2 Environment variables

Set these in Vercel → your project → Settings → Environment Variables.
Apply to **Production**, **Preview**, and **Development** environments.

```
# ── Backend URL ───────────────────────────────────────────────────────────────
NEXT_PUBLIC_BACKEND_URL=https://your-backend.railway.app
# Must be the exact Railway URL. No trailing slash.

# ── Default ward & coordinates ────────────────────────────────────────────────
NEXT_PUBLIC_DEFAULT_WARD=11
NEXT_PUBLIC_DEFAULT_LAT=27.717
NEXT_PUBLIC_DEFAULT_LNG=85.324
```

That is all the frontend needs. Everything else is resolved at runtime from the backend.

### 2.3 Verify the deploy

After Vercel deploys (~90 s), open the app. In demo mode (default), it loads instantly with no backend calls. To test live mode:

1. Toggle the demo/live switch in the app header
2. The dashboard should show AQI data from the backend fallback chain (Open-Meteo)
3. Open browser DevTools → Network → filter `live` → confirm the SSE connection opens

---

## Part 3 — InfluxDB Cloud Setup (for live sensor data)

Only needed when actual ESP32 nodes are connected.

1. Create a free account at cloud2.influxdata.com
2. Create an organisation named `vayu-mitti`
3. Create a bucket named `sensor-readings` with **30-day retention**
4. Generate an **All Access** API token (Data → API Tokens → Generate)
5. Copy the token and your cluster URL into the Railway env vars

The backend writes to InfluxDB automatically when MQTT messages arrive from Node A / Node B.

---

## Part 4 — HiveMQ Setup (for live sensor data)

The public HiveMQ broker (`broker.hivemq.com:1883`) allows anonymous connections with no setup. Both the backend and the ESP32 nodes connect to it directly.

**Limits:** 100 simultaneous connections, 10 MB/s throughput. Fine for the demo — only 3 clients connect (Node A, Node B, backend).

For a private broker: create a free HiveMQ Cloud account, add the username/password to both the Railway env vars (`MQTT_USERNAME`, `MQTT_PASSWORD`) and the firmware `config.h`.

---

## Part 5 — Twilio WhatsApp Setup (for demo beat 5)

1. Create a Twilio account → go to Messaging → Try it out → Send a WhatsApp message
2. Note your sandbox keyword (e.g. `join copper-spider`)
3. **Every phone that will receive a WhatsApp during the demo** must opt in first:
   - Send `join <your-keyword>` to `+14155238886` on WhatsApp
   - Wait for confirmation reply
4. Add `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` to Railway env vars

---

## Part 6 — Demo Mode vs Live Mode

| | Demo mode | Live mode |
|---|---|---|
| Frontend toggle | On (default) | Off |
| Air data source | Static `DEMO_AIR` from `demoData.ts` | `GET /api/air/11` → InfluxDB → Open-Meteo |
| Soil data source | Static `DEMO_SOIL` | `GET /api/soil/A1` → InfluxDB → SoilGrids |
| Node status | Static `DEMO_NODES` | `GET /api/nodes/status` → nodeRegistry |
| Advisor | Static `DEMO_ADVISORY` | `POST /api/advisory/trigger` → MATI agent |
| Chat | Local keyword matching | Backend MATI chat |
| MQTT required | No | Yes |
| InfluxDB required | No | No (fallback to Open-Meteo) |
| Sensors required | No | No (fallback to Open-Meteo) |

**For the hackathon demo:** leave demo mode ON for the pitch. Only switch to live mode when showing the sensor-triggered advisory (Beat 4) — confirm the backend is reachable first.

**Fallback chain when live mode has no sensors:**

```
MQTT message arrives → InfluxDB write → SSE push → dashboard updates (< 3 s)
         ↓ (if no MQTT in 90 s)
Backend health check → fetches Open-Meteo AQ → SSE push with source="fallback_openaq"
         ↓ (if Open-Meteo fails)
HTTP GET /api/air/11 → tries InfluxDB → tries Open-Meteo → returns best available data
         ↓ (last resort)
Dashboard shows last known reading with "Offline · last seen Xm ago" label
```

---

## Part 7 — Deploy Readiness Checklist

### Backend

- [x] `npm start` runs `node server.js`
- [x] `GET /health` returns `{"status":"ok"}`
- [x] `GET /api/air/:ward_id` — queries InfluxDB, falls back to Open-Meteo automatically
- [x] `GET /api/soil/:field_id` — queries InfluxDB, falls back to SoilGrids automatically
- [x] `GET /api/nodes/status` — returns live nodeRegistry
- [x] `GET /api/live` — SSE endpoint with keepalive
- [x] `POST /api/advisory/trigger` — runs MATI agent, returns advisory
- [x] SIGTERM / SIGINT graceful shutdown (MQTT disconnect + InfluxDB flush)
- [x] CORS configured via `FRONTEND_URL` env var
- [ ] `FRONTEND_URL` set to exact Vercel URL in Railway
- [ ] `JWT_SECRET` set in Railway
- [ ] `ANTHROPIC_API_KEY` set in Railway (needed for MATI advisor)
- [ ] `TWILIO_*` set in Railway (needed for WhatsApp beat)
- [ ] Demo phones opted in to Twilio sandbox

### Frontend

- [x] Next.js builds cleanly (`npx tsc --noEmit --skipLibCheck` passes)
- [x] `next.config.ts` has no invalid keys
- [x] Demo mode works with zero backend calls
- [x] Live mode calls `NEXT_PUBLIC_BACKEND_URL` correctly
- [x] SSE hook reconnects automatically on disconnect
- [ ] `NEXT_PUBLIC_BACKEND_URL` set to Railway URL in Vercel dashboard
- [ ] Vercel production URL added as `FRONTEND_URL` in Railway

### Pre-demo checklist (day of)

1. `curl https://your-backend.railway.app/health` → `{"status":"ok"}`
2. `curl https://your-backend.railway.app/api/air/11` → returns AQI (not error)
3. Open frontend → switch to live mode → AQI tile shows data (not "–")
4. DevTools → Network → EventSource `/api/live` → connection stays open
5. Send WhatsApp opt-in from demo phones if not done yet
6. Drop p1–p9.jpg masked selfie photos in `vayu-frontend/public/demo-selfies/`

---

## Quick Reference — Environment Variables by Service

### Railway (backend)

| Variable | Where to get it |
|---|---|
| `FRONTEND_URL` | Your Vercel project URL |
| `JWT_SECRET` | Run: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys |
| `INFLUXDB_URL` | InfluxDB Cloud → Organization → Cluster URL |
| `INFLUXDB_TOKEN` | InfluxDB Cloud → Data → API Tokens → Generate |
| `TWILIO_ACCOUNT_SID` | console.twilio.com → Account Info |
| `TWILIO_AUTH_TOKEN` | console.twilio.com → Account Info |

### Vercel (frontend)

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_BACKEND_URL` | Your Railway service URL (e.g. `https://vayu-backend-production.up.railway.app`) |
| `NEXT_PUBLIC_DEFAULT_WARD` | `11` |
| `NEXT_PUBLIC_DEFAULT_LAT` | `27.717` |
| `NEXT_PUBLIC_DEFAULT_LNG` | `85.324` |
