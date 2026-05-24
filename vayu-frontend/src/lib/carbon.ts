// Carbon credit canonical conversions for VayuMitti.
// All event values reference real registry methodologies:
//   - Verra VM0042 (improved agricultural land management, compost)
//   - Verra VM0044 (biochar carbon removal)
//   - Verra VM0047 (agroforestry / tree planting)
//   - Verra VM0050 + Gold Standard TPDDTEC (clean cookstoves, both ICVCM-approved Nov 2025)
// Demo-grade only — final issuance requires audit. UI MUST surface the
// PROVISIONAL_DISCLOSURE string wherever an NPR value is shown.

export type CarbonActionKind =
  | "composted"
  | "biochar"
  | "alt_route"
  | "cookstove_switch"
  | "tree_planted"
  | "residue_no_burn";

export interface CarbonAction {
  id: string;
  user_id: string;
  ward_id: string;
  ts: number;
  kind: CarbonActionKind;
  co2e_kg: number;
  npr_value: number;
  evidence_kind: "diary" | "exposure_point" | "sensor_window" | "selfie";
  evidence_ref: string;
}

export interface CarbonByKindStat { count: number; co2e_kg: number; npr: number }

export interface CarbonLedger {
  user_id: string;
  total_co2e_kg: number;
  total_npr: number;
  by_kind: Record<CarbonActionKind, CarbonByKindStat>;
  recent: CarbonAction[];
  next_payout_kg: number;
  cohort_opens: string;
}

export const CARBON_META: Record<CarbonActionKind, {
  label: string;
  labelNe: string;
  icon: string;
  methodology: string;
  co2e_per_event_kg: number;
  unit_note: string;
}> = {
  composted: {
    label: "Composted residue",
    labelNe: "कम्पोस्ट बनायो",
    icon: "🌿",
    methodology: "Verra VM0042",
    co2e_per_event_kg: 1.8,
    unit_note: "per kg residue vs open burn",
  },
  biochar: {
    label: "Biochar produced",
    labelNe: "बायोचार बनायो",
    icon: "🔥",
    methodology: "Verra VM0044",
    co2e_per_event_kg: 2.4,
    unit_note: "per kg, long-term storage",
  },
  alt_route: {
    label: "Cleaner commute",
    labelNe: "सफा बाटो",
    icon: "🛤️",
    methodology: "Internal narrative",
    co2e_per_event_kg: 0.18,
    unit_note: "per km vs baseline route",
  },
  cookstove_switch: {
    label: "Clean cookstove day",
    labelNe: "सफा चुलो दिन",
    icon: "🍳",
    methodology: "Gold Standard TPDDTEC",
    co2e_per_event_kg: 4.2,
    unit_note: "per household-day, biomass→LPG",
  },
  tree_planted: {
    label: "Tree planted",
    labelNe: "रुख रोपियो",
    icon: "🌳",
    methodology: "Verra VM0047",
    co2e_per_event_kg: 21,
    unit_note: "per sapling-year",
  },
  residue_no_burn: {
    label: "Field saved from burn",
    labelNe: "खेत नजलाएको",
    icon: "🚫",
    methodology: "Verra VM0042",
    co2e_per_event_kg: 1200,
    unit_note: "per hectare per season",
  },
};

// Pricing reference: Verra/CCP voluntary mid-market ~$25/tCO₂e (Q1 2026),
// FX ~1 USD = 138 NPR. Conservative end of the $15–$40 range.
const USD_PER_T = 25;
const NPR_PER_USD = 138;
const NPR_PER_KG_CO2E = (USD_PER_T / 1000) * NPR_PER_USD; // ≈ 3.45

export function co2eToNpr(co2eKg: number): number {
  return Math.round(co2eKg * NPR_PER_KG_CO2E);
}

export function kindToCo2eKg(kind: CarbonActionKind): number {
  return CARBON_META[kind].co2e_per_event_kg;
}

export function kindToNpr(kind: CarbonActionKind): number {
  return co2eToNpr(kindToCo2eKg(kind));
}

export const PROVISIONAL_DISCLOSURE =
  "Provisional · Verra cohort opens Dec 2025";

// Gold-tier ladder (parallel to silver PA tier ladder)
export const CARBON_TIERS = [
  { label: "Sprout",       icon: "🌱", min: 0,    color: "#7dc99a", bg: "rgba(125,201,154,0.10)" },
  { label: "Sapling",      icon: "🌿", min: 10,   color: "#4fa870", bg: "rgba(79,168,112,0.12)"  },
  { label: "Grove",        icon: "🌳", min: 50,   color: "#d4a017", bg: "rgba(212,160,23,0.12)"  },
  { label: "Steward",      icon: "🏛️", min: 200,  color: "#f0bb2a", bg: "rgba(240,187,42,0.15)"  },
  { label: "Carbon Ally",  icon: "💎", min: 1000, color: "#fbd24a", bg: "rgba(251,210,74,0.18)"  },
];

export function carbonTier(totalKg: number) {
  return [...CARBON_TIERS].reverse().find((t) => totalKg >= t.min) ?? CARBON_TIERS[0];
}

export function nextCarbonTier(totalKg: number) {
  return CARBON_TIERS.find((t) => t.min > totalKg) ?? null;
}

// Map Mero Bari diary entry types to a carbon action when applicable.
// Returns null for diary types that are not carbon-bearing (watered, problem, etc.)
export function diaryTypeToCarbon(diaryType: string): CarbonActionKind | null {
  if (diaryType === "composted") return "composted";
  if (diaryType === "biochar")   return "biochar";
  return null;
}
