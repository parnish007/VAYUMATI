# CLAUDE.md — VayuMitti Project Intelligence
## Read this file completely before touching any code.
## This file is your ground truth for every decision in this project.

---

## WHO YOU ARE IN THIS PROJECT

You are the primary engineer on VayuMitti — an environmental intelligence platform for Nepal.
You are building it for ECOTHON PRAKRITI 2026, a hackathon with real judges, real sensors,
and a live demo. Every decision you make has a deadline attached to it.

Your priorities in order:
1. The demo works flawlessly on stage. Hardware, WiFi, advisory, WhatsApp — all live.
2. The code is clean enough to explain to a judge who asks to see it.
3. Features marked [DEMO CRITICAL] ship before features marked [IMPORTANT] or [OPTIONAL].
4. Nothing breaks silently. Every failure mode has a fallback that announces itself visibly.

---

## PROJECT DOCUMENTS — READ THESE IN ORDER

Before writing any code in a new session, read these files:

1. CLAUDE.md (this file) — ground truth for all decisions
2. VAYU_BLUEPRINT.md — complete technical specification, API contract, feature list
3. vayu_uxreference.html — visual reference for all UI components (open in browser)

If you have not read all three, stop and read them before proceeding.

Location of documents:
- CLAUDE.md → repo root (where you are reading this)
- VAYU_BLUEPRINT.md → repo root
- vayu_uxreference.html → repo root

---

## REPOSITORY STRUCTURE

```
vayu-mitti/               ← repo root, where CLAUDE.md lives
├── CLAUDE.md             ← YOU ARE HERE
├── VAYU_BLUEPRINT.md     ← full specification
├── vayu_uxreference.html ← visual UX reference
├── vayu-backend/         ← Node.js 20 + Express 4, deploy to Railway
├── vayu-frontend/        ← Next.js 14 App Router, deploy to Vercel
└── vayu-firmware/        ← Arduino/PlatformIO ESP32 firmware
    ├── node-a-air/       ← Air node (PMS5003 + MQ135 + DHT22 + OLED)
    └── node-b-soil/      ← Soil node (pH + EC + moisture + DS18B20 + TinyML)
```

---

## TECH STACK — LOCKED. DO NOT CHANGE WITHOUT ASKING.

### Backend (vayu-backend/)
- Runtime: Node.js 20
- Framework: Express 4
- MQTT broker: HiveMQ Cloud free tier (NOT local Mosquitto — must survive Railway restart)
- Database: InfluxDB Cloud free tier (NOT local — must survive Railway restart)
- AI agent: Anthropic SDK, model `claude-sonnet-4-6` (updated from claude-sonnet-4-20250514 which EOLs 2026-06-15)
- WhatsApp: Twilio sandbox (sid from env)
- Auth: JWT, bcryptjs
- File uploads: Multer + sharp
- PDF: pdfkit
- Deployment: Railway (auto-deploy from main branch)

### Frontend (vayu-frontend/)
- Framework: Next.js 14 with App Router
- Language: TypeScript (strict mode)
- Styling: Tailwind CSS only (no external component libraries except Radix primitives)
- Data fetching: SWR for polling, custom useSSE hook for push
- Maps: Leaflet + react-leaflet (CartoDB dark tiles, NO Google Maps API)
- Charts: Recharts only
- Animation: Framer Motion for page transitions only
- Icons: Lucide React
- Fonts: Fraunces (display, serif) + Instrument Sans (body)
- Deployment: Vercel (auto-deploy from main branch)

### Firmware (vayu-firmware/)
- Framework: Arduino (NOT PlatformIO unless user specifies)
- Libraries: PubSubClient (MQTT), Adafruit_SSD1306 (OLED), DHT (DHT22),
             SoftwareSerial (PMS5003), OneWire + DallasTemperature (DS18B20)
- TinyML: m2cgen exported C function, included as soil_model.h

---

## ARCHITECTURAL DECISIONS — WHY THINGS ARE BUILT THIS WAY

### Why HiveMQ instead of local Mosquitto?
Railway containers restart. A local broker loses all MQTT connections on restart.
HiveMQ Cloud free tier persists across restarts. Both ESP32 nodes connect to it
directly. The backend subscribes to it. No gateway needed.

