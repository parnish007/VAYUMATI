import type {
  AirReading, SoilReading, NodeInfo, Advisory,
  LeaderboardEntry, MaskSelfie, ExposureReport,
} from "@/types";
import type { UserRole } from "@/lib/demoContext";
import type { CarbonLedger } from "@/lib/carbon";

const NOW = () => Math.floor(Date.now() / 1000);

export const DEMO_AIR: AirReading = {
  ward_id: "11", node_id: "A1", ts: NOW(),
  pm25: 68.4, pm10: 84.2, co2: 418, no2: 0.09,
  temperature: 24.1, humidity: 61, aqi: 167,
  source: "live",
};

export const DEMO_SOIL: SoilReading = {
  ward_id: "11", field_id: "A1", node_id: "B1", ts: NOW(),
  ph: 6.24, ec: 1.41, moisture: 58.2, soil_temp: 21.3,
  ml_class: 1, source: "live",
};

// ─── Nodes (expanded for a richer Ward Sensor Grid) ─────────────────────────
// 5 nodes: 2 air (one live, one on fallback), 2 soil (live + offline last-known),
// and 1 kiln-sentinel air node. Demonstrates the full resilience-tier story.
export const DEMO_NODES: NodeInfo[] = [
  {
    node_id: "A1", type: "air", ward_id: "11",
    status: "LIVE", last_seen: NOW(), battery: 88, rssi: -62,
  },
  {
    node_id: "A2", type: "air", ward_id: "11",
    status: "FALLBACK", last_seen: NOW() - 120, battery: 41, rssi: -82,
    fallback_source: "Open-Meteo AQ",
  },
  {
    node_id: "B1", type: "soil", ward_id: "11", field_id: "A1",
    status: "LIVE", last_seen: NOW(), battery: 76, rssi: -71,
  },
  {
    node_id: "B2", type: "soil", ward_id: "11", field_id: "A2",
    status: "OFFLINE", last_seen: NOW() - 540, battery: 12, rssi: -90,
  },
  {
    node_id: "K1", type: "air", ward_id: "11",
    status: "LIVE", last_seen: NOW(), battery: 92, rssi: -68,
  },
];

export const DEMO_ADVISORY: Advisory = {
  ward_id: "11", field_id: "A1", ts: NOW(),
  source: "mati_agent",
  headline_en: "Acid deposition detected — air and soil alert",
  headline_ne: "एसिड वर्षा संकेत — वायु र माटो सतर्कता",
  body_en:
    "NO₂ has spiked to 0.09 ppm while soil pH has dropped to 6.24. This pattern matches acid deposition. Delay fertilization for 48 hours and use N95 masks outdoors.",
  body_ne:
    "NO₂ बढेको छ। माटोको pH घटिरहेको छ। मल नहाल्नुस् ४८ घण्टा।",
  audience: "farmer", severity: 4, confidence: 0.91,
  source_note: "Live MATI agent · 3 tools called",
  actions: [
    "Delay fertilizer 48h",
    "Apply N95 mask",
    "Take alternate route",
    "Monitor pH daily",
  ],
  tool_call_log: [
    {
      tool: "get_air_quality",
      input: { ward_id: "11" },
      output: { aqi: 167, no2: 0.09, pm25: 68.4 },
    },
    {
      tool: "get_soil_health",
      input: { field_id: "A1" },
      output: { ph: 6.24, ec: 1.41, moisture: 58.2 },
    },
    {
      tool: "get_weather_forecast",
      input: { lat: 27.717, lng: 85.324 },
      output: { rain_prob_24h: 0.12, wind_kph: 8, humidity: 61 },
    },
  ],
};

// ─── Alerts (advisory feed) ──────────────────────────────────────────────────
// Five advisories of varying severity + audience. Demonstrates that MATI fires
// for individuals, farmers, and executives — the alerts page filters by role.
export interface DemoAlert extends Advisory { channel: "whatsapp" | "app"; read: boolean }

