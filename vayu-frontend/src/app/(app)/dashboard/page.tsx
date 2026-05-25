"use client";

import { useEffect, useState } from "react";
import { useAir } from "@/hooks/useAir";
import { useSoil } from "@/hooks/useSoil";
import { useAdvisory } from "@/hooks/useAdvisory";
import { useNodes } from "@/hooks/useNodes";
import { useWeeklyDose } from "@/hooks/useWeeklyDose";
import { AQIGauge } from "@/components/sensors/AQIGauge";
import { SoilMeter } from "@/components/sensors/SoilMeter";
import { NodeStatusDot } from "@/components/sensors/NodeStatusDot";
import { AdvisoryCard } from "@/components/advisory/AdvisoryCard";
import { ReasoningTrace } from "@/components/advisory/ReasoningTrace";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { PeopleCounter } from "@/components/ui/PeopleCounter";
import { WHOBar } from "@/components/ui/WHOBar";
import { HourlyTimeline } from "@/components/ui/HourlyTimeline";
import { SoilCrossSection } from "@/components/ui/SoilCrossSection";
import { RoleSwitcher } from "@/components/ui/RoleSwitcher";
import { aqiColor, aqiLabel, timeAgo, cigaretteEquiv } from "@/lib/aqi";
import { DEFAULT_WARD_ID } from "@/lib/constants";
import { DEMO_HOURLY_AQI, DEMO_PEOPLE_COUNT, DEMO_USER_IDENTITY, DEMO_WARD_CARBON_TODAY } from "@/lib/demoData";
import { useDemo, type UserRole } from "@/lib/demoContext";
import { useCurrentUser } from "@/hooks/useCurrentUser";

const WARD_ID = DEFAULT_WARD_ID;
const FIELD_ID = "A1";

function greet() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

const ADV_TABS = ["Individual", "Hospital", "Farmer"] as const;
type AdvTab = (typeof ADV_TABS)[number];

// Map runtime role → default advisory tab. Executives see the broader
// population-health view (Hospital) first; farmers see Farmer; everyone else
// sees Individual.
function defaultTabForRole(role: UserRole): AdvTab {
  if (role === "farmer") return "Farmer";
  if (role === "executive") return "Hospital";
  return "Individual";
}

// Dynamic advisory messages computed from live sensor data
function buildAdvMsgs(
  airData: { aqi: number; pm25: number; no2: number; pm10: number } | null,
  soilData: { ph: number; moisture: number; ec: number | null } | null
): Record<AdvTab, { status: string; why: string; doNow: string }> {
  const aqi  = airData?.aqi   ?? 0;
  const pm25 = airData?.pm25  ?? 0;
  const no2  = airData?.no2   ?? 0;
  const ph   = soilData?.ph   ?? 7.0;
  const ec   = soilData?.ec   ?? null;

  // Individual
  const indUnhealthy = aqi > 100;
  const indStatus = aqi > 200 ? "Air quality very unhealthy — stay indoors"
    : aqi > 150 ? "Air quality unhealthy for all"
    : aqi > 100 ? "Unhealthy for sensitive groups"
    : aqi > 50  ? "Air quality moderate"
    : "Air quality good";
  const pm25Who = (pm25 / 15).toFixed(1); // WHO 24h guideline = 15 μg/m³
  const indWhy = `PM2.5 at ${pm25.toFixed(1)} μg/m³ — ${pm25Who}× WHO 24h limit. AQI ${aqi}.`;
  const indDoNow = aqi > 200 ? "Stay indoors. Close windows. Use air purifier if available."
    : aqi > 150 ? "Wear N95 before going outside. Avoid outdoor exercise."
    : aqi > 100 ? "Sensitive groups (children, elderly) should limit outdoor time."
    : "No restrictions needed today. Normal outdoor activity safe.";

  // Hospital
  const hospRisk = aqi > 150 || no2 > 0.05;
  const hospStatus = aqi > 200 ? "High respiratory emergency risk"
    : hospRisk ? "Respiratory risk elevated"
    : "Respiratory risk at baseline";
  const hospWhy = `NO₂ at ${no2.toFixed(3)} ppm with PM2.5 ${pm25.toFixed(1)} μg/m³ (AQI ${aqi}).`;
  const hospDoNow = aqi > 200 ? "Alert all respiratory wards. Prepare emergency bronchodilators."
    : hospRisk ? `Prepare bronchodilators. Expect ${Math.round(20 + (aqi - 150) * 0.1)}–${Math.round(30 + (aqi - 150) * 0.15)}% increase in respiratory OPD visits.`
    : "Routine monitoring. No unusual surge expected today.";

  // Farmer
  const acidDeposition = ph < 6.0 && no2 > 0.05;
  const phCritical = ph < 5.5 || ph > 8.0;
  const ecHigh = ec !== null && ec > 2.0;
  const farmStatus = acidDeposition ? "Acid deposition risk — soil + air advisory"
    : phCritical ? `Soil pH ${ph < 5.5 ? "too acidic" : "too alkaline"} — delay planting`
    : ecHigh ? "High soil salinity — restrict irrigation"
    : "Soil conditions within normal range";
  const farmWhy = acidDeposition
    ? `pH ${ph.toFixed(2)} with NO₂ spike (${no2.toFixed(3)} ppm) matches acid deposition pattern.`
    : `Soil pH ${ph.toFixed(2)}${ec !== null ? `, EC ${ec.toFixed(1)} dS/m` : ""}.${phCritical ? " Outside optimal range for most crops." : ""}`;
  const farmDoNow = acidDeposition ? "Delay fertilizer application 48h. Do not irrigate until pH stabilises above 6.4."
    : ph < 5.5 ? "Apply lime to raise pH. Hold off on nitrogen fertilizers."
    : ph > 8.0 ? "Apply sulfur to lower pH. Avoid calcium-heavy fertilizers."
    : ecHigh ? "Stop irrigation for 24h. Flush soil if possible."
    : "Normal farming operations can proceed today.";

  return {
    Individual: { status: indStatus, why: indWhy, doNow: indDoNow },
    Hospital:   { status: hospStatus, why: hospWhy, doNow: hospDoNow },
    Farmer:     { status: farmStatus, why: farmWhy, doNow: farmDoNow },
  };
}

