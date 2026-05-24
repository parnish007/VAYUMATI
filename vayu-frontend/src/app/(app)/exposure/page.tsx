"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import useSWR from "swr";
import {
  Navigation, Wind, Activity, AlertTriangle, MapPin, TrendingUp,
  Play, Square, Clock,
} from "lucide-react";
import { getExposureReport, postExposurePoint } from "@/lib/api";
import { useAir } from "@/hooks/useAir";
import { useDemo } from "@/lib/demoContext";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { aqiColor, aqiLabel, aqiLabelShort, cigaretteEquiv } from "@/lib/aqi";
import { Card } from "@/components/ui/Card";
import { WeeklyChart } from "@/components/ui/WeeklyChart";
import { DEFAULT_WARD_ID, DEFAULT_LAT, DEFAULT_LNG, getBackendUrl } from "@/lib/constants";
import {
  DEMO_EXPOSURE_REPORT,
  DEMO_WEEKLY,
  DEMO_USER_IDENTITY,
} from "@/lib/demoData";
import type { ExposurePoint } from "@/types";

const ExposureMap = dynamic(() => import("@/components/ui/ExposureMap"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center" style={{ height: "60vh", background: "#05100a" }}>
      <span style={{ color: "#4d7a5e", fontSize: 12, letterSpacing: 1 }}>LOADING MAP</span>
    </div>
  ),
});

const PulseMap = dynamic(() => import("@/components/pulse/PulseMap"), {
  ssr: false,
  loading: () => (
    <div style={{ width: "100%", height: "100%", background: "#080f0a", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ color: "#2d5040", fontSize: 12 }}>Loading…</span>
    </div>
  ),
});

const WARD_ID = DEFAULT_WARD_ID;

// Labels match the 10 waypoints in demoData.ts exactly
const SEGMENT_LABELS = [
  "Home — Lagankhel",
  "Ekantakuna junction",
  "Balkumari crossing",
  "Koteshwor chowk",
  "Kiln corridor — peak",
  "Thimi main road",
  "Workplace — Bhaktapur rd",
  "Lunch walk",
  "Evening · kiln road",
  "Near home",
];

// ─── Pulse helpers ────────────────────────────────────────────────────────────
interface HistoryPoint { ts: number; aqi: number; pm25: number; }

function aqiToRadius(aqi: number) {
  return Math.round(72 + Math.min(Math.max(aqi, 0), 500) * 0.38);
}

function makeDemoHistory(): HistoryPoint[] {
  const now = Math.floor(Date.now() / 1000);
  return Array.from({ length: 288 }, (_, i) => {
    const frac = i / 288;
    const base = 118 + Math.sin(frac * Math.PI * 4.2) * 52 + Math.sin(frac * Math.PI * 2.1) * 28;
    const aqi = Math.max(22, Math.min(340, Math.round(base)));
    return { ts: now - (288 - i) * 300, aqi, pm25: Math.round(aqi * 0.39) };
  });
}