export const DEMO_ALERTS: DemoAlert[] = [
  // Severity-5 critical, ward-wide — visible to all roles
  {
    ward_id: "11", field_id: "A1",
    ts: NOW() - 180,
    source: "mati_agent",
    headline_en: "Brick kiln plume — AQI surging past 220",
    headline_ne: "इँट भट्टा धुवाँ — AQI २२० नाघ्यो",
    body_en: "K1 sentinel detected a PM2.5 spike (134 μg/m³) downwind of Ward 11 kilns. Surrounding wards are seeing similar trends. Close windows; cancel outdoor school activity for the next 2 hours.",
    body_ne: "K1 सेन्सरले इँट भट्टाबाट PM2.5 बढेको पत्ता लगायो। सबै झ्याल बन्द गर्नुस्; अबको २ घण्टा बाहिर निस्कनुहोस्।",
    audience: "ward", severity: 5, confidence: 0.94,
    source_note: "K1 kiln sentinel · 2 tools called",
    actions: ["Close windows", "Cancel outdoor school activity", "Issue ward-wide WhatsApp"],
    tool_call_log: [],
    channel: "whatsapp", read: false,
  },
  // Severity-4 farmer advisory
  {
    ward_id: "11", field_id: "A1",
    ts: NOW() - 900,
    source: "mati_agent",
    headline_en: "Acid deposition detected — air and soil alert",
    headline_ne: "एसिड वर्षा संकेत — वायु र माटो सतर्कता",
    body_en: "NO₂ has spiked to 0.09 ppm while soil pH has dropped to 6.24. This pattern matches acid deposition. Delay fertilization for 48 hours and use N95 masks outdoors.",
    body_ne: "NO₂ बढेको छ। माटोको pH घटिरहेको छ। मल नहाल्नुस् ४८ घण्टा।",
    audience: "farmer", severity: 4, confidence: 0.91,
    source_note: "Live MATI agent · 3 tools called",
    actions: ["Delay fertilizer 48h", "Apply N95 mask", "Take alternate route"],
    tool_call_log: [],
    channel: "whatsapp", read: false,
  },
  // Severity-3 individual / sensitive groups
  {
    ward_id: "11", field_id: "A1",
    ts: NOW() - 7200,
    source: "mati_agent",
    headline_en: "AQI reached 171 — sensitive groups at risk",
    headline_ne: "AQI १७१ — संवेदनशील व्यक्तिहरू सावधान रहनुस्",
    body_en: "Ward 11 AQI has exceeded 150 for 3+ hours. Elderly and children should remain indoors. N95 masks mandatory for outdoor activity.",
    body_ne: "वार्ड ११ को AQI ३ घण्टाभन्दा बढी १५०+ छ। वृद्ध र बालबालिका घर भित्र बस्नुस्।",
    audience: "individual", severity: 3, confidence: 0.87,
    source_note: "Auto-trigger · AQI threshold",
    actions: ["Stay indoors", "Use air purifier", "Wear N95"],
    tool_call_log: [],
    channel: "app", read: true,
  },
  // Severity-2 executive ops advisory
  {
    ward_id: "11", field_id: "A1",
    ts: NOW() - 14400,
    source: "mati_agent",
    headline_en: "Node A2 on fallback — Open-Meteo backfill active",
    headline_ne: "Node A2 खराब — Open-Meteo डाटा प्रयोग भएको छ",
    body_en: "Node A2 stopped publishing 2 minutes ago. Open-Meteo Air Quality API is serving the gap (PM2.5 within ±4 μg/m³). Schedule a field visit if it remains offline past 6 hours.",
    body_ne: "Node A2 ले डाटा पठाउन छाडेको छ। Open-Meteo प्रयोग गरिँदै।",
    audience: "executive", severity: 2, confidence: 0.99,
    source_note: "Health-check loop · 1 tool called",
    actions: ["Open node detail", "Notify field tech", "Auto-trigger in 6h"],
    tool_call_log: [],
    channel: "app", read: true,
  },
  // Severity-1 morning advisory
  {
    ward_id: "11", field_id: "A1",
    ts: NOW() - 86400,
    source: "mati_agent",
    headline_en: "Good morning — air quality improving",
    headline_ne: "शुभप्रभात — वायु गुणस्तर सुधारिँदैछ",
    body_en: "AQI dropped to 98 overnight. This is your best window for outdoor activity today — early morning exercise before 9 AM is advisable.",
    body_ne: "AQI रातभर ९८ मा झर्‍यो। बिहान ९ बजेभन्दा पहिले बाहिर जान उचित हुन्छ।",
    audience: "individual", severity: 1, confidence: 0.95,
    source_note: "Scheduled morning advisory",
    actions: ["Morning walk before 9 AM", "Open windows for ventilation"],
    tool_call_log: [],
    channel: "whatsapp", read: true,
  },
];

