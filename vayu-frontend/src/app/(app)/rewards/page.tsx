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
import { carbonTier, CARBON_META, PROVISIONAL_DISCLOSURE } from "@/lib/carbon";

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

      {/* ═══ GOLD LADDER · Soil Bond Certificate ════════════════════════ */}
      <div style={{
        borderRadius: 16, padding: 1.5,
        background: "linear-gradient(135deg, #c89530 0%, #6b4822 35%, #9c7320 65%, #c89530 100%)",
        boxShadow: "0 6px 40px rgba(156,115,32,0.22)",
      }}>
        {/* Parchment interior */}
        <div className="relative overflow-hidden" style={{
          borderRadius: 14,
          background: [
            "repeating-linear-gradient(45deg,  transparent, transparent 24px, rgba(156,115,32,0.04) 24px, rgba(156,115,32,0.04) 25px)",
            "repeating-linear-gradient(-45deg, transparent, transparent 24px, rgba(156,115,32,0.04) 24px, rgba(156,115,32,0.04) 25px)",
            "linear-gradient(160deg, #f0e8d0 0%, #ede2c4 45%, #e5d8b0 100%)",
          ].join(", "),
        }}>

          {/* Inner double-rule border */}
          <div className="absolute pointer-events-none" style={{ inset: 10, borderRadius: 6, border: "1px solid rgba(156,115,32,0.28)" }} />
          <div className="absolute pointer-events-none" style={{ inset: 14, borderRadius: 4, border: "0.5px solid rgba(156,115,32,0.14)" }} />

          {/* Corner scrollwork — TL */}
          <svg className="absolute top-2 left-2" width="26" height="26" viewBox="0 0 26 26" style={{ color: "#9c7320", opacity: 0.7 }}>
            <path d="M2,16 Q2,2 16,2" stroke="currentColor" strokeWidth="1.2" fill="none" />
            <path d="M2,16 Q2,7 7,7 Q13,7 13,2" stroke="currentColor" strokeWidth="0.6" fill="none" opacity="0.5" />
            <circle cx="2" cy="2" r="1.2" fill="currentColor" />
          </svg>
          {/* TR */}
          <svg className="absolute top-2 right-2" width="26" height="26" viewBox="0 0 26 26" style={{ color: "#9c7320", opacity: 0.7, transform: "scaleX(-1)" }}>
            <path d="M2,16 Q2,2 16,2" stroke="currentColor" strokeWidth="1.2" fill="none" />
            <path d="M2,16 Q2,7 7,7 Q13,7 13,2" stroke="currentColor" strokeWidth="0.6" fill="none" opacity="0.5" />
            <circle cx="2" cy="2" r="1.2" fill="currentColor" />
          </svg>
          {/* BL */}
          <svg className="absolute bottom-2 left-2" width="26" height="26" viewBox="0 0 26 26" style={{ color: "#9c7320", opacity: 0.7, transform: "scaleY(-1)" }}>
            <path d="M2,16 Q2,2 16,2" stroke="currentColor" strokeWidth="1.2" fill="none" />
            <path d="M2,16 Q2,7 7,7 Q13,7 13,2" stroke="currentColor" strokeWidth="0.6" fill="none" opacity="0.5" />
            <circle cx="2" cy="2" r="1.2" fill="currentColor" />
          </svg>
          {/* BR */}
          <svg className="absolute bottom-2 right-2" width="26" height="26" viewBox="0 0 26 26" style={{ color: "#9c7320", opacity: 0.7, transform: "scale(-1,-1)" }}>
            <path d="M2,16 Q2,2 16,2" stroke="currentColor" strokeWidth="1.2" fill="none" />
            <path d="M2,16 Q2,7 7,7 Q13,7 13,2" stroke="currentColor" strokeWidth="0.6" fill="none" opacity="0.5" />
            <circle cx="2" cy="2" r="1.2" fill="currentColor" />
          </svg>

          {/* Vermillion notary stamp */}
          <div className="absolute bottom-4 right-4 flex items-center justify-center" style={{
            width: 68, height: 68, borderRadius: "50%",
            border: "1.5px solid #a83a1d",
            transform: "rotate(-13deg)",
            background: "rgba(168,58,29,0.04)",
          }}>
            <div className="flex items-center justify-center" style={{
              width: 52, height: 52, borderRadius: "50%",
              border: "1.5px solid rgba(168,58,29,0.55)",
            }}>
              <div style={{ fontFamily: "var(--font-bond-mono)", color: "#a83a1d", textAlign: "center", fontSize: 6, letterSpacing: "0.4px", lineHeight: 1.5, fontWeight: 700, textTransform: "uppercase" }}>
                PROV.<br />Q4 2026<br />VERRA
              </div>
            </div>
          </div>

          {/* Certificate header */}
          <div className="pt-6 px-7 text-center">
            <p style={{ fontFamily: "var(--font-bond-mono)", fontSize: 8, letterSpacing: "2.2px", color: "#6b4f1e", textTransform: "uppercase", opacity: 0.75 }}>
              Carbon Removal Certificate
            </p>
            <p style={{ fontFamily: "var(--font-bond-display)", fontSize: 26, color: "#2d1e06", lineHeight: 1.1, marginTop: 4 }}>
              Soil Bond
            </p>
            <p style={{ fontFamily: "var(--font-bond-text)", fontSize: 12, fontStyle: "italic", color: "#8a6a2c", marginTop: 3 }}>
              {cTier.icon} {cTier.label} · {identity.name}
            </p>
            <div style={{ height: 1, background: "linear-gradient(90deg, transparent, #9c7320, transparent)", marginTop: 8 }} />
          </div>

          {/* Big CO₂e number */}
          <div className="px-7 pt-4 text-center">
            <div style={{ fontFamily: "var(--font-bond-display)", fontSize: 64, lineHeight: 1, color: "#2d1e06", letterSpacing: "-2px" }}>
              {carbon.total_co2e_kg.toFixed(1)}
            </div>
            <p style={{ fontFamily: "var(--font-bond-text)", fontSize: 13, fontStyle: "italic", color: "#6b4f1e", marginTop: 2 }}>
              kilograms CO₂e sequestered
            </p>
            <div style={{ marginTop: 10 }}>
              <span style={{ fontFamily: "var(--font-bond-display)", fontSize: 22, color: "#2d1e06", letterSpacing: "-0.5px" }}>
                ≈ रू {carbon.total_npr}
              </span>
              <p style={{ fontFamily: "var(--font-bond-text)", fontSize: 10, fontStyle: "italic", color: "#8a6a2c", marginTop: 2 }}>
                ₹3.45 / kg CO₂e · cooperative cash-out at threshold
              </p>
            </div>
          </div>

          {/* Schedule A — sequestration ledger */}
          <div className="px-7 mt-5">
            <div style={{ borderTop: "1.5px solid rgba(156,115,32,0.5)" }}>
              <p style={{ fontFamily: "var(--font-bond-mono)", fontSize: 7.5, letterSpacing: "1.4px", color: "#6b4f1e", textTransform: "uppercase", paddingTop: 6, marginBottom: 6 }}>
                Schedule A · Sequestration Ledger
              </p>
              {(Object.entries(carbon.by_kind) as [keyof typeof CARBON_META, { count: number; co2e_kg: number; npr: number }][])
                .filter(([, s]) => s.count > 0)
                .map(([k, s]) => {
                  const meta = CARBON_META[k];
                  const code = meta.methodology
                    .replace("Verra ", "").replace("Gold Standard ", "GS/").replace("Internal narrative", "—");
                  return (
                    <div key={k} style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 5 }}>
                      <span style={{ fontFamily: "var(--font-bond-mono)", fontSize: 10, color: "#4a3810", minWidth: 22, fontWeight: 600 }}>
                        {String(s.count).padStart(2, "0")}×
                      </span>
                      <span style={{ fontFamily: "var(--font-bond-text)", fontSize: 12, color: "#4a3810", flex: 1, borderBottom: "1px dotted rgba(156,115,32,0.3)", paddingBottom: 2 }}>
                        {meta.label}
                      </span>
                      <span style={{ fontFamily: "var(--font-bond-mono)", fontSize: 9, color: "#9c7320", minWidth: 44, textAlign: "right" }}>
                        {s.co2e_kg.toFixed(1)} kg
                      </span>
                      <span style={{ fontFamily: "var(--font-bond-mono)", fontSize: 7, color: "rgba(156,115,32,0.45)", marginLeft: 4, minWidth: 42 }}>
                        {code}
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Payout progress */}
          <div className="px-7 mt-4">
            <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--font-bond-mono)", fontSize: 8, color: "#6b4f1e", marginBottom: 4 }}>
              <span>Next payout · {carbon.next_payout_kg} kg</span>
              <span>{cPayoutPct}%</span>
            </div>
            <div style={{ height: 4, borderRadius: 2, overflow: "hidden", background: "rgba(63,46,10,0.18)" }}>
              <div style={{ height: "100%", borderRadius: 2, width: `${cPayoutPct}%`, background: "linear-gradient(90deg,#9c7320,#c89530)", transition: "width 0.7s" }} />
            </div>
            <p style={{ fontFamily: "var(--font-bond-mono)", fontSize: 7.5, color: "#8a6a2c", marginTop: 3 }}>
              {(carbon.next_payout_kg - carbon.total_co2e_kg).toFixed(1)} kg to threshold
            </p>
          </div>

          {/* MRV countersignature ribbon */}
          <div className="px-7 mt-5 mb-6">
            <div style={{ borderTop: "1px solid rgba(156,115,32,0.4)", borderBottom: "1px solid rgba(156,115,32,0.4)", padding: "6px 0" }}>
              <p style={{ fontFamily: "var(--font-bond-text)", fontSize: 10, fontStyle: "italic", color: "#6b4f1e", textAlign: "center", lineHeight: 1.6 }}>
                MRV countersigned · Node B pH/EC within 1 km · Mero Bari diary
                <span style={{ color: "#a83a1d", margin: "0 6px" }}>✦</span>
                {PROVISIONAL_DISCLOSURE}
              </p>
            </div>
          </div>
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