### Why InfluxDB Cloud instead of SQLite or PostgreSQL?
Sensor data is time-series by nature. InfluxDB returns a 7-day chart of 5-second
readings (120,960 points) in under 100ms. SQLite would take several seconds.
The free tier (10GB storage, 30-day retention) is more than enough for the hackathon.

### Why SSE instead of WebSocket for live push?
SSE is unidirectional (server→client) which is all we need for sensor updates.
It works through proxies and firewalls better than WebSocket, which matters at
a venue with restrictive network configuration. SSE is also simpler to implement
and debug. The SSE endpoint is GET /api/live.

### Why SWR instead of React Query or TanStack?
SWR has a smaller bundle, simpler API, and the revalidation model (stale-while-revalidate)
maps perfectly to sensor data polling: show the last known value immediately, fetch
fresh data in the background. The refreshInterval option in useNodes, useAir, useSoil
hooks handles the 30-second polling cycle.

### Why two separate WiFi credentials in firmware?
Venue networks at hackathons are unpredictable. The ESP32 tries the venue SSID first.
If not connected in 15 seconds, it falls back to the team phone hotspot. This is
implemented in the firmware WiFi connection loop, not in the backend. The backend
does not need to know about this — it just receives MQTT messages regardless of
which network the node used.

### Why ADC1 only on Node B?
ESP32 ADC2 pins are shared with the WiFi radio. When WiFi is active (which it always
is in our case), ADC2 returns garbage values. All four analog sensors on Node B
(moisture: GPIO32, pH: GPIO33, EC: GPIO35, plus spare: GPIO34) use ADC1 channels only.
GPIO26 for DS18B20 is digital OneWire, not ADC — it's fine.

---

## ENVIRONMENT VARIABLES

### Backend — vayu-backend/.env
All keys are in VAYU_BLUEPRINT.md Section 4. Summary of critical ones:

```
ANTHROPIC_API_KEY       → Anthropic console
CLAUDE_MODEL            → claude-sonnet-4-20250514   ← exact string
INFLUXDB_URL            → InfluxDB Cloud URL
INFLUXDB_TOKEN          → InfluxDB API token
INFLUXDB_ORG            → vayu-mitti
INFLUXDB_BUCKET         → sensor-readings
MQTT_HOST               → broker.hivemq.com
MQTT_PORT               → 1883
TWILIO_ACCOUNT_SID      → Twilio console
TWILIO_AUTH_TOKEN       → Twilio console
TWILIO_WA_FROM          → whatsapp:+14155238886
JWT_SECRET              → random 64-char string
FRONTEND_URL            → https://vayu-mitti.vercel.app
DEMO_MODE               → false (set true only as last resort)
```

### Frontend — vayu-frontend/.env.local
```
NEXT_PUBLIC_BACKEND_URL → https://vayu-backend.railway.app
NEXT_PUBLIC_WS_URL      → wss://vayu-backend.railway.app
NEXT_PUBLIC_DEFAULT_WARD → 11
NEXT_PUBLIC_DEFAULT_LAT  → 27.717
NEXT_PUBLIC_DEFAULT_LNG  → 85.324
```

Never commit .env or .env.local to git.
The .gitignore must include both from project init.

---

## FEATURE PRIORITY

### [DEMO CRITICAL] — must work before anything else
These fail = demo fails = hackathon loss.

- F01: Node A publishes air readings to HiveMQ → backend ingests → InfluxDB writes → SSE push → dashboard AQI updates in <3s
- F02: Node B publishes soil readings → same pipeline → pH updates in <3s
- F03: MATI agent triggered by anomaly OR manual POST → advisory appears on dashboard in <15s
- F04: WhatsApp advisory fires to registered demo phone → judge watches it arrive
- F05: Ward Sensor Grid shows node status (live/fallback/offline) with SSE push
- F06: Personal exposure tracker — route logger and day timeline work on mobile
- F07: Mask selfie — camera, upload, Claude vision validation, appears on wall
- F08: PA score — updates on every action POST, score ring animates