export const DEMO_LEADERBOARD: LeaderboardEntry[] = [
  { rank: 1, ward_id: "8",  name: "Ward 8 — Madhyapur",    score: 94, aqi: 82,  pa_actions: 340, delta:  0 },
  { rank: 2, ward_id: "5",  name: "Ward 5 — Suryabinayak", score: 88, aqi: 96,  pa_actions: 287, delta:  1 },
  { rank: 3, ward_id: "3",  name: "Ward 3 — Balkumari",    score: 81, aqi: 108, pa_actions: 214, delta: -1 },
  { rank: 4, ward_id: "14", name: "Ward 14 — Sallaghari",  score: 73, aqi: 134, pa_actions: 176, delta:  2 },
  { rank: 5, ward_id: "11", name: "Ward 11 — Thimi",       score: 61, aqi: 167, pa_actions: 142, delta: -2 },
];

// ─── Member ranking inside a ward (community Board tab) ──────────────────────
// Includes a week-over-week delta so the leaderboard can show momentum.
export interface MemberRankEntry {
  rank: number;
  avatar_url?: string;
  name: string;
  role: UserRole;
  pa_score: number;
  badges: number;
  actions: number;
  /** Week-over-week change. Positive = climbed, negative = fell, null = new entrant. */
  delta: number | null;
}

export const DEMO_MEMBER_RANKING: MemberRankEntry[] = [
  { rank: 1, name: "Ward 11 Executive",    role: "executive",  pa_score: 91, badges: 5, actions: 22, delta:  0,    avatar_url: "https://i.pravatar.cc/150?img=33" },
  { rank: 2, name: "Ram Bahadur Shrestha", role: "farmer",     pa_score: 82, badges: 4, actions: 19, delta:  2,    avatar_url: "https://i.pravatar.cc/150?img=14" },
  { rank: 3, name: "Anisha Tamang",        role: "individual", pa_score: 68, badges: 4, actions: 18, delta: -1,    avatar_url: "https://i.pravatar.cc/150?img=5"  },
  { rank: 4, name: "Maya Shrestha",        role: "individual", pa_score: 65, badges: 3, actions: 12, delta:  1,    avatar_url: "https://i.pravatar.cc/150?img=9"  },
  { rank: 5, name: "Hari KC",              role: "individual", pa_score: 58, badges: 2, actions: 10, delta: -2,    avatar_url: "https://i.pravatar.cc/150?img=7"  },
  { rank: 6, name: "Gopal Sharma",         role: "individual", pa_score: 45, badges: 1, actions:  7, delta:  3,    avatar_url: "https://i.pravatar.cc/150?img=62" },
  { rank: 7, name: "Bikash Pun",           role: "individual", pa_score: 38, badges: 1, actions:  6, delta: null,  avatar_url: "https://i.pravatar.cc/150?img=19" },
  { rank: 8, name: "Kamala Devi",          role: "farmer",     pa_score: 31, badges: 1, actions:  5, delta: -1,    avatar_url: "https://i.pravatar.cc/150?img=47" },
];

// ─── Live activity feed (recent community actions) ───────────────────────────
// Drives the "what's happening right now in the ward" ticker at the top of
// the Wall tab — gives the page a heartbeat without needing real SSE.
export type ActivityKind =
  | "selfie_approved"
  | "alt_route"
  | "report_submitted"
  | "initiative_joined"
  | "initiative_completed"
  | "badge_unlocked"
  | "soil_compliance";

export interface ActivityEntry {
  id: string;
  kind: ActivityKind;
  actor: string;
  ts: number;
  detail: string;
  pa?: number;
}

export const DEMO_ACTIVITY_FEED: ActivityEntry[] = [
  { id: "f1", kind: "selfie_approved",     actor: "Priya Sharma",   ts: NOW() -   45, detail: "uploaded a mask selfie · 97% confidence",        pa: 20 },
  { id: "f2", kind: "alt_route",           actor: "Anisha Tamang",  ts: NOW() -  180, detail: "took an alt route avoiding AQI 184 chowk",       pa: 20 },
  { id: "f3", kind: "initiative_joined",   actor: "Hari KC",        ts: NOW() -  420, detail: "joined Bagmati Riverside Cleanup",               pa: 10 },
  { id: "f4", kind: "soil_compliance",     actor: "Ram Bahadur",    ts: NOW() -  900, detail: "logged 48h fertilizer delay · pH 6.24 → 6.41",   pa: 20 },
  { id: "f5", kind: "badge_unlocked",      actor: "Maya Shrestha",  ts: NOW() - 1500, detail: "unlocked the Mask Hero badge",                                 },
  { id: "f6", kind: "report_submitted",    actor: "Gopal Sharma",   ts: NOW() - 2400, detail: "submitted a commute report (AQI 167 → 142)",     pa: 20 },
  { id: "f7", kind: "initiative_completed",actor: "Ward Executive", ts: NOW() - 5400, detail: "marked Tree Planting Drive as fulfilled (38 attended)",        },
];

