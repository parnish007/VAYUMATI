"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import { Flame, Timer } from "lucide-react";
import { useSSE } from "@/hooks/useSSE";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { BADGE_META, DEFAULT_WARD_ID, getBackendUrl } from "@/lib/constants";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useAuth } from "@/lib/authContext";
import { DEMO_PA, DEMO_PA_BY_ROLE, DEMO_USER_IDENTITY, DEMO_CARBON_LEDGER_BY_ROLE } from "@/lib/demoData";
import { carbonTier, PROVISIONAL_DISCLOSURE } from "@/lib/carbon";

const WARD_ID = DEFAULT_WARD_ID;

interface PAResponse {
  pa_score: number;
  ward_rank?: number;
  badges: string[];
  breakdown?: Record<string, number>;
}

function fetchPA(token: string | null): () => Promise<PAResponse> {
  return () =>
    fetch(`${getBackendUrl()}/api/exposure/score`, {
      cache: "no-store",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => (r.ok ? r.json() : DEMO_PA))
      .catch(() => DEMO_PA) as Promise<PAResponse>;
}

const TIERS = [
  { label: "Grassroot",  icon: "🌱", min: 0,   max: 24,  color: "#4d7a5e", bg: "rgba(77,122,94,0.12)"  },
  { label: "Protector",  icon: "🛡️", min: 25,  max: 49,  color: "#2d7a9a", bg: "rgba(45,122,154,0.12)" },
  { label: "Champion",   icon: "⚡", min: 50,  max: 74,  color: "#d4a017", bg: "rgba(212,160,23,0.12)" },
  { label: "Guardian",   icon: "🌿", min: 75,  max: 99,  color: "#4fa870", bg: "rgba(79,168,112,0.12)" },
  { label: "MATI Ally",  icon: "🌟", min: 100, max: 100, color: "#f0bb2a", bg: "rgba(240,187,42,0.15)" },
];

const BREAKDOWN_META: { key: string; label: string; max: number; icon: string }[] = [
  { key: "report_submitted", label: "Commute Report",    max: 20, icon: "📍" },
  { key: "mask_worn",        label: "Mask Worn",         max: 20, icon: "😷" },
  { key: "child_indoors",    label: "Child/Elder Safe",  max: 20, icon: "🏠" },
  { key: "alt_route",        label: "Alt Route",         max: 20, icon: "🛤️" },
  { key: "soil_compliance",  label: "Soil Compliance",   max: 20, icon: "🌾" },
];

function getTier(score: number) {
  return TIERS.find((t) => score >= t.min && score <= t.max) ?? TIERS[0];
}

function nextMondayNepal(): { days: number; hours: number; mins: number } {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60_000;
  const nepalMs = utcMs + 5 * 3600_000 + 45 * 60_000;
  const nepal = new Date(nepalMs);
  const dayOfWeek = nepal.getDay(); // 0=Sun 1=Mon
  const daysUntilMon = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
  const targetMs = nepalMs + daysUntilMon * 86_400_000
    - nepal.getHours() * 3_600_000
    - nepal.getMinutes() * 60_000
    - nepal.getSeconds() * 1_000
    - nepal.getMilliseconds();
  const diffMs = targetMs - nepalMs;
  const totalMins = Math.floor(diffMs / 60_000);
  const days = Math.floor(totalMins / 1440);
  const hours = Math.floor((totalMins % 1440) / 60);
  const mins = totalMins % 60;
  return { days, hours, mins };
}

export default function RewardsPage() {
  const { isDemo, role } = useCurrentUser();
  const { token } = useAuth();
  const identity = DEMO_USER_IDENTITY[role];
  const { data, isLoading, mutate } = useSWR<PAResponse>(
    isDemo ? null : "/api/exposure/score",
    fetchPA(token),
    { refreshInterval: 60_000 }
  );

  useSSE("score_update", (payload) => { if (!isDemo) mutate(payload as PAResponse, false); });
  useSSE("badge_unlocked", () => { if (!isDemo) mutate(); });

  const d = isDemo ? (DEMO_PA_BY_ROLE[role] ?? DEMO_PA) : data;
  const score      = d?.pa_score ?? 0;
  const rank       = d?.ward_rank ?? null;
  const badges     = d?.badges ?? [];
  const breakdown  = d?.breakdown ?? {};
  const tier       = getTier(score);

  const SIZE = 148, R = 58, circ = 2 * Math.PI * R;
  const dashOff = circ - (score / 100) * circ;

  const [reset, setReset] = useState({ days: 0, hours: 0, mins: 0 });
  useEffect(() => {
    const update = () => setReset(nextMondayNepal());
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, []);

  const DEMO_STREAK = 5;
  const topPct = rank ? Math.round((rank / 40) * 100) : null;

  // ─── Gold Carbon Wallet (parallel to silver PA) ────────────────────────
  // Live wiring TBD — for demo we always source from DEMO_CARBON_LEDGER_BY_ROLE
  // so role-switch in the demo updates the wallet too.
  const carbon = DEMO_CARBON_LEDGER_BY_ROLE[role];
  const cTier = carbonTier(carbon.total_co2e_kg);
  const cPayoutPct = Math.min(100, Math.round((carbon.total_co2e_kg / carbon.next_payout_kg) * 100));

  return (
    <div className="flex flex-col gap-5 max-w-xl mx-auto animate-fade-up pb-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl font-semibold text-parchment">Rewards</h1>
          {isDemo && (
            <p className="text-[11px] mt-0.5" style={{ color: "#4d7a5e" }}>
              {identity.icon} {identity.name} · {identity.label}
            </p>
          )}
        </div>
      </div>

      {/* ═══ SILVER LADDER · PA Score ═══════════════════════════════════ */}
      <Card className="flex flex-col items-center gap-4 py-6 relative overflow-hidden">
        {/* Tier glow background */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: `radial-gradient(ellipse at 50% 0%, ${tier.color}18 0%, transparent 70%)` }} />

        {/* Ladder label — distinguishes from gold */}
        <span className="text-[9px] font-bold uppercase tracking-[1.4px]" style={{ color: "#9ca3af" }}>
          ◇ Silver Ladder · Protective Action
        </span>

        {/* Tier badge */}
        <div className="flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold"
          style={{ background: tier.bg, border: `1px solid ${tier.color}55`, color: tier.color }}>
          <span>{tier.icon}</span>
          <span className="uppercase tracking-[0.8px]">{tier.label}</span>
        </div>

        {isLoading && !isDemo ? (
          <Skeleton className="w-36 h-36 rounded-full" />
        ) : (
          <div className="relative" style={{ width: SIZE, height: SIZE }}>
            <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
              <circle cx={SIZE/2} cy={SIZE/2} r={R} fill="none" stroke="#1a2e1f" strokeWidth={14} />
              <circle cx={SIZE/2} cy={SIZE/2} r={R} fill="none"
                stroke={tier.color} strokeWidth={14} strokeLinecap="round"
                strokeDasharray={circ} strokeDashoffset={dashOff}
                transform={`rotate(-90 ${SIZE/2} ${SIZE/2})`}
                style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(.4,0,.2,1)" }} />
              <text x={SIZE/2} y={SIZE/2 - 8} textAnchor="middle" dominantBaseline="central"
                fontSize="36" fontWeight="900" fill={tier.color} fontFamily="var(--font-display, serif)">{score}</text>
              <text x={SIZE/2} y={SIZE/2 + 18} textAnchor="middle" dominantBaseline="central"
                fontSize="9" fill="#4d7a5e" fontFamily="var(--font-body, sans-serif)" letterSpacing="1.2">PA SCORE</text>
            </svg>
          </div>
        )}

        {/* Social framing */}
        <div className="flex flex-col items-center gap-1.5">
          {rank != null && (
            <div className="flex items-center gap-2 rounded-full px-4 py-1.5 text-xs"
              style={{ background: "rgba(61,139,94,0.08)", border: "1px solid rgba(61,139,94,0.22)", color: "#6dc48d" }}>
              You are <strong className="text-parchment font-display text-sm mx-1">#{rank}</strong> in Ward {WARD_ID}
              {topPct !== null && <span className="ml-1 opacity-70">· top {topPct}%</span>}
            </div>
          )}
          <p className="text-[10px] text-mist text-center">
            Protective Action Score · max 100 pts/week
          </p>
        </div>
      </Card>

      {/* ═══ GOLD LADDER · Carbon Wallet ═════════════════════════════════ */}
      <div
        className="rounded-2xl overflow-hidden relative"
        style={{
          background: "linear-gradient(135deg, rgba(240,187,42,0.13), rgba(212,160,23,0.05))",
          border: `1px solid ${cTier.color}66`,
          boxShadow: `0 0 32px ${cTier.color}22`,
        }}
      >
        {/* Gold sheen */}
        <div
          className="absolute -top-16 -right-16 w-44 h-44 rounded-full pointer-events-none"
          style={{ background: `radial-gradient(circle, ${cTier.color}30, transparent 70%)` }}
        />

        <div className="relative px-5 pt-5 pb-3 flex flex-col items-center gap-1">
          <span className="text-[9px] font-bold uppercase tracking-[1.4px]" style={{ color: "#f0bb2a" }}>
            ◆ Gold Ladder · Carbon Wallet
          </span>
          <div className="flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold mt-1"
            style={{ background: cTier.bg, border: `1px solid ${cTier.color}55`, color: cTier.color }}>
            <span>{cTier.icon}</span>
            <span className="uppercase tracking-[0.8px]">{cTier.label}</span>
          </div>
        </div>

        <div className="relative px-5 pb-3 flex items-end justify-center gap-2">
          <span className="font-display font-black tabular-nums leading-none"
            style={{ fontSize: 56, color: cTier.color, textShadow: `0 0 24px ${cTier.color}66` }}>
            {carbon.total_co2e_kg.toFixed(1)}
          </span>
          <span className="text-sm font-semibold pb-2" style={{ color: "#8aad96" }}>kg CO₂e</span>
        </div>

        <div className="relative px-5 pb-3 text-center">
          <p className="text-base font-bold tabular-nums" style={{ color: "#f0bb2a" }}>
            ≈ रू {carbon.total_npr}
          </p>
          <p className="text-[10px] mt-0.5" style={{ color: "#8aad96" }}>
            cumulative · cohort cash-out via cooperative
          </p>
        </div>

        {/* Progress to next payout */}
        <div className="relative px-5 pb-3">
          <div className="flex items-center justify-between text-[10px] mb-1">
            <span style={{ color: "#8aad96" }}>
              Next payout · {carbon.next_payout_kg} kg
            </span>
            <span className="tabular-nums font-semibold" style={{ color: cTier.color }}>
              {cPayoutPct}% · {(carbon.next_payout_kg - carbon.total_co2e_kg).toFixed(1)} kg to go
            </span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(0,0,0,0.35)" }}>
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${cPayoutPct}%`,
                background: `linear-gradient(90deg, ${cTier.color}, #fbd24a)`,
              }}
            />
          </div>
        </div>

        {/* By-kind mini breakdown */}
        <div className="relative px-5 py-3 grid grid-cols-3 gap-2"
          style={{ borderTop: "1px solid rgba(240,187,42,0.18)" }}>
          {([
            { k: "composted" as const,    label: "Compost",  icon: "♻️" },
            { k: "biochar" as const,      label: "Biochar",  icon: "🔥" },
            { k: "tree_planted" as const, label: "Trees",    icon: "🌳" },
          ]).map(({ k, label, icon }) => {
            const s = carbon.by_kind[k];
            return (
              <div key={k} className="flex flex-col text-center">
                <span className="text-[9px] uppercase tracking-[0.5px]" style={{ color: "#4d7a5e" }}>
                  {icon} {label}
                </span>
                <span className="font-display text-lg font-bold tabular-nums" style={{ color: "#f0bb2a" }}>
                  {s.count}
                </span>
                <span className="text-[9px]" style={{ color: "#8aad96" }}>
                  {s.co2e_kg.toFixed(1)} kg
                </span>
              </div>
            );
          })}
        </div>

        {/* Provisional disclosure */}
        <div className="relative px-5 py-2 text-center"
          style={{ background: "rgba(0,0,0,0.25)", borderTop: "1px solid rgba(240,187,42,0.15)" }}>
          <span className="text-[9px] font-semibold uppercase tracking-[0.6px]" style={{ color: "#d4a017" }}>
            🔒 {PROVISIONAL_DISCLOSURE}
          </span>
        </div>
      </div>

      {/* Streak + reset */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl p-4 flex flex-col gap-2"
          style={{ background: "linear-gradient(135deg, rgba(212,160,23,0.12), rgba(232,96,10,0.08))", border: "1px solid rgba(212,160,23,0.25)" }}>
          <p className="text-[10px] uppercase tracking-[1px] inline-flex items-center gap-1.5" style={{ color: "#d4a017" }}>
            <Flame className="w-3 h-3" /> Streak
          </p>
          <p className="font-display text-3xl font-black text-parchment">{DEMO_STREAK}</p>
          <p className="text-[10px]" style={{ color: "#8aad96" }}>days in a row — keep it up</p>
        </div>
        <div className="rounded-2xl p-4 flex flex-col gap-2"
          style={{ background: "rgba(30,64,40,0.5)", border: "1px solid rgba(61,139,94,0.18)" }}>
          <p className="text-[10px] uppercase tracking-[1px] inline-flex items-center gap-1.5" style={{ color: "#4d7a5e" }}>
            <Timer className="w-3 h-3" /> Resets in
          </p>
          <p className="font-display text-xl font-bold text-parchment tabular-nums">
            {reset.days}d {reset.hours}h {reset.mins}m
          </p>
          <p className="text-[10px]" style={{ color: "#4d7a5e" }}>Mon 00:00 Nepal time</p>
        </div>
      </div>

      {/* Score breakdown bars */}
      <Card className="flex flex-col gap-4">
        <h2 className="font-semibold text-parchment text-sm">Score Breakdown</h2>
        <div className="flex flex-col gap-3">
          {BREAKDOWN_META.map(({ key, label, max, icon }) => {
            const val = (breakdown as Record<string, number>)[key] ?? 0;
            const pct = Math.round((val / max) * 100);
            const done = val >= max;
            return (
              <div key={key} className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-xs">
                  <span style={{ color: done ? "#7dc99a" : "#8aad96" }}>{icon} {label}</span>
                  <span className="tabular-nums font-semibold" style={{ color: done ? "#4fa870" : "#4d7a5e" }}>
                    {val}/{max}
                    {done && <span className="ml-1.5" style={{ color: "#4fa870" }}>✓</span>}
                  </span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "#1a2f20" }}>
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${pct}%`,
                      background: done
                        ? "linear-gradient(90deg,#3d8b5e,#4fa870)"
                        : `linear-gradient(90deg,#2d5040,#3d8b5e)`,
                    }} />
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-[10px] px-1" style={{ color: "#2d5040" }}>
          {role === "farmer"
            ? "Soil compliance earned by following MATI pH advisories · resets Monday"
            : "Soil compliance auto-awarded for non-farmers · resets Monday"}
        </p>
      </Card>

      {/* Badge grid */}
      <Card className="flex flex-col gap-4">
        <h2 className="font-semibold text-parchment text-sm">Badges</h2>
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(BADGE_META) as (keyof typeof BADGE_META)[]).map((key) => {
            const meta  = BADGE_META[key];
            const earned = badges.includes(key);
            return (
              <div key={key}
                className="flex flex-col items-center p-3 rounded-xl text-center relative transition-all duration-300"
                style={earned
                  ? { background: "rgba(61,139,94,0.10)", border: "1px solid rgba(61,139,94,0.4)" }
                  : { background: "#0e180f", border: "1px solid rgba(61,139,94,0.07)", opacity: 0.55 }}>
                {earned && (
                  <span className="absolute top-1.5 right-2 text-[9px]" style={{ color: "#4fa870" }}>✓</span>
                )}
                {!earned && (
                  <span className="absolute top-1.5 right-2 text-[10px] opacity-40">🔒</span>
                )}

                {/* Shimmer on earned */}
                {earned && (
                  <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none">
                    <div style={{
                      position: "absolute", top: 0, left: "-60%", width: "40%", height: "100%",
                      background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.06),transparent)",
                      animation: "shimmer 2.8s infinite",
                    }} />
                  </div>
                )}

                <span className="text-2xl mb-1.5"
                  style={{ filter: earned ? "none" : "grayscale(1)", opacity: earned ? 1 : 0.35 }}>
                  {meta.icon}
                </span>
                <span className="text-[9px] font-semibold leading-tight" style={{ color: earned ? "#7dc99a" : "#2d5040" }}>
                  {meta.label}
                </span>
                <span className="text-[8px] mt-1 font-display font-bold" style={{ color: earned ? "#4fa870" : "#2d5040" }}>
                  20 pts
                </span>
              </div>
            );
          })}
        </div>
      </Card>

    </div>
  );
}