// ─── Shared helpers ───────────────────────────────────────────────────────────
function formatTime(ts: number) {
  return new Date(ts * 1000).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
}
function formatDate(ts: number) {
  return new Date(ts * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
function durationLabel(points: ExposurePoint[]) {
  if (points.length < 2) return "—";
  const mins = Math.round((points[points.length - 1].ts - points[0].ts) / 60);
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}
function totalDistanceKm(points: ExposurePoint[]): number {
  if (points.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]; const b = points[i];
    const dLat = ((b.lat - a.lat) * Math.PI) / 180;
    const dLng = ((b.lng - a.lng) * Math.PI) / 180;
    const x = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    total += 2 * 6371 * Math.asin(Math.sqrt(x));
  }
  return Math.round(total * 10) / 10;
}
function findPeakWindow(points: ExposurePoint[]) {
  if (points.length === 0) return null;
  let max = points[0];
  for (const p of points) if (p.aqi > max.aqi) max = p;
  return { startTs: max.ts - 1800, endTs: max.ts + 1800, aqi: max.aqi };
}

type View = "route" | "pulse";

export default function ExposurePage() {
  const { air } = useAir(WARD_ID);
  const { role } = useDemo();
  const { isDemo: isDemoSession } = useCurrentUser();
  const isDemo = isDemoSession;
  const identity = DEMO_USER_IDENTITY[role];

  // ─── View toggle ──────────────────────────────────────────────────────────
  const [view, setView] = useState<View>("route");

  // ─── Route state ──────────────────────────────────────────────────────────
  const [tracking, setTracking] = useState(false);
  const [livePoints, setLivePoints] = useState<ExposurePoint[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [trackError, setTrackError] = useState("");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const { data: reportRaw } = useSWR(
    isDemo ? null : `/api/exposure/report?date=${today}`,
    () => getExposureReport(today),
    { refreshInterval: 60_000 }
  );
  const report = isDemo ? DEMO_EXPOSURE_REPORT : reportRaw;

  const mapPoints: ExposurePoint[] = useMemo(() => {
    if (livePoints.length > 0) return livePoints;
    if (report?.points && report.points.length > 0) return report.points;
    return [];
  }, [livePoints, report]);

  // ─── Pulse state ──────────────────────────────────────────────────────────
  const { data: historyRaw, isLoading: historyLoading } = useSWR<HistoryPoint[]>(
    view === "pulse" ? `${getBackendUrl()}/api/air/${WARD_ID}/history?range=-24h` : null,
    async (url: string) => {
      const r = await fetch(url, { cache: "no-store" });
      if (!r.ok) return [];
      return (await r.json()) as HistoryPoint[];
    },
    { refreshInterval: 300_000 }
  );
  const historyPoints = useMemo<HistoryPoint[]>(() => {
    if (!historyRaw || historyRaw.length === 0) return makeDemoHistory();
    return historyRaw;
  }, [historyRaw]);

  const [scrubIdx, setScrubIdx] = useState<number | null>(null);
  const isLive = scrubIdx === null;
  const currentHistIdx = scrubIdx ?? historyPoints.length - 1;
  const historyPoint = historyPoints[currentHistIdx] ?? historyPoints[historyPoints.length - 1];
  const pulseColor = historyPoint ? aqiColor(historyPoint.aqi) : "#4fa870";
  const auraRadius = historyPoint ? aqiToRadius(historyPoint.aqi) : 124;
  const scrubPercent = historyPoints.length > 1
    ? ((currentHistIdx / (historyPoints.length - 1)) * 100).toFixed(1)
    : "100";

  const sparkline = useMemo(() => {
    if (historyPoints.length < 2) return "";
    const W = 300; const H = 18;
    const maxAqi = Math.max(...historyPoints.map((p) => p.aqi));
    const minAqi = Math.min(...historyPoints.map((p) => p.aqi));
    const range = maxAqi - minAqi || 1;
    const step = W / (historyPoints.length - 1);
    return historyPoints.map((p, i) => {
      const x = (i * step).toFixed(1);
      const y = (H - ((p.aqi - minAqi) / range) * H).toFixed(1);
      return `${i === 0 ? "M" : "L"}${x},${y}`;
    }).join(" ");
  }, [historyPoints]);

  // ─── Route stats ──────────────────────────────────────────────────────────
  const avgAqi    = mapPoints.length ? Math.round(mapPoints.reduce((a, p) => a + p.aqi, 0) / mapPoints.length) : 0;
  const totalDose = report?.total_dose_ug ?? mapPoints.reduce((a, p) => a + p.dose_ug, 0);
  const cigs      = report?.cigarette_equiv ?? cigaretteEquiv(totalDose);
  const distance  = totalDistanceKm(mapPoints);
  const duration  = durationLabel(mapPoints);
  const peak      = findPeakWindow(mapPoints);
  const currentAqi   = air?.aqi ?? (isDemo ? 167 : 0);
  const currentColor = aqiColor(currentAqi);

  // ─── Tracking ─────────────────────────────────────────────────────────────
  function startTracking() {
    if (!navigator.geolocation) { setTrackError("Geolocation not available."); return; }
    setTracking(true); setTrackError("");
    const record = () => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const aqi = air?.aqi ?? 50;
          const point: ExposurePoint = {
            ts: Math.floor(Date.now() / 1000),
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            aqi,
            dose_ug: aqi * 1,
          };
          setLivePoints((prev) => [...prev, point]);
          postExposurePoint({ lat: point.lat, lng: point.lng, aqi }).catch(() => null);
        },
        () => setTrackError("Location permission denied.")
      );
    };
    record();
    intervalRef.current = setInterval(record, 60_000);
  }
  function stopTracking() {
    setTracking(false);
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  }
  useEffect(() => () => stopTracking(), []);

  const selectedPoint = selectedIdx != null ? mapPoints[selectedIdx] : null;

  // ─── Pulse control panel ──────────────────────────────────────────────────
  const pulseControls = (
    <>
      {historyPoint && (
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 10 }}>
          <div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              <span style={{ fontFamily: "var(--font-fraunces)", fontSize: 50, fontWeight: 700, lineHeight: 1, color: pulseColor, textShadow: `0 0 28px ${pulseColor}55`, transition: "color 0.4s, text-shadow 0.4s" }}>
                {historyPoint.aqi}
              </span>
              <span style={{ fontSize: 12, color: "#4d7a5e", fontWeight: 600 }}>AQI</span>
            </div>
            <p style={{ fontSize: 11, fontWeight: 600, color: pulseColor, marginTop: 2, transition: "color 0.4s" }}>
              {aqiLabel(historyPoint.aqi)}
            </p>
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ fontFamily: "var(--font-fraunces)", fontSize: 26, fontWeight: 700, color: "#c8ddd0", letterSpacing: "-0.5px" }}>
              {formatTime(historyPoint.ts)}
            </p>
            <p style={{ fontSize: 10, color: "#4d7a5e" }}>{formatDate(historyPoint.ts)}</p>
          </div>
        </div>
      )}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
        <span style={{ padding: "3px 9px", borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(61,139,94,0.18)", fontSize: 10, color: "#8aad96" }}>
          PM2.5 <b style={{ color: "#c8ddd0" }}>{historyPoint?.pm25?.toFixed(1) ?? "—"}</b> μg/m³
        </span>
        <span style={{
          padding: "3px 9px", borderRadius: 12, fontSize: 10,
          background: isLive ? "rgba(79,168,112,0.10)" : "rgba(255,255,255,0.04)",
          border: isLive ? "1px solid rgba(79,168,112,0.30)" : "1px solid rgba(61,139,94,0.12)",
          fontWeight: isLive ? 700 : 400,
          color: isLive ? "#4fa870" : "#4d7a5e",
        }}>
          {isLive ? "● Live" : `${historyPoints.length - 1 - currentHistIdx} steps before now`}
        </span>
      </div>
      <div style={{ position: "relative" }}>
        <svg viewBox="0 0 300 18" preserveAspectRatio="none" style={{ position: "absolute", top: "50%", left: 0, right: 0, width: "100%", height: 22, transform: "translateY(-50%)", opacity: 0.32, pointerEvents: "none" }}>
          <path d={sparkline} fill="none" stroke={pulseColor} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <input
          type="range"
          min={0}
          max={Math.max(0, historyPoints.length - 1)}
          value={currentHistIdx}
          onChange={(e) => { const v = Number(e.target.value); setScrubIdx(v >= historyPoints.length - 1 ? null : v); }}
          className="pulse-scrubber"
          style={{ width: "100%", position: "relative", zIndex: 2 }}
        />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#2d5040", marginTop: 4 }}>
        <span>24h ago</span>
        <span>12h ago</span>
        <span style={{ color: isLive ? "#4fa870" : "#2d5040" }}>Now</span>
      </div>
    </>
  );

  return (
    <div className="-mx-4 -my-4 md:mx-0 md:my-0 flex flex-col md:flex-row md:gap-4 md:items-start animate-fade-up">

      {/* ══ MAP ══════════════════════════════════════════════════════════════ */}
      <div
        className="relative w-full md:flex-1 md:rounded-2xl md:overflow-hidden"
        style={{ minHeight: "56vh" }}
      >
        {/* Depth vignette — darkens edges for layered look, mobile only */}
        <div
          className="absolute inset-0 pointer-events-none z-[10] md:hidden"
          style={{
            background: "radial-gradient(ellipse at 50% 40%, transparent 40%, rgba(3,8,5,0.55) 100%)",
          }}
        />

        <div className="absolute inset-0 map-3d-mobile">
          {view === "route" ? (
            mapPoints.length > 0 ? (
              <ExposureMap
                points={mapPoints}
                height="100%"
                selectedIdx={selectedIdx}
                onSelect={setSelectedIdx}
                showLivePulse={tracking || isDemo}
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-3" style={{ background: "#05100a" }}>
                <Navigation className="w-7 h-7" style={{ color: "#2d5040" }} />
                <p className="text-xs" style={{ color: "#4d7a5e" }}>No route logged yet. Start tracking below.</p>
              </div>
            )
          ) : (
            <PulseMap
              lat={DEFAULT_LAT}
              lng={DEFAULT_LNG}
              aqi={historyPoint?.aqi ?? 100}
              auraRadius={auraRadius}
            />
          )}
        </div>

        {/* Floating top bar */}
        <div className="absolute top-0 inset-x-0 z-[400] flex items-start justify-between p-3 pointer-events-none">
          {/* Left — identity + view switcher */}
          <div
            className="rounded-xl px-3 py-2 pointer-events-auto"
            style={{
              background: "rgba(8,15,10,0.82)",
              border: "1px solid rgba(61,139,94,0.22)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
            }}
          >
            {/* View tab pills */}
            <div className="flex gap-1 mb-1.5">
              {(["route", "pulse"] as View[]).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className="px-2.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-[0.5px] transition-all"
                  style={
                    view === v
                      ? { background: "rgba(79,168,112,0.22)", color: "#7dc99a", border: "1px solid rgba(79,168,112,0.40)" }
                      : { background: "transparent", color: "#3d6650", border: "1px solid transparent" }
                  }
                >
                  {v === "route" ? "My Route" : "Ward Pulse"}
                </button>
              ))}
            </div>
            <p className="text-[9px] uppercase tracking-[0.7px]" style={{ color: "#5a8a6e" }}>
              {view === "route" ? "Personal exposure" : "24h AQI aura replay"}
            </p>
            <p className="text-sm font-semibold text-parchment leading-tight mt-0.5">
              {view === "route" ? (isDemo ? identity.firstName : "You") : `Ward ${WARD_ID}`}
              <span className="ml-1.5 font-normal text-[11px]" style={{ color: "#8aad96" }}>
                · {new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
              </span>
            </p>
          </div>

          {/* Right — live AQI (route) or LIVE badge (pulse) */}
          {view === "route" ? (
            <div
              className="rounded-xl px-3 py-2 pointer-events-auto flex items-center gap-2.5"
              style={{
                background: "rgba(8,15,10,0.78)",
                border: `1px solid ${currentColor}66`,
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
              }}
            >
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: currentColor, animation: "pulse-dot 1.6s infinite" }} />
              <div className="text-right">
                <p className="font-display text-base font-bold leading-none tabular-nums" style={{ color: currentColor }}>{currentAqi}</p>
                <p className="text-[9px] leading-none mt-0.5" style={{ color: "#8aad96" }}>Ward {WARD_ID} · {aqiLabelShort(currentAqi)}</p>
              </div>
            </div>
          ) : isLive ? (
            <div
              className="rounded-xl px-3 py-2 pointer-events-auto flex items-center gap-2"
              style={{ background: "rgba(8,15,10,0.82)", border: "1px solid rgba(79,168,112,0.35)", backdropFilter: "blur(12px)" }}
            >
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#4fa870", animation: "pulse-dot 1.6s infinite", display: "inline-block" }} />
              <span style={{ fontSize: 10, color: "#7dc99a", fontWeight: 700 }}>LIVE</span>
            </div>
          ) : null}
        </div>

        {/* AQI scale legend — route view only */}
        {view === "route" && (
          <div
            className="absolute bottom-3 left-3 z-[400] flex items-center gap-1.5 rounded-full px-2.5 py-1.5"
            style={{ background: "rgba(8,15,10,0.78)", border: "1px solid rgba(61,139,94,0.22)", backdropFilter: "blur(8px)" }}
          >
            <span className="text-[9px] uppercase tracking-[0.5px] mr-1" style={{ color: "#8aad96" }}>AQI</span>
            {[
              { c: "#3d8b5e", l: "0" },
              { c: "#d4a017", l: "100" },
              { c: "#e8600a", l: "150" },
              { c: "#c44b2b", l: "200" },
              { c: "#7b2d8b", l: "300+" },
            ].map((seg, i, arr) => (
              <div key={i} className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: seg.c, boxShadow: `0 0 6px ${seg.c}88` }} />
                <span className="text-[9px] tabular-nums" style={{ color: "#8aad96" }}>{seg.l}</span>
                {i < arr.length - 1 && <span className="text-[9px]" style={{ color: "#2d5040" }}>·</span>}
              </div>
            ))}
          </div>
        )}

        {/* Selected waypoint chip — route view only */}
        {view === "route" && selectedPoint && (
          <button
            onClick={() => setSelectedIdx(null)}
            className="absolute bottom-3 right-3 z-[400] rounded-xl px-3 py-2 text-left pointer-events-auto"
            style={{ background: "rgba(8,15,10,0.88)", border: `1px solid ${aqiColor(selectedPoint.aqi)}66`, backdropFilter: "blur(12px)", maxWidth: 220 }}
          >
            <div className="flex items-center gap-1.5 mb-0.5">
              <MapPin className="w-3 h-3" style={{ color: aqiColor(selectedPoint.aqi) }} />
              <p className="text-[10px] font-semibold" style={{ color: aqiColor(selectedPoint.aqi) }}>
                {SEGMENT_LABELS[selectedIdx ?? 0] ?? `Waypoint ${(selectedIdx ?? 0) + 1}`}
              </p>
            </div>
            <p className="text-[10px]" style={{ color: "#8aad96" }}>
              {formatTime(selectedPoint.ts)} · AQI {selectedPoint.aqi} · dose {selectedPoint.dose_ug.toFixed(0)} μg·min
            </p>
          </button>
        )}

        {/* Gradient bleed into journey strip — route + mobile only */}
        {view === "route" && (
          <div
            className="absolute bottom-0 inset-x-0 pointer-events-none z-[350] md:hidden"
            style={{ height: "38%", background: "linear-gradient(to bottom, transparent 0%, #030e07 100%)" }}
          />
        )}
      </div>

      {/* ══ AQI JOURNEY STRIP — mobile · route view only ════════════════════ */}
      {view === "route" && mapPoints.length > 0 && (() => {
        const peakPt = mapPoints.reduce((a, b) => b.aqi > a.aqi ? b : a, mapPoints[0]);
        return (
          <div className="md:hidden w-full flex flex-col" style={{ background: "#030e07" }}>
            <div className="flex items-center justify-between px-4 pt-2 pb-0.5">
              <span className="text-[9px] uppercase tracking-[1.2px]" style={{ color: "#1e3828" }}>
                Route · {mapPoints.length} stops
              </span>
              <span className="text-[9px] tabular-nums" style={{ color: aqiColor(peakPt.aqi) }}>
                peak {peakPt.aqi}
              </span>
            </div>
            <div className="flex items-end gap-px h-9 px-1 pb-1">
              {mapPoints.map((p, i) => {
                const pct = Math.max(18, Math.round((p.aqi / 500) * 100));
                return (
                  <div
                    key={i}
                    className="flex-1"
                    style={{ height: `${pct}%`, background: aqiColor(p.aqi), borderRadius: "2px 2px 0 0", opacity: 0.85 }}
                  />
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ══ STATS / PULSE CONTROLS ══════════════════════════════════════════ */}
      <div className="w-full md:w-[340px] md:shrink-0 flex flex-col gap-3 px-4 py-4 md:px-0 md:py-0">

        {view === "pulse" ? (
          /* ─── Pulse controls ────────────────────────────────────────────── */
          <div style={{ background: "#0d1f12", border: "1px solid rgba(61,139,94,0.18)", borderRadius: 16, padding: "16px 20px" }}>
            {historyLoading && (
              <p style={{ fontSize: 11, color: "#4d7a5e", marginBottom: 12 }}>Loading 24h history…</p>
            )}
            {pulseControls}
          </div>
        ) : (
          /* ─── Route stats ───────────────────────────────────────────────── */
          <>
            {/* Hero: dose + cigarettes */}
            <div
              className="rounded-2xl p-4 flex items-center gap-4 relative overflow-hidden"
              style={{ background: "linear-gradient(135deg, rgba(196,75,43,0.10), rgba(212,160,23,0.06))", border: "1px solid rgba(196,75,43,0.30)" }}
            >
              <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full pointer-events-none" style={{ background: "radial-gradient(circle, rgba(196,75,43,0.20), transparent 70%)" }} />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase tracking-[0.8px] mb-1" style={{ color: "#c44b2b" }}>Today's dose</p>
                <p className="font-display text-3xl font-black tabular-nums leading-none" style={{ color: "#f0bb2a" }}>
                  {totalDose.toFixed(0)}
                  <span className="text-sm font-normal ml-1" style={{ color: "#8aad96" }}>μg·min</span>
                </p>
                <p className="text-xs mt-1.5" style={{ color: "#e05a38" }}>
                  ≡ <strong className="tabular-nums">{cigs}</strong> cigarettes inhaled
                </p>
              </div>
            </div>

            {/* Stat grid */}
            <div className="grid grid-cols-3 gap-2">
              <StatTile icon={<Navigation className="w-3.5 h-3.5" />} label="Distance" value={`${distance}`} unit="km" />
              <StatTile icon={<Clock      className="w-3.5 h-3.5" />} label="Duration" value={duration}      unit="" />
              <StatTile icon={<Activity   className="w-3.5 h-3.5" />} label="Avg AQI"  value={`${avgAqi}`}   unit="" color={aqiColor(avgAqi)} />
            </div>

            {/* Peak window */}
            {peak && (
              <div className="rounded-2xl px-4 py-3 flex items-center gap-3" style={{ background: "rgba(196,75,43,0.06)", border: "1px solid rgba(196,75,43,0.20)" }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(196,75,43,0.18)" }}>
                  <AlertTriangle className="w-4 h-4" style={{ color: "#e05a38" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] uppercase tracking-[0.6px]" style={{ color: "#e05a38" }}>Peak exposure</p>
                  <p className="text-sm font-semibold text-parchment">
                    {formatTime(peak.startTs)} – {formatTime(peak.endTs)}
                    <span className="ml-2 font-normal tabular-nums" style={{ color: aqiColor(peak.aqi) }}>AQI {peak.aqi}</span>
                  </p>
                  <p className="text-[10px]" style={{ color: "#8aad96" }}>Avoid this window tomorrow — take the bypass.</p>
                </div>
              </div>
            )}

            {/* Live-track CTA */}
            <button
              onClick={tracking ? stopTracking : startTracking}
              className="w-full rounded-2xl py-3.5 px-4 flex items-center justify-center gap-2 text-sm font-bold transition-all hover:opacity-90"
              style={tracking
                ? { background: "rgba(196,75,43,0.15)", border: "1px solid rgba(196,75,43,0.4)", color: "#e05a38" }
                : { background: "linear-gradient(135deg,#3d8b5e,#4fa870)", color: "#0a1a0f", boxShadow: "0 6px 20px rgba(79,168,112,0.30)" }}
            >
              {tracking ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
              {tracking ? "Stop tracking" : "Start live tracking"}
            </button>

            {tracking && (
              <p className="text-[11px] flex items-center gap-2" style={{ color: "#6dc48d" }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#4fa870", animation: "pulse-dot 1.4s infinite" }} />
                Recording · {livePoints.length} point{livePoints.length !== 1 ? "s" : ""} logged
              </p>
            )}
            {trackError && (
              <p className="text-[11px] rounded-lg px-3 py-2" style={{ color: "#c44b2b", background: "rgba(196,75,43,0.10)", border: "1px solid rgba(196,75,43,0.20)" }}>
                {trackError}
              </p>
            )}

            {/* Route segments */}
            {mapPoints.length > 0 && (
              <Card className="flex flex-col gap-2.5 mt-1">
                <div className="flex items-center gap-2">
                  <Wind className="w-3.5 h-3.5" style={{ color: "#7dc99a" }} />
                  <h2 className="font-semibold text-parchment text-sm flex-1">Route segments</h2>
                  <span className="text-[10px]" style={{ color: "#4d7a5e" }}>{mapPoints.length} stops</span>
                </div>
                <div className="flex flex-col gap-1.5">
                  {mapPoints.map((p, i) => {
                    const isSelected = selectedIdx === i;
                    const color = aqiColor(p.aqi);
                    const isPeakStop = peak && Math.abs(p.ts - ((peak.startTs + peak.endTs) / 2)) < 1800;
                    return (
                      <button
                        key={i}
                        onClick={() => setSelectedIdx(isSelected ? null : i)}
                        className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left transition-all"
                        style={{ background: isSelected ? `${color}14` : "transparent", border: isSelected ? `1px solid ${color}55` : "1px solid transparent" }}
                      >
                        <span className="shrink-0 inline-flex items-center justify-center font-bold tabular-nums" style={{ width: 32, height: 22, borderRadius: 6, background: color, color: "#0a1a0f", fontSize: 10 }}>
                          {p.aqi}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-parchment truncate">
                            {SEGMENT_LABELS[i] ?? `Waypoint ${i + 1}`}
                          </p>
                          <p className="text-[10px]" style={{ color: "#4d7a5e" }}>
                            {formatTime(p.ts)} · {p.dose_ug.toFixed(0)} μg·min
                          </p>
                        </div>
                        {isPeakStop && (
                          <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded shrink-0" style={{ background: "rgba(196,75,43,0.18)", color: "#e05a38" }}>
                            Peak
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </Card>
            )}

            {/* 7-day trend */}
            {isDemo && (
              <Card className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-3.5 h-3.5" style={{ color: "#7dc99a" }} />
                  <h2 className="font-semibold text-parchment text-sm">7-day AQI history</h2>
                </div>
                <WeeklyChart days={DEMO_WEEKLY} />
              </Card>
            )}
          </>
        )}
      </div>

      {/* ── Global CSS ────────────────────────────────────────────────────── */}
      <style>{`
        /* 3D perspective tilt on mobile — map layer only, overlays stay flat */
        @media (max-width: 767px) {
          .map-3d-mobile {
            transform: perspective(1100px) rotateX(5deg);
            transform-origin: 50% 100%;
            will-change: transform;
          }
        }

        .pulse-scrubber {
          -webkit-appearance: none; appearance: none;
          height: 36px; background: transparent; outline: none;
          cursor: pointer; padding: 0; display: block;
        }
        .pulse-scrubber::-webkit-slider-runnable-track {
          height: 3px;
          background: linear-gradient(to right, ${pulseColor} ${scrubPercent}%, rgba(61,139,94,0.18) ${scrubPercent}%);
          border-radius: 99px;
        }
        .pulse-scrubber::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 28px; height: 28px; border-radius: 50%;
          background: conic-gradient(from 0deg, #1a3022 0%, #4fa870 35%, #2d5040 55%, #4d7a5e 75%, #1a3022 100%);
          border: 2.5px solid ${pulseColor}; margin-top: -13px;
          box-shadow: 0 0 14px ${pulseColor}66, 0 2px 8px rgba(0,0,0,0.45);
          cursor: grab; transition: border-color 0.4s, box-shadow 0.4s;
        }
        .pulse-scrubber:active::-webkit-slider-thumb {
          cursor: grabbing;
          box-shadow: 0 0 22px ${pulseColor}99, 0 2px 10px rgba(0,0,0,0.55);
        }
        .pulse-scrubber::-moz-range-track {
          height: 3px; background: rgba(61,139,94,0.18); border-radius: 99px;
        }
        .pulse-scrubber::-moz-range-progress {
          height: 3px; background: ${pulseColor}; border-radius: 99px;
        }
        .pulse-scrubber::-moz-range-thumb {
          width: 26px; height: 26px; border-radius: 50%;
          background: conic-gradient(from 0deg, #1a3022 0%, #4fa870 35%, #2d5040 55%, #4d7a5e 75%, #1a3022 100%);
          border: 2px solid ${pulseColor};
          box-shadow: 0 0 12px ${pulseColor}66; cursor: grab;
        }
      `}</style>
    </div>
  );
}

function StatTile({
  icon, label, value, unit, color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  unit: string;
  color?: string;
}) {
  return (
    <div className="rounded-xl px-3 py-2.5 flex flex-col gap-1" style={{ background: "#112217", border: "1px solid rgba(61,139,94,0.18)" }}>
      <div className="flex items-center gap-1.5" style={{ color: color ?? "#7dc99a" }}>
        {icon}
        <span className="text-[9px] uppercase tracking-[0.6px]" style={{ color: "#4d7a5e" }}>{label}</span>
      </div>
      <p className="font-display text-lg font-bold leading-none tabular-nums" style={{ color: color ?? "#f2ede4" }}>
        {value}
        {unit && <span className="text-[10px] font-normal ml-1" style={{ color: "#8aad96" }}>{unit}</span>}
      </p>
    </div>
  );
}