// ─── User identity per role (drives greeting + score breakdown) ──────────────
export const DEMO_USER_IDENTITY: Record<UserRole, { name: string; firstName: string; icon: string; label: string; subtitle: string }> = {
  individual: {
    name:      "Anisha Tamang",
    firstName: "Anisha",
    icon:      "👤",
    label:     "Resident",
    subtitle:  "Commuter · Thimi → New Baneshwor",
  },
  farmer: {
    name:      "Ram Bahadur Shrestha",
    firstName: "Ram Bahadur",
    icon:      "🌾",
    label:     "Farmer",
    subtitle:  "Field A1 · 0.4 ha tomato + onion",
  },
  executive: {
    name:      "Ward 11 Executive",
    firstName: "Executive",
    icon:      "🏛️",
    label:     "Ward Executive",
    subtitle:  "Bhaktapur Metro · 142 PA actions this week",
  },
};

// ─── Role-specific PA scores ─────────────────────────────────────────────────
// Same shape as the API response — different snapshot per role.
interface DemoPA {
  pa_score: number;
  ward_rank: number;
  badges: string[];
  breakdown: Record<string, number>;
}

export const DEMO_PA_BY_ROLE: Record<UserRole, DemoPA> = {
  individual: {
    pa_score: 68,
    ward_rank: 7,
    badges: ["first_report", "mask_hero", "guardian", "soil_ally"],
    breakdown: {
      report_submitted: 20,
      mask_worn:        20,
      child_indoors:    20,
      alt_route:         8,
      soil_compliance:  20, // auto-awarded for non-farmers
    },
  },
  farmer: {
    pa_score: 82,
    ward_rank: 3,
    badges: ["first_report", "mask_hero", "soil_ally", "7day_streak"],
    breakdown: {
      report_submitted: 20,
      mask_worn:        20,
      child_indoors:    12,
      alt_route:        10,
      soil_compliance:  20, // actively earned — farmer followed delay advisory
    },
  },
  executive: {
    pa_score: 91,
    ward_rank: 1,
    badges: ["first_report", "mask_hero", "guardian", "7day_streak", "ward_top3"],
    breakdown: {
      report_submitted: 20,
      mask_worn:        20,
      child_indoors:    20,
      alt_route:        15,
      soil_compliance:  16, // partial — community average proxy for exec
    },
  },
};

// Default PA — preserves backward compatibility with older imports.
export const DEMO_PA = DEMO_PA_BY_ROLE.individual;

// Images served from vayu-frontend/public/demo-selfies/
// Drop masked selfie photos there named p1.jpg … p9.jpg (see README.txt in that folder)
// Cards fall back to gradient+initials avatar if a file is missing
export const DEMO_SELFIES: MaskSelfie[] = [
  { selfie_id: "s1", user_id: "u1", name: "Priya Sharma",   ts: NOW() - 120,   image_url: "/demo-selfies/p1.jpg", mask_detected: true,  confidence: 0.97, approved: true },
  { selfie_id: "s2", user_id: "u2", name: "Rajan Thapa",    ts: NOW() - 600,   image_url: "/demo-selfies/p2.jpg", mask_detected: true,  confidence: 0.94, approved: true },
  { selfie_id: "s3", user_id: "u3", name: "Sita Rai",       ts: NOW() - 1800,  image_url: "/demo-selfies/p3.jpg", mask_detected: true,  confidence: 0.89, approved: true },
  { selfie_id: "s4", user_id: "u4", name: "Hari Bahadur",   ts: NOW() - 3600,  image_url: "/demo-selfies/p4.jpg", mask_detected: false, confidence: 0.31, approved: false },
  { selfie_id: "s5", user_id: "u5", name: "Maya Tamang",    ts: NOW() - 7200,  image_url: "/demo-selfies/p5.jpg", mask_detected: true,  confidence: 0.96, approved: true },
  { selfie_id: "s6", user_id: "u6", name: "Gopal Shrestha", ts: NOW() - 9000,  image_url: "/demo-selfies/p6.jpg", mask_detected: true,  confidence: 0.88, approved: true },
  { selfie_id: "s7", user_id: "u7", name: "Anita Gurung",   ts: NOW() - 10800, image_url: "/demo-selfies/p7.jpg", mask_detected: true,  confidence: 0.92, approved: true },
  { selfie_id: "s8", user_id: "u8", name: "Bikash Pun",     ts: NOW() - 14400, image_url: "/demo-selfies/p8.jpg", mask_detected: true,  confidence: 0.95, approved: true },
  { selfie_id: "s9", user_id: "u9", name: "Kamala Devi",    ts: NOW() - 18000, image_url: "/demo-selfies/p9.jpg", mask_detected: false, confidence: 0.22, approved: false },
];

