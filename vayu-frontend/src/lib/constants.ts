export const DEFAULT_WARD_ID = process.env.NEXT_PUBLIC_DEFAULT_WARD ?? "11";

export function getBackendUrl(): string {
  if (typeof window === "undefined") {
    return process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3001";
  }
  const envUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
  // Use env var only if it's a real external URL (not localhost placeholder)
  if (envUrl && !envUrl.includes("localhost") && !envUrl.includes("127.0.0.1")) {
    return envUrl;
  }
  // Auto-detect: use same hostname as the page (works for any device on LAN)
  return `${window.location.protocol}//${window.location.hostname}:3001`;
}
export const DEFAULT_LAT = parseFloat(process.env.NEXT_PUBLIC_DEFAULT_LAT ?? "27.717");
export const DEFAULT_LNG = parseFloat(process.env.NEXT_PUBLIC_DEFAULT_LNG ?? "85.324");

export const KILN_COORDS: [number, number][] = [
  [27.672, 85.430],
  [27.681, 85.405],
  [27.688, 85.386],
];

export const WARDS = [
  { ward_id: "11", name: "Ward 11 — Thimi", lat: 27.717, lng: 85.324 },
  { ward_id: "8",  name: "Ward 8 — Madhyapur", lat: 27.709, lng: 85.318 },
];

export const AQI_THRESHOLDS = {
  GOOD:      50,
  MODERATE:  100,
  SENSITIVE: 150,
  UNHEALTHY: 200,
  VERY:      300,
} as const;

export const PA_SCORE_WEIGHTS = {
  report_submitted: 20,
  alt_route:        20,
  mask_worn:        20,
  child_indoors:    20,
  soil_compliance:  20,
} as const;

export const BADGE_KEYS = [
  "first_report",
  "mask_hero",
  "clean_commuter",
  "guardian",
  "soil_ally",
  "7day_streak",
  "ward_top3",
] as const;

export const BADGE_META: Record<
  (typeof BADGE_KEYS)[number],
  { label: string; labelNe: string; icon: string; description: string }
> = {
  first_report:   { label: "First Report",   labelNe: "पहिलो रिपोर्ट",   icon: "📋", description: "Submitted your first exposure report" },
  mask_hero:      { label: "Mask Hero",       labelNe: "मास्क हिरो",       icon: "😷", description: "Uploaded an approved mask selfie" },
  clean_commuter: { label: "Clean Commuter",  labelNe: "स्वच्छ यात्री",   icon: "🚶", description: "Took a cleaner route 3× in a week" },
  guardian:       { label: "Guardian",        labelNe: "संरक्षक",          icon: "🛡️", description: "Protected family during AQI≥200 twice" },
  soil_ally:      { label: "Soil Ally",       labelNe: "माटो साथी",        icon: "🌱", description: "Complied with soil delay advisory" },
  "7day_streak":  { label: "7-Day Streak",    labelNe: "७ दिन लगातार",    icon: "🔥", description: "Logged exposure 7 days in a row" },
  ward_top3:      { label: "Ward Top 3",      labelNe: "वडाको शीर्ष ३",   icon: "🏆", description: "Ranked in top 3 of your ward" },
};
