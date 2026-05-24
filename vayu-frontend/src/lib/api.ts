import type {
  AirReading,
  SoilReading,
  NodeInfo,
  Advisory,
  WardInfo,
  ExposureReport,
  MaskSelfie,
  LeaderboardEntry,
} from "@/types";

import { getBackendUrl } from "./constants";

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${getBackendUrl()}${path}`, {
    cache: "no-store",
    ...init,
  });
  if (!res.ok) throw new Error(`API ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

// ── Air ──────────────────────────────────────────────────────────────────────

export function getAirReading(wardId: string): Promise<AirReading | null> {
  return apiFetch<AirReading | null>(`/api/air/${wardId}`);
}

export function getAirHistory(
  wardId: string,
  hours = 24
): Promise<AirReading[]> {
  return apiFetch<AirReading[]>(`/api/air/${wardId}/history?hours=${hours}`);
}

// ── Soil ─────────────────────────────────────────────────────────────────────

export function getSoilReading(fieldId: string): Promise<SoilReading | null> {
  return apiFetch<SoilReading | null>(`/api/soil/${fieldId}`);
}

export function getSoilHistory(
  fieldId: string,
  hours = 24
): Promise<SoilReading[]> {
  return apiFetch<SoilReading[]>(`/api/soil/${fieldId}/history?hours=${hours}`);
}

// ── Nodes ─────────────────────────────────────────────────────────────────────

export function getNodes(): Promise<NodeInfo[]> {
  return apiFetch<NodeInfo[]>("/api/nodes");
}

// ── Advisory ─────────────────────────────────────────────────────────────────

export function getLatestAdvisory(
  wardId: string,
  fieldId?: string
): Promise<Advisory | null> {
  const q = fieldId
    ? `?ward_id=${wardId}&field_id=${fieldId}`
    : `?ward_id=${wardId}`;
  return apiFetch<Advisory | null>(`/api/advisory/latest${q}`);
}

export function getAdvisoryHistory(
  wardId: string,
  limit = 20
): Promise<Advisory[]> {
  return apiFetch<Advisory[]>(
    `/api/advisory/history?ward_id=${wardId}&limit=${limit}`
  );
}

export function triggerAdvisory(body: {
  ward_id: string;
  field_id?: string;
  reason?: string;
}): Promise<Advisory> {
  return apiFetch<Advisory>("/api/advisory/trigger", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ── Ward ─────────────────────────────────────────────────────────────────────

export function getWardInfo(wardId: string): Promise<WardInfo | null> {
  return apiFetch<WardInfo | null>(`/api/ward/${wardId}`);
}

export function getLeaderboard(): Promise<LeaderboardEntry[]> {
  return apiFetch<LeaderboardEntry[]>("/api/ward/leaderboard");
}

// ── Exposure ─────────────────────────────────────────────────────────────────

export function getExposureReport(date?: string): Promise<ExposureReport | null> {
  const q = date ? `?date=${date}` : "";
  return apiFetch<ExposureReport | null>(`/api/exposure/report${q}`);
}

export function postExposurePoint(point: {
  lat: number;
  lng: number;
  aqi: number;
}): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>("/api/exposure/point", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(point),
  });
}

// ── Community ────────────────────────────────────────────────────────────────

export function getMaskWall(wardId: string): Promise<MaskSelfie[]> {
  return apiFetch<MaskSelfie[]>(`/api/community/selfies?ward_id=${wardId}`);
}

export function postMaskSelfie(formData: FormData): Promise<MaskSelfie> {
  return apiFetch<MaskSelfie>("/api/community/selfie", {
    method: "POST",
    body: formData,
    // No Content-Type header — browser sets multipart boundary
  });
}

export function postAction(body: {
  action_type: string;
  ward_id: string;
  [key: string]: unknown;
}): Promise<{ pa_score: number; badges: string[] }> {
  return apiFetch<{ pa_score: number; badges: string[] }>(
    "/api/community/action",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
}

// ── Demo Tweaker ─────────────────────────────────────────────────────────────

export interface DemoMember {
  id: string;
  name: string;
  phone: string;
  ward_id: string;
  added_at: string;
}

export interface DemoMembersResponse {
  ward_id: string;
  members: DemoMember[];
  count: number;
}

export interface AdvisoryFireResult {
  advisory: Advisory;
  whatsapp: {
    sent: number;
    phones?: string[];
    statuses?: string[];
    note?: string;
  } | null;
}

export function getDemoMembers(wardId: string): Promise<DemoMembersResponse> {
  return apiFetch<DemoMembersResponse>(`/api/demo/members?ward_id=${wardId}`);
}

export function addDemoMember(data: {
  name: string;
  phone: string;
  ward_id: string;
}): Promise<DemoMember> {
  return apiFetch<DemoMember>("/api/demo/members", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export function removeDemoMember(id: string): Promise<{ removed: string }> {
  return apiFetch<{ removed: string }>(`/api/demo/members/${id}`, {
    method: "DELETE",
  });
}

export function injectAirReading(data: {
  ward_id: string;
  node_id?: string;
  aqi: number;
  pm25: number;
  pm10?: number;
  co2?: number;
  no2?: number;
  temp?: number;
  humidity?: number;
}): Promise<{ ok: boolean; injected: Record<string, unknown> }> {
  return apiFetch("/api/demo/inject-air", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export function injectSoilReading(data: {
  ward_id: string;
  field_id: string;
  node_id?: string;
  ph: number;
  moisture: number;
  ec?: number;
  soil_temp?: number;
  ml_class?: number;
}): Promise<{ ok: boolean; injected: Record<string, unknown> }> {
  return apiFetch("/api/demo/inject-soil", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export function fireAdvisory(data: {
  ward_id: string;
  field_id?: string;
  reason?: string;
  aqi?: number;
  ph?: number;
  [key: string]: unknown;
}): Promise<AdvisoryFireResult> {
  return apiFetch<AdvisoryFireResult>("/api/demo/fire-advisory", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}
