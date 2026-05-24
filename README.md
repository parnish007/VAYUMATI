# VayuMitti — Environmental Intelligence Platform

> Real-time air and soil quality monitoring for Nepal's urban wards, with AI-driven advisories in Nepali and English.

Built for **ECOTHON PRAKRITI 2026** — a live hardware + AI demonstration showing how low-cost IoT sensors and a generative AI agent can give ward-level pollution advisories to residents and farmers via WhatsApp.

---

## What It Does

- **Live sensor pipeline** — ESP32 (air) and ESP8266 (soil) nodes publish readings every 5 seconds to HiveMQ MQTT. The backend ingests, stores in InfluxDB, and pushes updates to the dashboard via SSE in under 3 seconds.
- **MATI Advisory Agent** — a Gemini-powered agent that triggers on anomalies (AQI ≥ 150, pH drop, NO₂ spike), calls weather/location tools, and generates bilingual advisories with recommended actions.
- **WhatsApp alerts** — advisories with severity ≥ 3 automatically dispatch to registered ward members via Twilio.
- **Protective Action Score** — residents earn points for reporting cleaner commutes, wearing masks on high-AQI days, and protecting vulnerable family members.
- **Ward Leaderboard** — ward-level ranking combining AQI trend, collective PA score, and proximity to brick kilns.

---

## Architecture

```
ESP32 Node A (Air)          ESP8266 Node B (Soil)
MQ135 · DHT22 · SSD1306     pH · Moisture · EC · DS18B20
         │                            │
         └──────── HiveMQ MQTT ───────┘
                       │
              vayu-backend (Railway)
              Express · InfluxDB · PostgreSQL
              MATI Agent (Gemini) · Twilio WhatsApp
                       │
              vayu-frontend (Vercel)
              Next.js 16 · Tailwind · SWR · Leaflet
```

---

## Repository Layout

```
vayu-backend/     Node.js 20 + Express — API, MQTT, MATI agent, WhatsApp
vayu-frontend/    Next.js 16 App Router — dashboard, exposure tracker, community wall
vayu-firmware/    Arduino ESP32 + ESP8266 firmware
  node-a-air/     Air node: MQ135 → AQI, DHT22 → temp/humidity, OLED display
  node-b-soil/    Soil node: pH, moisture, EC, temperature (demo mode included)
```

---

## Quick Start

### Backend

```bash
cd vayu-backend
cp .env.example .env          # fill in your keys
npm install
node server.js
```

Requires: Node 20+, PostgreSQL (or Neon free tier), InfluxDB Cloud, HiveMQ broker access.

### Frontend

```bash
cd vayu-frontend
cp .env.local.example .env.local   # set NEXT_PUBLIC_BACKEND_URL
npm install
npm run dev
```

### Firmware

1. Copy `vayu-firmware/node-a-air/config.h.example` → `config.h`
2. Fill in WiFi credentials
3. Flash to ESP32 using Arduino IDE (Board: ESP32 Dev Module)

---

## Environment Variables

See [`vayu-backend/.env.example`](vayu-backend/.env.example) and [`vayu-frontend/.env.local.example`](vayu-frontend/.env.local.example) for full variable lists with descriptions.

Key services used (all free tiers):
- [HiveMQ Cloud](https://www.hivemq.com/mqtt-cloud-broker/) — MQTT broker
- [InfluxDB Cloud](https://cloud2.influxdata.com/) — time-series sensor storage
- [Neon](https://neon.tech/) — PostgreSQL (users, auth)
- [Google AI Studio](https://aistudio.google.com/) — Gemini API for MATI agent
- [Twilio](https://www.twilio.com/) — WhatsApp sandbox messaging

---

## Tech Stack

| Layer | Stack |
|---|---|
| Firmware | Arduino · ESP32 Arduino Core · PubSubClient · SSD1306 |
| Backend | Node.js 20 · Express 4 · MQTT.js · InfluxDB Client · pg |
| AI Agent | Google Gemini 2.0 Flash · multi-key pool with rate-limit rotation |
| Messaging | Twilio WhatsApp Sandbox · bilingual (Nepali + English) |
| Frontend | Next.js 16 App Router · TypeScript · Tailwind CSS · SWR · Leaflet |

---

## Demo Sequence

1. Sensor nodes on table — OLED shows live AQI
2. Blow smoke near Node A — AQI climbs, dashboard updates in &lt;3s
3. Add acid to soil pot near Node B — pH drops, advisory fires in &lt;15s
4. Judge's phone buzzes — WhatsApp advisory in Nepali
5. Take mask selfie → appears on community wall
6. Unplug Node A → fallback activates (Open-Meteo), dashboard relabels source

---

## License

MIT
