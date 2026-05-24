// ── Air ──────────────────────────────────────────────────────────────────────

export interface AirReading {
  ward_id: string;
  node_id: string;
  ts: number; // Unix seconds
  pm25: number;
  pm10: number;
  co2: number;
  no2: number;
  temperature: number;
  humidity: number;
  aqi: number;
  source: "live" | "fallback_openaq" | "fallback_openmeteo" | "cached" | string;
}

// ── Soil ─────────────────────────────────────────────────────────────────────

export interface SoilReading {
  ward_id: string;
  field_id: string;
  node_id: string;
  ts: number;
  ph: number; // always present (never null — fallback fills with 6.2 estimate)
  ec: number | null; // null when Node B is in fallback mode
  moisture: number;
  soil_temp: number;
  ml_class: number | null;
  source: "live" | "fallback_soilgrids" | "cached" | string;
}

// ── Node ─────────────────────────────────────────────────────────────────────

export type NodeStatus = "LIVE" | "FALLBACK" | "OFFLINE";

export interface NodeInfo {
  node_id: string;
  type: "air" | "soil";
  ward_id: string;
  field_id?: string;
  status: NodeStatus;
  last_seen: number; // Unix seconds
  battery?: number; // 0–100 %
  rssi?: number; // dBm
  fallback_source?: string;
}

// ── Advisory ─────────────────────────────────────────────────────────────────

export interface Advisory {
  ward_id: string;
  field_id: string | null;
  ts: number;
  source: "mati_agent" | "template_fallback" | string;
  headline_en: string;
  headline_ne: string;
  body_en: string;
  body_ne: string;
  audience: "individual" | "farmer" | "govt" | "executive" | "ward";
  severity: 1 | 2 | 3 | 4 | 5;
  confidence: number; // 0.0–1.0
  actions: string[];
  source_note: string;
  tool_call_log: ToolCall[];
  fallback_reason?: string;
  _template_id?: string;
  _template_dist?: number;
}

export interface ToolCall {
  tool: string;
  input: Record<string, unknown>;
  output: unknown;
}

// ── Ward ─────────────────────────────────────────────────────────────────────

export interface WardInfo {
  ward_id: string;
  name: string;
  lat: number;
  lng: number;
  current_aqi: number;
  aqi_7d_trend: number;
  nearest_kiln_km: number;
  collective_pa_score: number;
  score: number; // computed ward score
}

// ── User / Auth ───────────────────────────────────────────────────────────────

export type UserRole = "individual" | "farmer" | "executive";

export interface UserProfile {
  user_id: string;
  name: string;
  ward_id: string;
  role: UserRole;
  pa_score: number;
  badges: string[];
}

// ── Exposure ─────────────────────────────────────────────────────────────────

export interface ExposurePoint {
  ts: number;
  lat: number;
  lng: number;
  aqi: number;
  dose_ug: number; // μg/m³ × minutes
}

export interface ExposureReport {
  date: string; // YYYY-MM-DD
  points: ExposurePoint[];
  total_dose_ug: number;
  cigarette_equiv: number;
  avg_aqi: number;
}

// ── Community ────────────────────────────────────────────────────────────────

export interface MaskSelfie {
  selfie_id: string;
  user_id: string;
  name: string;
  ts: number;
  image_url: string;
  mask_detected: boolean;
  confidence: number;
  approved: boolean;
}

// ── Leaderboard ───────────────────────────────────────────────────────────────

export interface LeaderboardEntry {
  rank: number;
  ward_id: string;
  name: string;
  score: number;
  aqi: number;
  pa_actions: number;
  /** Change in rank since last week. Positive = climbed, negative = fell, null/undefined = no prior data. */
  delta?: number | null;
}

// ── SSE event payloads ────────────────────────────────────────────────────────

export type SSEEventType =
  | "air_update"
  | "soil_update"
  | "advisory"
  | "node_offline"
  | "node_fallback"
  | "node_online"
  | "selfie_posted"
  | "score_update"
  | "badge_unlocked"
  | "initiative_created"
  | "initiative_joined"
  | "member_approved";

// ── Auth ─────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  username: string;
  name: string;
  role: "individual" | "farmer" | "executive";
  ward_id: string;
  avatar_url?: string | null;
  phone?: string | null;
  status?: string;
  created_at?: string;
}

// ── Initiative ────────────────────────────────────────────────────────────────

export type InitiativeCategory =
  | "waste_cleanup"
  | "tree_planting"
  | "air_monitoring"
  | "community_garden"
  | "awareness_drive";

export interface Initiative {
  id: string;
  title: string;
  description: string;
  category: InitiativeCategory;
  lat: number;
  lng: number;
  location_name: string;
  scheduled_at: string;
  created_by: { id: string; name: string; avatar_url?: string | null };
  joined_by: { id: string; name: string; avatar_url?: string | null; joined_at?: string }[];
  status: "upcoming" | "active" | "completed";
  ward_id: string;
  pa_points_init: number;
  pa_points_join: number;
  created_at?: string;
}

// ── Chat ─────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  role: "user" | "mati";
  text: string;
  streaming?: boolean;
}