export const DEMO_PEOPLE_COUNT = 47000;

// ─── Exposure timeline — 10-waypoint S-curve commute, Lagankhel → Bhaktapur rd
// Each point is a named landmark; gaps are wide enough that the map path looks
// like a natural road trace rather than a dense cloud of overlapping dots.
export const DEMO_EXPOSURE_REPORT: ExposureReport = {
  date: new Date().toISOString().slice(0, 10),
  points: [
    { ts: NOW() - 28800, lat: 27.6601, lng: 85.3032, aqi:  72, dose_ug:  72 }, // Home — Lagankhel
    { ts: NOW() - 27000, lat: 27.6724, lng: 85.3158, aqi: 108, dose_ug: 108 }, // Ekantakuna junction
    { ts: NOW() - 25200, lat: 27.6884, lng: 85.3374, aqi: 152, dose_ug: 152 }, // Balkumari crossing
    { ts: NOW() - 23400, lat: 27.6968, lng: 85.3358, aqi: 178, dose_ug: 178 }, // Koteshwor chowk
    { ts: NOW() - 21600, lat: 27.7081, lng: 85.3248, aqi: 207, dose_ug: 207 }, // Kiln corridor — PEAK
    { ts: NOW() - 18000, lat: 27.7148, lng: 85.3368, aqi: 158, dose_ug: 158 }, // Thimi main road
    { ts: NOW() - 14400, lat: 27.7195, lng: 85.3581, aqi: 118, dose_ug: 118 }, // Workplace — Bhaktapur rd
    { ts: NOW() - 10800, lat: 27.7178, lng: 85.3554, aqi: 131, dose_ug: 131 }, // Lunch walk
    { ts: NOW() -  5400, lat: 27.7074, lng: 85.3261, aqi: 196, dose_ug: 196 }, // Evening · kiln road
    { ts: NOW() -  1800, lat: 27.6724, lng: 85.3142, aqi:  98, dose_ug:  98 }, // Near home
  ],
  total_dose_ug: 1418,
  cigarette_equiv: 11.8,
  avg_aqi: 142,
};

// ─── 24-hour AQI cycle (full day with morning + evening peaks) ───────────────
export const DEMO_HOURLY_AQI: { hour: string; aqi: number }[] = [
  { hour: "00", aqi:  78 },
  { hour: "01", aqi:  71 },
  { hour: "02", aqi:  68 },
  { hour: "03", aqi:  72 },
  { hour: "04", aqi:  85 },
  { hour: "05", aqi:  92 },
  { hour: "06", aqi:  98 },  // dawn kilns fire up
  { hour: "07", aqi: 118 },
  { hour: "08", aqi: 142 },  // morning commute peak
  { hour: "09", aqi: 158 },
  { hour: "10", aqi: 167 },
  { hour: "11", aqi: 171 },  // late-morning peak
  { hour: "12", aqi: 163 },
  { hour: "13", aqi: 155 },
  { hour: "14", aqi: 148 },
  { hour: "15", aqi: 152 },
  { hour: "16", aqi: 161 },
  { hour: "17", aqi: 178 },  // evening commute peak
  { hour: "18", aqi: 182 },
  { hour: "19", aqi: 174 },
  { hour: "20", aqi: 156 },
  { hour: "21", aqi: 132 },
  { hour: "22", aqi: 108 },
  { hour: "23", aqi:  91 },
];