### [IMPORTANT] — ship after DEMO CRITICAL items pass
- F09: Ward leaderboard
- F10: Clean Ward Board with difficulty-adjusted scores
- F11: Badge system — 7 badge types, unlock detection
- F12: Soil pH cross-section visualization (color shifts with pH reading)
- F13: People counter widget on overview

### [OPTIONAL] — ship if time permits
- F14: Governance PDF generation
- F15: MATI chat (full conversational interface)
- F16: Data export CSV

---

## CODING CONVENTIONS

### TypeScript
- Strict mode is on. No `any` types without a comment explaining why.
- All API response types are defined in vayu-frontend/types/index.ts.
- Use `unknown` instead of `any` for untyped external data (API responses before validation).

### API calls from frontend
All backend calls go through lib/api.ts typed wrappers. Never call fetch() directly
in a component. Pattern:
```typescript
// lib/api.ts
export async function getAirQuality(wardId: string): Promise<AirReading> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/air/${wardId}`);
  if (!res.ok) throw new Error(`Air API error: ${res.status}`);
  return res.json();
}
```

### React components
- Every component that fetches data uses a SWR hook from hooks/
- No fetch() calls inside React components
- No useEffect for data fetching — use SWR
- Loading states use the Skeleton component from components/ui/Skeleton.tsx
- Error states show a red pill with the fallback source name, not a blank space

### Node.js backend
- All route handlers use async/await, never callbacks
- All errors caught with try/catch and returned as { error: string } with correct status code
- No console.log in production — use a consistent logger (just use console with a prefix: `[MATI]`, `[MQTT]`, `[HEALTH]`)
- All Anthropic API calls wrapped in the 8-second timeout promise pattern from VAYU_BLUEPRINT.md Section 5.8

### CSS
- Tailwind only. No custom CSS files unless adding to globals.css for font-face imports.
- Color palette defined in tailwind.config.ts as custom colors matching the UX reference.
- Dark theme only. No light mode toggle needed.
- Responsive: mobile-first. `md:` breakpoint = desktop executive view.

---

## MOBILE VS DESKTOP BEHAVIOR CONTRACT

This is critical for every page you build.

```
< 768px  →  Ward Member UX
  - Bottom tab navigation (5 tabs: Home, Map, Exposure, Rewards, Community)
  - Full-screen single-column pages
  - Min tap target 48px
  - Primary: personal exposure, rewards, community mask wall
  - No sidebar ever

≥ 768px  →  Ward Executive UX (role=executive) OR expanded Member UX
  - Sidebar navigation (180px fixed)
  - Multi-column layouts (use CSS Grid)
  - Dense information display
  - Primary: sensor grid, analytics, advisory feed, governance
```

Role is stored in JWT payload field `role`. Two values: `"member"` and `"executive"`.
Check role in the App layout component and render the appropriate nav component.

---

## SENSOR DATA PIPELINE — TRACE IT MENTALLY BEFORE DEBUGGING

```
ESP32 Node A/B
  → reads sensors every 5s
  → publishes JSON to HiveMQ (broker.hivemq.com:1883)
  → topic: vayu/node/A1/readings OR mitti/node/B1/readings

Backend (Railway)
  → MQTT client subscribed to vayu/# and mitti/#
  → airHandler.js or soilHandler.js processes payload
  → writes to InfluxDB Cloud (tagged with node_id, ward_id)
  → updates nodeRegistry in memory (for health check state)
  → calls checkAirAnomalies() or checkSoilAnomalies()
  → if anomaly: calls triggerAgent() → runMatiAgent()
  → advisory stored + sent via Twilio WhatsApp
  → SSE broadcast: broadcastToClients("air_update", payload)

Frontend (Vercel)
  → useSSE hook listening to GET /api/live
  → receives "air_update" event → calls mutate() on useAir hook
  → SWR refetches GET /api/air/:ward_id
  → AQI gauge, sensor rows, people counter all re-render
```

If something is not updating, trace this pipeline. The most common failure points:
1. MQTT subscription — check HiveMQ dashboard for connected clients
2. InfluxDB write — check InfluxDB Cloud data explorer
3. SSE connection — check browser DevTools → Network → EventStream
4. SWR cache — check if mutate() is being called on the right key

---

## INFLUXDB QUERY PATTERNS

Use these exact patterns. Do not invent new Flux syntax without testing.

### Latest reading for a ward:
```flux
from(bucket: "sensor-readings")
  |> range(start: -5m)
  |> filter(fn: (r) => r._measurement == "air_quality" and r.ward_id == "11")
  |> last()
  |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