export default function DashboardPage() {
  const { air, isLoading: airLoading } = useAir(WARD_ID);
  const { soil, isLoading: soilLoading } = useSoil(FIELD_ID);
  const { advisory, isLoading: advLoading } = useAdvisory(WARD_ID, FIELD_ID);
  const { nodes } = useNodes();
  const { dose: weeklyDoseData } = useWeeklyDose(WARD_ID);
  const { role } = useDemo();
  const { name: liveUserName, isDemo: isDemoMode, role: currentRole } = useCurrentUser();
  const isLive = !isDemoMode; // true when a real user is logged in

  // Use real role from auth when live, demo role when in demo mode
  const effectiveRole = isLive ? currentRole : role;
  const identity = DEMO_USER_IDENTITY[effectiveRole] ?? DEMO_USER_IDENTITY["individual"];

  // Display name: real user name when live, demo persona when demo
  const displayFirstName = isLive && liveUserName
    ? liveUserName.split(" ")[0]
    : identity.firstName;

  const [advTab, setAdvTab] = useState<AdvTab>(defaultTabForRole(effectiveRole));

  // Keep the advisory tab in sync when the user switches role mid-session via
  // the RoleSwitcher (demo flow). The user can still override manually after.
  useEffect(() => { setAdvTab(defaultTabForRole(effectiveRole)); }, [effectiveRole]);

  if (airLoading || soilLoading) {
    return (
      <div className="flex flex-col gap-3 max-w-5xl mx-auto p-4">
        <div className="h-7 w-44 rounded-xl animate-shimmer" style={{ background: "#1a2f20" }} />
        <div className="rounded-2xl h-36 animate-shimmer" style={{ background: "#1a2f20" }} />
        <div className="grid grid-cols-2 gap-2">
          <div className="h-20 rounded-2xl animate-shimmer" style={{ background: "#1a2f20" }} />
          <div className="h-20 rounded-2xl animate-shimmer" style={{ background: "#1a2f20" }} />
        </div>
        <div className="h-28 rounded-2xl animate-shimmer" style={{ background: "#1a2f20" }} />
        <div className="h-40 rounded-2xl animate-shimmer" style={{ background: "#1a2f20" }} />
      </div>
    );
  }

  const airNode = nodes.find((n) => n.type === "air" && n.ward_id === WARD_ID);
  const soilNode = nodes.find((n) => n.type === "soil" && n.ward_id === WARD_ID);
  // Daily dose for cigarette equivalent (rough instantaneous estimate).
  const dailyDose = (air?.pm25 ?? 0) * 60 * 16;
  const cigs = cigaretteEquiv(dailyDose);
  // Real 7d-accumulated dose from backend (InfluxDB mean PM2.5 × breath volume × 7d).
  const wkPct = weeklyDoseData?.pct_of_who_limit ?? 0;
  const wkMeanPm25 = weeklyDoseData?.mean_pm25_7d_ug_m3;
  const aqi = air?.aqi ?? 0;
  const color = aqiColor(aqi);
  const R = 32, circ = 2 * Math.PI * R;
  const dashOff = circ - (Math.min(aqi, 500) / 500) * circ;
  const hourlyData = isLive ? [] : DEMO_HOURLY_AQI;
  const peopleCount = isLive ? Math.round((aqi / 500) * 80000) : DEMO_PEOPLE_COUNT;

  // Build dynamic advisory messages from live sensor readings
  const advMsgs = buildAdvMsgs(air, soil);

  return (
    <div className="flex flex-col gap-4 max-w-5xl mx-auto animate-fade-up">

      {/* ══ MOBILE LAYOUT ══════════════════════════════════════════ */}
      <div className="md:hidden flex flex-col gap-3">

        {/* Greeting */}
        <div className="pt-1 flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-2xl font-light text-parchment leading-snug">
              {greet()}, {displayFirstName},<br />
              <strong className="font-bold" style={{ color: "#f0bb2a" }}>Ward {WARD_ID}.</strong>
            </h1>
            <p className="text-[11px] mt-1" style={{ color: "#4d7a5e" }}>
              {identity.icon} {identity.label} · {identity.subtitle}
            </p>
            {airNode && (
              <div className="mt-1">
                <NodeStatusDot status={airNode.status} lastSeen={airNode.last_seen} fallbackSource={airNode.fallback_source} />
              </div>
            )}
          </div>
          {!isLive && <RoleSwitcher variant="pill" className="shrink-0 mt-1" />}
        </div>

        {/* AQI Hero */}
        {air && (
          <div
            className="rounded-2xl p-4 flex items-center justify-between"
            style={{
              background: `radial-gradient(ellipse at 20% 50%, ${color}26 0%, transparent 60%), linear-gradient(135deg, ${color}14, ${color}06)`,
              border: `1px solid ${color}50`,
              boxShadow: `0 0 32px ${color}12`,
            }}
          >
            <div>
              <p className="text-[11px] uppercase tracking-[0.6px] mb-1 font-semibold" style={{ color: `${color}cc` }}>Air Quality Index</p>
              <p className="font-display font-black leading-none" style={{ fontSize: 64, color, textShadow: `0 0 32px ${color}55` }}>{aqi}</p>
              <p className="text-base font-bold mt-1.5" style={{ color }}>
                {aqi > 100 ? "⚠ " : aqi > 50 ? "◉ " : "✓ "}{aqiLabel(aqi)}
              </p>
            </div>
            <div className="relative w-20 h-20 flex-shrink-0">
              <svg width="80" height="80" viewBox="0 0 80 80" style={{ transform: "rotate(-90deg)" }}>
                <circle cx="40" cy="40" r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="7" />
                <circle cx="40" cy="40" r={R} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round"
                  strokeDasharray={circ} strokeDashoffset={dashOff}
                  style={{ transition: "stroke-dashoffset 0.8s ease", willChange: "stroke-dashoffset" }} />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center font-display font-bold text-xs leading-none" style={{ color: "#c8d9cc" }}>
                <span>PM2.5</span>
                <span className="text-base mt-0.5" style={{ color }}>{(air.pm25 ?? 0).toFixed(0)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Risk row */}
        {air && (
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-2xl p-3 relative overflow-hidden"
              style={{ background: "linear-gradient(135deg, rgba(224,90,56,0.14), rgba(196,75,43,0.06))", border: "1px solid rgba(196,75,43,0.28)" }}>
              <div className="absolute -right-2 -top-2 w-12 h-12 rounded-full pointer-events-none"
                style={{ background: "radial-gradient(circle, rgba(224,90,56,0.22), transparent 70%)" }} />
              <p className="text-[11px] uppercase tracking-[0.5px] mb-1.5 font-semibold" style={{ color: "#e05a38" }}>≈ Cigarettes/day</p>
              <p className="font-display text-3xl font-black" style={{ color: "#e05a38" }}>~{cigs}</p>
              <p className="text-[11px] mt-0.5" style={{ color: "#8a4030" }}>at this AQI, 16h outdoors</p>
            </div>
            <div className="rounded-2xl p-3 relative overflow-hidden"
              style={{ background: "linear-gradient(135deg, rgba(17,34,23,0.9), rgba(26,47,32,0.7))", border: `1px solid ${color}2a` }}>
              <div className="absolute -right-2 -top-2 w-12 h-12 rounded-full pointer-events-none"
                style={{ background: `radial-gradient(circle, ${color}18, transparent 70%)` }} />
              <p className="text-[11px] uppercase tracking-[0.5px] mb-1.5 font-semibold" style={{ color: "#8aad96" }}>PM2.5 live</p>
              <p className="font-display text-3xl font-black tabular-nums" style={{ color }}>{(air.pm25 ?? 0).toFixed(1)}</p>
              <p className="text-[11px] mt-0.5" style={{ color: "#4d7a5e" }}>μg/m³ · {timeAgo(air.ts)}</p>
            </div>
          </div>
        )}

        {/* ─── Ward Soil Bond strap — mobile ───────────────────────────── */}
        <div className="rounded-lg px-4 py-2.5 flex items-center gap-2.5"
          style={{ background: "rgba(156,115,32,0.10)", border: "1px solid rgba(156,115,32,0.32)" }}>
          <span style={{ fontFamily: "var(--font-bond-mono)", fontSize: 8.5, letterSpacing: "1.2px", color: "#9c7320", textTransform: "uppercase", whiteSpace: "nowrap" }}>
            ◆ Ward {DEMO_WARD_CARBON_TODAY.ward_id} · Soil Bond
          </span>
          <span className="font-display font-bold tabular-nums text-sm" style={{ color: "#9c7320" }}>
            {(DEMO_WARD_CARBON_TODAY.co2e_kg_today / 1000).toFixed(2)} t
          </span>
          <span className="text-[10px]" style={{ color: "#8a6a2c" }}>
            · {DEMO_WARD_CARBON_TODAY.contributors_today} contributors
          </span>
          <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded"
            style={{ background: "rgba(156,115,32,0.18)", color: "#9c7320", border: "1px solid rgba(156,115,32,0.38)", fontFamily: "var(--font-bond-mono)" }}>
            #{DEMO_WARD_CARBON_TODAY.rank_among_wards}
          </span>
        </div>

        {/* People Counter */}
        <PeopleCounter count={peopleCount} />

        {/* MATI Advisory strip */}
        {advLoading ? (
          <Skeleton className="h-28 w-full" />
        ) : advisory ? (
          <div
            className="rounded-2xl p-4"
            style={{ background: "linear-gradient(135deg, rgba(30,64,40,0.6), rgba(42,82,56,0.4))", border: "1px solid rgba(61,139,94,0.24)" }}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="w-4 h-px opacity-70" style={{ background: "#7dc99a" }} />
              <span className="text-[11px] uppercase tracking-[1px] font-bold" style={{ color: "#7dc99a" }}>MATI Advisory</span>
            </div>
            <p className="text-sm leading-relaxed line-clamp-3" style={{ color: "#c8ddd0" }}>{advisory.body_en}</p>
            {advisory.actions.length > 0 && (
              <div className="flex gap-2 mt-3 flex-wrap">
                {advisory.actions.slice(0, 3).map((a, i) => (
                  <span key={i} className="text-[10px] px-2.5 py-1 rounded-full"
                    style={{ background: "rgba(61,139,94,0.1)", border: "1px solid rgba(61,139,94,0.22)", color: "#7dc99a" }}>
                    {a}
                  </span>
                ))}
              </div>
            )}
          </div>
        ) : null}

        {/* Three-tab advisory section */}
        <div className="rounded-2xl overflow-hidden" style={{ background: "#112217", border: "1px solid rgba(61,139,94,0.18)" }}>
          <div className="flex" style={{ borderBottom: "1px solid rgba(61,139,94,0.14)" }}>
            {ADV_TABS.map((tab) => (
              <button key={tab} onClick={() => setAdvTab(tab)}
                className="flex-1 py-3.5 text-[11px] font-semibold transition-colors"
                style={advTab === tab
                  ? { color: "#7dc99a", borderBottom: "2px solid #4fa870" }
                  : { color: "#4d7a5e", borderBottom: "2px solid transparent" }}>
                {tab}
              </button>
            ))}
          </div>
          <div className="p-4 flex flex-col gap-2.5">
            <p className="text-sm font-bold text-parchment leading-snug">{advMsgs[advTab].status}</p>
            <p className="text-xs leading-relaxed" style={{ color: "#8aad96" }}>
              <strong className="text-parchment">Why: </strong>{advMsgs[advTab].why}
            </p>
            <p className="text-xs leading-relaxed" style={{ color: "#8aad96" }}>
              <strong className="text-parchment">Do now: </strong>{advMsgs[advTab].doNow}
            </p>
          </div>
        </div>

        {/* Hourly timeline */}
        {hourlyData.length > 0 && (
          <Card className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-parchment">Hourly AQI · Today</h2>
            <HourlyTimeline hours={hourlyData} />
          </Card>
        )}

        {/* WHO dose bar */}
        {air && (
          <Card className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-parchment">Weekly PM2.5 Dose vs. WHO Limit</h2>
            <WHOBar pct={wkPct} meanPm25={wkMeanPm25} />
          </Card>
        )}

        {/* Soil teaser + cross-section */}
        {soil && (
          <div className="rounded-2xl p-4 flex flex-col gap-3"
            style={{ background: "#112217", border: "1px solid rgba(61,139,94,0.18)" }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.5px] mb-1" style={{ color: "#8aad96" }}>Soil pH · Field {FIELD_ID}</p>
                <p className="font-display text-3xl font-bold text-parchment">{(soil.ph ?? 0).toFixed(2)}</p>
                {soilNode && (
                  <div className="mt-1">
                    <NodeStatusDot status={soilNode.status} lastSeen={soilNode.last_seen} fallbackSource={soilNode.fallback_source} />
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-1 text-xs text-right">
                <div>
                  <p className="text-[10px]" style={{ color: "#4d7a5e" }}>Moisture</p>
                  <p className="text-parchment font-medium">{(soil.moisture ?? 0).toFixed(0)}%</p>
                </div>
                <div>
                  <p className="text-[10px]" style={{ color: "#4d7a5e" }}>Temp</p>
                  <p className="text-parchment font-medium">{(soil.soil_temp ?? 0).toFixed(1)}°C</p>
                </div>
              </div>
            </div>
            <SoilCrossSection ph={soil.ph ?? 6.5} />
          </div>
        )}
      </div>

      {/* ══ DESKTOP LAYOUT ═══════════════════════════════════════ */}
      <div className="hidden md:flex flex-col gap-4">

        {/* AQI Hero */}
        <Card className="flex items-center gap-8 py-6">
          {air ? (
            <AQIGauge aqi={air.aqi} size={160} />
          ) : (
            <div className="w-40 h-40 rounded-full bg-ink-3 flex items-center justify-center text-mist text-sm">No data</div>
          )}
          <div className="flex flex-col gap-3 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-col gap-1 min-w-0">
                <h1 className="font-display text-2xl font-bold text-parchment">Ward {WARD_ID} <span style={{ color }}>AQI {aqi}</span> — {aqiLabel(aqi)}</h1>
                <p className="text-xs" style={{ color: "#4d7a5e" }}>
                  {identity.icon}{" "}
                  {isLive
                    ? <><strong style={{ color: "#7dc99a" }}>{liveUserName}</strong> · {identity.label}</>
                    : <>Viewing as <strong style={{ color: "#7dc99a" }}>{identity.name}</strong> · {identity.label}</>
                  }
                </p>
                {airNode && <NodeStatusDot status={airNode.status} lastSeen={airNode.last_seen} fallbackSource={airNode.fallback_source} />}
              </div>
              {!isLive && <RoleSwitcher variant="pill" className="shrink-0" />}
            </div>
            {air && (
              <div className="grid grid-cols-4 gap-2">
                <MetricPill label="PM2.5" value={`${(air.pm25 ?? 0).toFixed(1)} μg/m³`} />
                <MetricPill label="PM10"  value={`${(air.pm10 ?? 0).toFixed(1)} μg/m³`} />
                <MetricPill label="NO₂"   value={`${(air.no2 ?? 0).toFixed(3)} ppm`} />
                <MetricPill label="Temp"  value={`${(air.temperature ?? 0).toFixed(1)}°C`} />
              </div>
            )}
            {air && <WHOBar pct={wkPct} meanPm25={wkMeanPm25} />}
            {air && (
              <p className="text-xs text-mist">
                Est. daily ≈ <span className="text-amber-2 font-semibold">{cigs} cigarette equiv.</span> · {timeAgo(air.ts)}
              </p>
            )}
          </div>
        </Card>

        {/* Ward Soil Bond strap — desktop */}
        <div className="rounded-lg px-5 py-2.5 flex items-center gap-4"
          style={{ background: "rgba(156,115,32,0.10)", border: "1px solid rgba(156,115,32,0.32)" }}>
          <span style={{ fontFamily: "var(--font-bond-mono)", fontSize: 9, letterSpacing: "1.4px", color: "#9c7320", textTransform: "uppercase", whiteSpace: "nowrap" }}>
            ◆ Ward {DEMO_WARD_CARBON_TODAY.ward_id} · Soil Bond · Today
          </span>
          <span className="font-display font-bold tabular-nums text-base leading-none" style={{ color: "#9c7320" }}>
            {(DEMO_WARD_CARBON_TODAY.co2e_kg_today / 1000).toFixed(2)} tCO₂e
          </span>
          <span className="text-xs" style={{ color: "#8a6a2c" }}>
            · {DEMO_WARD_CARBON_TODAY.contributors_today} contributors
          </span>
          <span className="ml-auto text-[9px] font-bold px-2 py-0.5 rounded"
            style={{ background: "rgba(156,115,32,0.18)", color: "#9c7320", border: "1px solid rgba(156,115,32,0.40)", fontFamily: "var(--font-bond-mono)", letterSpacing: "0.5px" }}>
            Rank #{DEMO_WARD_CARBON_TODAY.rank_among_wards}
          </span>
        </div>

        {/* People Counter + Hourly */}
        <div className="grid grid-cols-3 gap-4">
          <PeopleCounter count={peopleCount} />
          {hourlyData.length > 0 && (
            <Card className="col-span-2 flex flex-col gap-3">
              <h2 className="text-xs font-semibold text-parchment">Hourly AQI</h2>
              <HourlyTimeline hours={hourlyData} />
            </Card>
          )}
        </div>

        {/* Soil + Advisory */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-parchment text-sm">Soil Health · Field {FIELD_ID}</h2>
              {soilNode && <NodeStatusDot status={soilNode.status} lastSeen={soilNode.last_seen} fallbackSource={soilNode.fallback_source} />}
            </div>
            {soil ? (
              <>
                <SoilMeter ph={soil.ph ?? 6.5} ec={soil.ec ?? null} moisture={soil.moisture ?? 0} soilTemp={soil.soil_temp ?? 25} />
                <SoilCrossSection ph={soil.ph ?? 6.5} />
              </>
            ) : (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <span className="text-2xl opacity-40">🌱</span>
                <p className="text-sm font-medium" style={{ color: "#4d7a5e" }}>Node B offline</p>
                <p className="text-xs" style={{ color: "#2d5040" }}>Soil data will appear when the sensor connects</p>
              </div>
            )}
          </Card>

          <Card className="flex flex-col gap-3">
            <h2 className="font-semibold text-parchment text-sm">Latest Advisory</h2>
            {advLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : advisory ? (
              <>
                <AdvisoryCard advisory={advisory} />
                <ReasoningTrace toolCallLog={advisory.tool_call_log ?? []} />
              </>
            ) : (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <span className="text-2xl opacity-40">🤖</span>
                <p className="text-sm font-medium" style={{ color: "#4d7a5e" }}>MATI is watching</p>
                <p className="text-xs" style={{ color: "#2d5040" }}>An advisory fires automatically when sensors detect an anomaly</p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl px-3 py-2" style={{ background: "#1a2f20", border: "1px solid rgba(61,139,94,0.1)" }}>
      <span className="text-xs text-mist">{label}</span>
      <span className="text-sm font-semibold text-parchment tabular-nums">{value}</span>
    </div>
  );
}