export const DEMO_WEEKLY: { day: string; aqi: number }[] = [
  { day: "Mon", aqi: 134 },
  { day: "Tue", aqi: 148 },
  { day: "Wed", aqi: 121 },
  { day: "Thu", aqi: 162 },
  { day: "Fri", aqi: 155 },
  { day: "Sat", aqi: 143 },
  { day: "Sun", aqi: 167 },
];

// ─── Carbon ledger (GOLD tier — parallel to SILVER PA score) ────────────────
// Demo-mode only. Numbers reference Verra/Gold Standard methodologies but the
// UI MUST surface the "Provisional" disclosure wherever NPR is shown. The
// farmer ledger is the heaviest because Mero Bari diary entries are the
// primary surface for compost/biochar events.
export const DEMO_CARBON_LEDGER_BY_ROLE: Record<UserRole, CarbonLedger> = {
  farmer: {
    user_id: "u-ram",
    total_co2e_kg: 84.6,
    total_npr: 292,
    by_kind: {
      composted:        { count: 12, co2e_kg: 21.6, npr: 74  },
      biochar:          { count:  3, co2e_kg:  7.2, npr: 25  },
      tree_planted:     { count:  2, co2e_kg: 42.0, npr: 145 },
      residue_no_burn:  { count:  0, co2e_kg:  0.0, npr:  0  },
      cookstove_switch: { count:  3, co2e_kg: 12.6, npr: 43  },
      alt_route:        { count:  6, co2e_kg:  1.2, npr:  4  },
    },
    recent: [
      { id: "c1", user_id: "u-ram", ward_id: "11", ts: NOW() -   3600, kind: "composted",    co2e_kg: 1.8, npr_value:  6, evidence_kind: "diary", evidence_ref: "d1" },
      { id: "c2", user_id: "u-ram", ward_id: "11", ts: NOW() -  86400, kind: "biochar",      co2e_kg: 2.4, npr_value:  8, evidence_kind: "diary", evidence_ref: "d3" },
      { id: "c3", user_id: "u-ram", ward_id: "11", ts: NOW() - 172800, kind: "tree_planted", co2e_kg:  21, npr_value: 72, evidence_kind: "diary", evidence_ref: "d5" },
    ],
    next_payout_kg: 100,
    cohort_opens: "2026-09-01",
  },
  individual: {
    user_id: "u-anisha",
    total_co2e_kg: 4.8,
    total_npr: 17,
    by_kind: {
      composted:        { count: 0, co2e_kg: 0,   npr:  0 },
      biochar:          { count: 0, co2e_kg: 0,   npr:  0 },
      tree_planted:     { count: 0, co2e_kg: 0,   npr:  0 },
      residue_no_burn:  { count: 0, co2e_kg: 0,   npr:  0 },
      cookstove_switch: { count: 1, co2e_kg: 4.2, npr: 14 },
      alt_route:        { count: 3, co2e_kg: 0.6, npr:  3 },
    },
    recent: [
      { id: "c1", user_id: "u-anisha", ward_id: "11", ts: NOW() -  7200, kind: "alt_route",        co2e_kg: 0.18, npr_value:  1, evidence_kind: "exposure_point", evidence_ref: "ep-3" },
      { id: "c2", user_id: "u-anisha", ward_id: "11", ts: NOW() - 86400, kind: "cookstove_switch", co2e_kg: 4.2,  npr_value: 14, evidence_kind: "selfie",          evidence_ref: "s-1"  },
    ],
    next_payout_kg: 100,
    cohort_opens: "2026-09-01",
  },
  executive: {
    user_id: "u-exec",
    total_co2e_kg: 142,
    total_npr: 490,
    by_kind: {
      composted:        { count:  5, co2e_kg:   9.0, npr:  31 },
      biochar:          { count:  2, co2e_kg:   4.8, npr:  17 },
      tree_planted:     { count:  6, co2e_kg: 126.0, npr: 435 },
      residue_no_burn:  { count:  0, co2e_kg:   0.0, npr:   0 },
      cookstove_switch: { count:  0, co2e_kg:   0.0, npr:   0 },
      alt_route:        { count: 12, co2e_kg:   2.2, npr:   8 },
    },
    recent: [],
    next_payout_kg: 200,
    cohort_opens: "2026-09-01",
  },
};

// Ward-wide carbon stat for Dashboard strap
export const DEMO_WARD_CARBON_TODAY = {
  ward_id: "11",
  co2e_kg_today: 2_340,       // 2.34 tCO₂e
  contributors_today: 47,
  rank_among_wards: 3,
};