```

### 7-day history at 5-minute aggregation:
```flux
from(bucket: "sensor-readings")
  |> range(start: -168h)
  |> filter(fn: (r) => r._measurement == "air_quality" and r.ward_id == "11")
  |> filter(fn: (r) => r._field == "aqi" or r._field == "pm25")
  |> aggregateWindow(every: 5m, fn: mean, createEmpty: false)
```

### 30-day rolling baseline (for anomaly detection):
```flux
from(bucket: "sensor-readings")
  |> range(start: -720h)
  |> filter(fn: (r) => r._measurement == "air_quality" and r.ward_id == "11" and r._field == "no2")
  |> mean()
```

---

## FALLBACK CHAIN — IMPLEMENT THIS EXACTLY

Every data source has a fallback. The UI always shows data, never a blank card.
The fallback source is labeled on the UI — never hidden.

```
Node status: LIVE
  → Source: ESP32 sensor via HiveMQ
  → UI label: green dot + "Live · Xs ago"

Node status: FALLBACK (triggered after 90s no data)
  → Air: Open-Meteo Air Quality API (free, no key)
       GET https://air-quality-api.open-meteo.com/v1/air-quality
           ?latitude=LAT&longitude=LNG&hourly=pm10,pm2_5,nitrogen_dioxide,carbon_monoxide
       Returns: pm10, pm2_5 (→ AQI via EPA NowCast), nitrogen_dioxide, carbon_monoxide
       Note: OpenAQ v2 deprecated (410), v3 requires paid API key as of 2024.
  → Soil: SoilGrids ISRIC REST API for pH (free, no key, 250m resolution)
       GET https://rest.soilgrids.org/soilgrids/v2.0/properties/query
           ?lon=LNG&lat=LAT&property=phh2o&property=ocd&depth=0-5cm&value=mean
       phh2o is returned in tenths of pH; divide by 10 for standard scale.
       Moisture + temperature from Open-Meteo forecast (api.open-meteo.com/v1/forecast).
       EC has no free public fallback — returns null.
       pH is guaranteed non-null: falls back to 6.2 (Kathmandu Valley regional
       estimate for loam 0-5cm) if SoilGrids is unreachable.
  → UI label: amber dot + "Fallback · Open-Meteo" or "Fallback · SoilGrids"
  → Source field in payload: "fallback_openaq" or "fallback_soilgrids"

Node status: OFFLINE (triggered after 270s no data)
  → Air: use last known reading from InfluxDB + timestamp warning
  → Soil: use last known reading
  → UI label: red dot + "Offline · last seen Xm ago"

MATI agent: API timeout (8s)
  → Serve closest template from advisory_templates.json
  → Match by Euclidean distance in (aqi, ph, moisture, ec) space
  → UI label: small "cached advisory" chip on the advisory card
```

---

## AQI CALCULATION — USE THIS FORMULA EVERYWHERE

EPA NowCast piecewise linear formula. Use this in both firmware (C) and backend (JS).
Never calculate AQI differently in two places.

```javascript
// lib/aqi.ts — canonical implementation
function aqiFromPm25(C: number): number {
  const breakpoints = [
    [0.0, 12.0,   0,  50],
    [12.1, 35.4,  51, 100],
    [35.5, 55.4, 101, 150],
    [55.5, 150.4, 151, 200],
    [150.5, 250.4, 201, 300],
    [250.5, 500.4, 301, 500],
  ];
  for (const [Clo, Chi, Ilo, Ihi] of breakpoints) {
    if (C >= Clo && C <= Chi) {
      return Math.round(((Ihi - Ilo) / (Chi - Clo)) * (C - Clo) + Ilo);
    }
  }
  return 500;
}

function aqiColor(aqi: number): string {
  if (aqi <= 50)  return "#3d8b5e"; // good — sage green
  if (aqi <= 100) return "#d4a017"; // moderate — amber
  if (aqi <= 150) return "#e8600a"; // sensitive — orange
  if (aqi <= 200) return "#c44b2b"; // unhealthy — rust
  if (aqi <= 300) return "#7b2d8b"; // very unhealthy — purple
  return "#7b0000";                  // hazardous — dark red
}

function aqiLabel(aqi: number): string {
  if (aqi <= 50)  return "Good";
  if (aqi <= 100) return "Moderate";
  if (aqi <= 150) return "Unhealthy for Sensitive Groups";
  if (aqi <= 200) return "Unhealthy for All";
  if (aqi <= 300) return "Very Unhealthy";
  return "Hazardous";
}

function cigaretteEquiv(dailyDoseUg: number): number {
  // WHO reference: 1 cigarette ≈ 120μg/m³ × ~22L/min × ~600min/day inhaled PM2.5
  // Simplified: 1 cigarette equiv = ~120μg daily dose
  return Math.round((dailyDoseUg / 120) * 10) / 10;
}
```

---

## PROTECTIVE ACTION SCORE — CANONICAL COMPUTATION

Computed server-side in src/services/scoring.js. Do not compute it in the frontend.

```javascript
const PA_WEIGHTS = {
  report_submitted: 20,   // User submitted any commute report
  alt_route: 20,          // User took route with AQI ≥30 lower when ward AQI ≥150
  mask_worn: 20,          // User uploaded approved mask selfie on high-AQI day
  child_indoors: 20,      // User reported keeping child/elderly indoors during AQI ≥200
  soil_compliance: 20,    // Farmer: did not fertilize during active delay advisory
};

// Non-farmers get full soil_compliance points automatically (20 pts)
// Score = sum of earned points, max 100
// Score is per-week, resets Monday 00:00 Nepal time (UTC+5:45)
```

---

## BADGE UNLOCK CONDITIONS

Defined in vayu-frontend/lib/constants.ts. Evaluated server-side on every
POST /api/community/action. Badge unlock triggers SSE event "badge_unlocked".

```
first_report    → exposure_reports_total >= 1
mask_hero       → selfie_approved_total >= 1
clean_commuter  → alt_route_count_last_7d >= 3
guardian        → child_protection_events >= 2
soil_ally       → soil_compliance_events >= 1 (farmers only, skip for members)
7day_streak     → log_streak_days >= 7
ward_top3       → ward_rank <= 3
```

---

## MATI AGENT — SYSTEM PROMPT PRINCIPLES

The system prompt is in src/agent/prompts.js. Never put environmental advice
or agricultural science facts in the system prompt — MATI calls tools for data.
The system prompt defines identity, tone, and reasoning style only.

Key constraints MATI must always follow (enforce in system prompt):
- Never fabricate sensor readings. If a tool returns no data, say so explicitly.
- Always cite the data source in every advisory.
- When fallback data is active, say "this reading is from [source], not a live sensor."
- Keep farmer advisories under 900 characters (WhatsApp limit with Nepali script).
- Always include confidence level (0.0 to 1.0) in every advisory output.
- Always look for the acid deposition pattern: NO2 spike + pH drop in same geographic area within 72h.

Prompt injection guard: before sending any user input to the Claude API,
run it through the INJECTION_RE regex in src/agent/mati.js:
```javascript
const INJECTION_RE = /(ignore previous|system prompt|developer mode|reveal.*prompt|jailbreak|override.*instruction|forget.*rules|hidden instruction|bypass safety)/i;
```
If matched, return a canned refusal without calling the API.

---

## WARD BOARD SCORING FORMULA

```javascript
// src/services/leaderboard.js
function computeWardScore(ward) {
  const baseScore = Math.max(0, 100 - (ward.current_aqi / 3));
  const trendBonus = ward.aqi_7d_trend < 0 ? 10 : ward.aqi_7d_trend > 5 ? -10 : 0;
  const kilnMultiplier = ward.nearest_kiln_km < 2.0 ? 1.15 : 1.0;
  const paBonus = ward.collective_pa_score > 60 ? 5 : 0;
  return Math.round((baseScore + trendBonus) * kilnMultiplier + paBonus);
}
// Higher is better. Max theoretical: ~130 for a clean ward with kiln adjustment.
```

---

## THINGS THAT WILL BREAK THE DEMO — MEMORISE THESE

1. ADC2 pins on Node B with WiFi active → garbage sensor values
   FIX: Only use GPIO32, GPIO33, GPIO34, GPIO35 (all ADC1) for analog sensors.

2. pH sensor not calibrated at venue temperature
   FIX: Recalibrate with buffer solutions at venue, not just at home.
   Record V7 and V4 in a text file. Update config.h. Reflash Node B.

3. HiveMQ free tier client limit (100 simultaneous connections)
   FIX: Only three clients connect: Node A, Node B, and the backend subscriber.
   Never run multiple backend instances without checking connection count.

4. InfluxDB free tier rate limit (5MB/5min write limit)
   FIX: Both nodes write every 5 seconds = 12 writes/min.
   Batch writes using the InfluxDB client's WritePrecision and batch option.

5. Twilio WhatsApp sandbox — recipient phones must opt in first
   FIX: Every phone that will receive a demo WhatsApp must send the opt-in
   message to +14155238886 before the presentation starts.
   Format: "join <sandbox-keyword>" (find keyword in Twilio console).

6. Next.js App Router fetch cache
   FIX: All API routes that return sensor data must use `cache: 'no-store'`:
   ```typescript
   fetch(url, { cache: 'no-store' })
   ```
   Or in route handler: `export const dynamic = 'force-dynamic'`

7. CORS on Railway — production URLs only
   FIX: FRONTEND_URL env var must be set to the exact Vercel production URL.
   During development, add localhost:3000 to the allowed origins list.

8. Node B TinyML model not fitting flash
   FIX: Ensure max_depth ≤ 8 in training. Target model size < 50KB.
   Verify with `m2cgen` output file size before flashing.

9. Port 1883 blocked at venue
   FIX: This is covered in firmware. Both nodes also try MQTT over port 8883 (TLS).
   Alternatively, use HiveMQ WebSocket endpoint on port 443 as last resort
   (configure in PubSubClient as WebSocket client).

10. OLED I2C address conflict
    FIX: Most SSD1306 OLEDs are 0x3C. Some are 0x3D. Run I2C scanner sketch first.

---

## DEMO SEQUENCE — KNOW THIS BY HEART

Beat 1 (0:00): Walk up. No slides. Dashboard on projector. Both nodes on table.
Beat 2 (0:15): "Her name is Anisha..." opening. Point at OLED showing AQI 167.
Beat 3 (0:45): Blow near PMS5003 or spray near MQ135. AQI climbs. Dashboard updates.
Beat 4 (1:30): Dropper bottle of vinegar into soil pot. pH drops in <5s. Advisory fires in <15s.
Beat 5 (2:30): Phone on table buzzes — WhatsApp in Nepali. Read the first line aloud.
Beat 6 (3:00): Take selfie with N95 mask. Tap Share. Selfie appears on Community Wall.
               Offer judge the spare mask. Let them take the selfie.
Beat 7 (4:00): Ward Board — "Ward 8 is cleanest not because lucky, because 340 PA actions."
Beat 8 (4:30): Architecture slide — one slide, 30 seconds. Show reasoning trace.
               Unplug Node A. Show fallback activating. "It adapts."
Beat 9 (5:30): "CRPF Urban Climate Resilience component. One ward. One cooperative. 3.5 lakhs."
               STOP. Say nothing after this sentence.

Total time: 6 minutes. Rehearse with a phone stopwatch. If it runs over 6:30, cut Beat 8.

---

## CURRENT BUILD STATUS

Last updated: 2026-05-09

```
BACKEND
  [x] npm scaffold + package.json (start/dev scripts, all deps installed)
  [x] .env.example with all Section 4 variables
  [x] src/ directory tree created (mqtt/handlers, influx, routes, agent, services, middleware)
  [x] server.js entry point (starts MQTT + health check loop + Express)
  [x] MQTT client (HiveMQ, vayu/# + mitti/#, auto-reconnect)
  [x] InfluxDB client + write (writeAirReading, writeSoilReading, batched flush)
  [x] InfluxDB queries (getLatestAir/Soil, getAirHistory, getSoilHistory, getAirBaseline)
  [x] airHandler + soilHandler (validate, registerNode, write, anomaly check, SSE broadcast)
  [x] Health check state machine (live→fallback@90s→offline@270s, broadcastNodeEvent)
  [x] Fallback fetchers — Open-Meteo AQ for air (OpenAQ v2/v3 both unusable);
      SoilGrids ISRIC for soil pH (phh2o ÷ 10), Open-Meteo for moisture/temp.
      pH guaranteed non-null (regional estimate 6.2 if SoilGrids unreachable). EC=null.
  [x] SSE endpoint (broadcastToClients, keepalive, client set management)
  [x] MATI agent — prompts.js, tools.js, mati.js (agentic loop, 8s timeout, injection guard)
  [x] Advisory templates (10 templates, Euclidean distance match, <1ms fallback)
  [x] WhatsApp sender (Twilio, Nepali-first, bulk send)
  [x] Advisory route — POST /api/advisory/trigger fully wired to runMatiAgent
  [ ] REST API routes — remaining stubs (air, soil, nodes, ward, exposure, community, data)
  [ ] PA Score service
  [ ] Leaderboard service
  [ ] Selfie vision validation (wired into community route)
  [ ] PDF generator

⚠ MODEL DEPRECATION: claude-sonnet-4-20250514 reaches end-of-life 2026-06-15 (37 days
  from today). CLAUDE_MODEL env var in vayu-backend/.env and CLAUDE.md must be updated
  to claude-sonnet-4-6 before demo. Change it in CLAUDE.md tech stack section too.

FRONTEND
  [x] Next.js scaffold + Tailwind config (NOTE: installed Next.js 16, not 14 — see note below)
  [x] .env.local.example with all Section 4 variables
  [x] Additional deps installed (swr, leaflet, recharts, framer-motion, lucide-react, radix-ui, clsx, cva)
  [ ] Layout with responsive nav (sidebar + bottom tabs)
  [ ] Dashboard page (mobile + desktop layout)
  [ ] Ward Sensor Grid page
  [ ] Exposure Tracker page (route logger + day timeline)
  [ ] Rewards page (score ring + badges)
  [ ] Community page (mask wall + ward board)
  [ ] MATI Chat page
  [ ] Data/Trends page
  [ ] SWR hooks (useNodes, useAir, useSoil, useAdvisory)
  [ ] SSE hook (useSSE)
  [ ] AQI util functions
  [ ] TypeScript types

FIRMWARE
  [x] vayu-firmware/node-a-air/ directory created
  [x] vayu-firmware/node-b-soil/ directory created
  [ ] Node A — air firmware with WiFi + MQTT + OLED
  [ ] Node B — soil firmware with pH calibration + TinyML
  [ ] soil_model.h (TinyML C export)
  [ ] Dual WiFi credential fallback

DEPLOYMENT
  [ ] Backend on Railway
  [ ] Frontend on Vercel
  [ ] Environment variables set on Railway
  [ ] Environment variables set on Vercel
  [ ] HiveMQ tested with both nodes
  [ ] InfluxDB Cloud tested with writes
  [ ] Twilio sandbox demo phones opted in
```

NOTE — Next.js version: create-next-app@latest installed Next.js 16.x instead of 14.x.
App Router, TypeScript, and Tailwind are all still present and compatible.
Confirm if you want to pin to Next.js 14 (`npm install next@14` in vayu-frontend).

Check off items as they are completed. When starting a session, ask the user
which items are done so you can update this list before proceeding.

---

## HOW TO ASK FOR HELP

If you are unsure about a decision, ask with this format:
"I need to make a decision about [X]. The options are [A] or [B].
Option A does [this] but risks [that]. Option B does [this] but risks [that].
Which do you prefer, or is there a constraint I am missing?"

Do not make architectural decisions silently. Do not change the tech stack.
Do not add new dependencies without naming them and explaining why they are needed.

If a feature is not in this file or VAYU_BLUEPRINT.md, do not implement it without asking.

---

## LAST LINE

The demo works or it doesn't. Every other consideration is secondary.
Build the [DEMO CRITICAL] features first. Test them with the actual hardware.
Then add everything else.

VayuMitti ships.