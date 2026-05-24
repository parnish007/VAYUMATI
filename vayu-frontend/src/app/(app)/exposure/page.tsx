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
import { aqiColor, aqiLabelShort, cigaretteEquiv } from "@/lib/aqi";
import { Card } from "@/components/ui/Card";
import { WeeklyChart } from "@/components/ui/WeeklyChart";
import { DEFAULT_WARD_ID } from "@/lib/constants";
import {
  DEMO_EXPOSURE_REPORT,
  DEMO_WEEKLY,
  DEMO_USER_IDENTITY,
} from "@/lib/demoData";
import type { ExposurePoint } from "@/types";

const ExposureMap = dynamic(() => import("@/components/ui/ExposureMap"), {
  ssr: false,
  loading: () => (
    <div
      className="flex items-center justify-center"
      style={{ height: "60vh", background: "#05100a" }}
    >
      <span style={{ color: "#4d7a5e", fontSize: 12, letterSpacing: 1 }}>
        LOADING MAP
      </span>
    </div>
  ),
});

const WARD_ID = DEFAULT_WARD_ID;

// ─── Place names ─────────────────────────────────────────────────────────────
// We don't have a real reverse-geocoder; these labels narrate the demo route
// in plain English so the segments list reads like a commute, not coordinates.
const SEGMENT_LABELS = [
  "Home — Thimi East",
  "Walk to bus stop",
  "Bus stop · main road",
  "Thimi Chowk",
  "Kiln corridor · Sallaghari",
  "Diesel chowk — peak exposure",
  "Office — Naxal",
  "Office (indoor break)",
  "Lunch walk",
  "Back to office",
  "Evening commute",
  "Approaching home",
];

function formatTime(ts: number) {
  return new Date(ts * 1000).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function durationLabel(points: ExposurePoint[]) {
  if (points.length < 2) return "—";
  const mins = Math.round((points[points.length - 1].ts - points[0].ts) / 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

// Approximate ground distance in km (haversine, good enough for a route span)
function totalDistanceKm(points: ExposurePoint[]): number {
  if (points.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const R = 6371;
    const dLat = ((b.lat - a.lat) * Math.PI) / 180;
    const dLng = ((b.lng - a.lng) * Math.PI) / 180;
    const x =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((a.lat * Math.PI) / 180) *
        Math.cos((b.lat * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    total += 2 * R * Math.asin(Math.sqrt(x));
  }
  return Math.round(total * 10) / 10;
}

function findPeakWindow(points: ExposurePoint[]): { startTs: number; endTs: number; aqi: number } | null {
  if (points.length === 0) return null;
  let max = points[0];
  for (const p of points) if (p.aqi > max.aqi) max = p;
  // Pick a ~60-min window centred on the peak point for label purposes.
  const halfWindow = 1800; // 30 min
  return { startTs: max.ts - halfWindow, endTs: max.ts + halfWindow, aqi: max.aqi };
}

export default function ExposurePage() {
  const { air } = useAir(WARD_ID);
  const { role } = useDemo();
  const { isDemo: isDemoSession } = useCurrentUser();
  const isDemo = isDemoSession; // login overrides demo toggle
  const identity = DEMO_USER_IDENTITY[role];

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

  // ─── Build the route the map renders ─────────────────────────────────────
  // Priority: live-tracked points (if any) → backend report → demo report.
  const mapPoints: ExposurePoint[] = useMemo(() => {
    if (livePoints.length > 0) return livePoints;
    if (report?.points && report.points.length > 0) return report.points;
    return [];
  }, [livePoints, report]);

  // ─── Stats ───────────────────────────────────────────────────────────────
  const avgAqi  = mapPoints.length
    ? Math.round(mapPoints.reduce((a, p) => a + p.aqi, 0) / mapPoints.length)
    : 0;
  const totalDose = report?.total_dose_ug ?? mapPoints.reduce((a, p) => a + p.dose_ug, 0);
  const cigs      = report?.cigarette_equiv ?? cigaretteEquiv(totalDose);
  const distance  = totalDistanceKm(mapPoints);
  const duration  = durationLabel(mapPoints);
  const peak      = findPeakWindow(mapPoints);
  const currentAqi = air?.aqi ?? (isDemo ? 167 : 0);
  const currentColor = aqiColor(currentAqi);

  // ─── Tracking ────────────────────────────────────────────────────────────
  function startTracking() {
    if (!navigator.geolocation) {
      setTrackError("Geolocation not available on this device.");
      return;
    }
    setTracking(true);
    setTrackError("");
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
        () => setTrackError("Location permission denied — enable it to log your route.")
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

  return (
    <div className="-mx-4 -my-4 md:mx-0 md:my-0 flex flex-col md:flex-row md:gap-4 md:items-start animate-fade-up">

      {/* ══ MAP ══════════════════════════════════════════════════════════════ */}
      <div className="relative w-full md:flex-1 md:rounded-2xl md:overflow-hidden"
        style={{ minHeight: "56vh" }}>
        <div className="absolute inset-0">
          {mapPoints.length > 0 ? (
            <ExposureMap
              points={mapPoints}
              height="100%"
              selectedIdx={selectedIdx}
              onSelect={setSelectedIdx}
              showLivePulse={tracking || isDemo}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-3"
              style={{ background: "#05100a" }}>
              <Navigation className="w-7 h-7" style={{ color: "#2d5040" }} />
              <p className="text-xs" style={{ color: "#4d7a5e" }}>
                No route logged yet. Start tracking below.
              </p>
            </div>
          )}
        </div>

        {/* Floating top bar — identity, date, live AQI pill */}
        <div className="absolute top-0 inset-x-0 z-[400] flex items-start justify-between p-3 pointer-events-none">
          <div
            className="rounded-xl px-3 py-2 pointer-events-auto"
            style={{
              background: "rgba(8,15,10,0.78)",
              border: "1px solid rgba(61,139,94,0.22)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
            }}
          >
            <p className="text-[10px] uppercase tracking-[0.8px]" style={{ color: "#7dc99a" }}>
              Personal exposure
            </p>
            <p className="text-sm font-semibold text-parchment leading-tight">
              {isDemo ? identity.firstName : "You"}
              <span className="ml-1.5 font-normal" style={{ color: "#8aad96" }}>
                · {new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
              </span>
            </p>
          </div>

          {/* Live AQI capsule */}
          <div
            className="rounded-xl px-3 py-2 pointer-events-auto flex items-center gap-2.5"
            style={{
              background: "rgba(8,15,10,0.78)",
              border: `1px solid ${currentColor}66`,
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
            }}
          >
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ background: currentColor, animation: "pulse-dot 1.6s infinite" }}
            />
            <div className="text-right">
              <p className="font-display text-base font-bold leading-none tabular-nums" style={{ color: currentColor }}>
                {currentAqi}
              </p>
              <p className="text-[9px] leading-none mt-0.5" style={{ color: "#8aad96" }}>
                Ward {WARD_ID} · {aqiLabelShort(currentAqi)}
              </p>
            </div>
          </div>
        </div>

        {/* Floating AQI scale legend — bottom-left of map */}
        <div
          className="absolute bottom-3 left-3 z-[400] flex items-center gap-1.5 rounded-full px-2.5 py-1.5"
          style={{
            background: "rgba(8,15,10,0.78)",
            border: "1px solid rgba(61,139,94,0.22)",
            backdropFilter: "blur(8px)",
          }}
        >
          <span className="text-[9px] uppercase tracking-[0.5px] mr-1" style={{ color: "#8aad96" }}>
            AQI
          </span>
          {[
            { c: "#3d8b5e", l: "0" },
            { c: "#d4a017", l: "100" },
            { c: "#e8600a", l: "150" },
            { c: "#c44b2b", l: "200" },
            { c: "#7b2d8b", l: "300+" },
          ].map((seg, i, arr) => (
            <div key={i} className="flex items-center gap-1.5">
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: seg.c, boxShadow: `0 0 6px ${seg.c}88` }}
              />
              <span className="text-[9px] tabular-nums" style={{ color: "#8aad96" }}>
                {seg.l}
              </span>
              {i < arr.length - 1 && (
                <span className="text-[9px]" style={{ color: "#2d5040" }}>·</span>
              )}
            </div>
          ))}
        </div>

        {/* Selected waypoint chip — bottom-right of map */}
        {selectedPoint && (
          <button
            onClick={() => setSelectedIdx(null)}
            className="absolute bottom-3 right-3 z-[400] rounded-xl px-3 py-2 text-left pointer-events-auto"
            style={{
              background: "rgba(8,15,10,0.88)",
              border: `1px solid ${aqiColor(selectedPoint.aqi)}66`,
              backdropFilter: "blur(12px)",
              maxWidth: 220,
            }}
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

        {/* Gradient bleed — map colour flows into the fingerprint strip below */}
        <div
          className="absolute bottom-0 inset-x-0 pointer-events-none z-[350] md:hidden"
          style={{ height: "38%", background: "linear-gradient(to bottom, transparent 0%, #030e07 100%)" }}
        />
      </div>

      {/* ══ AQI JOURNEY STRIP — CSS bars, mobile only ══════════════════════
           Shows the AQI reading at each route waypoint as coloured bars.
           Sits between the map and stats so data flows continuously.         */}
      {mapPoints.length > 0 && (() => {
        const peak2 = mapPoints.reduce((a, b) => b.aqi > a.aqi ? b : a, mapPoints[0]);
        return (
          <div className="md:hidden w-full flex flex-col" style={{ background: "#030e07" }}>
            <div className="flex items-center justify-between px-4 pt-2 pb-0.5">
              <span className="text-[9px] uppercase tracking-[1.2px]" style={{ color: "#1e3828", fontVariantNumeric: "tabular-nums" }}>
                Route · {mapPoints.length} pts
              </span>
              <span className="text-[9px] tabular-nums" style={{ color: aqiColor(peak2.aqi) }}>
                peak {peak2.aqi}
              </span>
            </div>
            <div className="flex items-end gap-px h-9 px-1 pb-1">
              {mapPoints.map((p, i) => {
                const pct = Math.max(18, Math.round((p.aqi / 500) * 100));
                return (
                  <div
                    key={i}
                    className="flex-1"
                    style={{
                      height: `${pct}%`,
                      background: aqiColor(p.aqi),
                      borderRadius: "1px 1px 0 0",
                      opacity: 0.82,
                    }}
                  />
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ══ STATS PANEL ═════════════════════════════════════════════════════ */}
      <div className="w-full md:w-[340px] md:shrink-0 flex flex-col gap-3 px-4 py-4 md:px-0 md:py-0">

        {/* Hero card: dose + cigarettes */}
        <div
          className="rounded-2xl p-4 flex items-center gap-4 relative overflow-hidden"
          style={{
            background: "linear-gradient(135deg, rgba(196,75,43,0.10), rgba(212,160,23,0.06))",
            border: "1px solid rgba(196,75,43,0.30)",
          }}
        >
          <div
            className="absolute -right-6 -top-6 w-24 h-24 rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(196,75,43,0.20), transparent 70%)" }}
          />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-[0.8px] mb-1" style={{ color: "#c44b2b" }}>
              Today's dose
            </p>
            <p className="font-display text-3xl font-black tabular-nums leading-none" style={{ color: "#f0bb2a" }}>
              {totalDose.toFixed(0)}
              <span className="text-sm font-normal ml-1" style={{ color: "#8aad96" }}>
                μg·min
              </span>
            </p>
            <p className="text-xs mt-1.5" style={{ color: "#e05a38" }}>
              ≡ <strong className="tabular-nums">{cigs}</strong> cigarettes inhaled
            </p>
          </div>
        </div>

        {/* Stat grid: distance, duration, peak */}
        <div className="grid grid-cols-3 gap-2">
          <StatTile icon={<Navigation className="w-3.5 h-3.5" />} label="Distance" value={`${distance}`} unit="km" />
          <StatTile icon={<Clock      className="w-3.5 h-3.5" />} label="Duration" value={duration}        unit="" />
          <StatTile icon={<Activity   className="w-3.5 h-3.5" />} label="Avg AQI"  value={`${avgAqi}`}     unit="" color={aqiColor(avgAqi)} />
        </div>

        {/* Peak exposure window */}
        {peak && (
          <div
            className="rounded-2xl px-4 py-3 flex items-center gap-3"
            style={{
              background: "rgba(196,75,43,0.06)",
              border: "1px solid rgba(196,75,43,0.20)",
            }}
          >
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "rgba(196,75,43,0.18)" }}
            >
              <AlertTriangle className="w-4 h-4" style={{ color: "#e05a38" }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-[0.6px]" style={{ color: "#e05a38" }}>
                Peak exposure
              </p>
              <p className="text-sm font-semibold text-parchment">
                {formatTime(peak.startTs)} – {formatTime(peak.endTs)}
                <span className="ml-2 font-normal tabular-nums" style={{ color: aqiColor(peak.aqi) }}>
                  AQI {peak.aqi}
                </span>
              </p>
              <p className="text-[10px]" style={{ color: "#8aad96" }}>
                Avoid this window tomorrow — take the bypass.
              </p>
            </div>
          </div>
        )}

        {/* Live-track CTA (primary) */}
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
          <p className="text-[11px] rounded-lg px-3 py-2"
            style={{ color: "#c44b2b", background: "rgba(196,75,43,0.10)", border: "1px solid rgba(196,75,43,0.20)" }}>
            {trackError}
          </p>
        )}

        {/* Route segments list */}
        {mapPoints.length > 0 && (
          <Card className="flex flex-col gap-2.5 mt-1">
            <div className="flex items-center gap-2">
              <Wind className="w-3.5 h-3.5" style={{ color: "#7dc99a" }} />
              <h2 className="font-semibold text-parchment text-sm flex-1">Route segments</h2>
              <span className="text-[10px]" style={{ color: "#4d7a5e" }}>
                {mapPoints.length} stops
              </span>
            </div>
            <div className="flex flex-col gap-1.5">
              {mapPoints.map((p, i) => {
                const isPeak = peak ? p.ts === (peak.startTs + peak.endTs) / 2 : false;
                const isSelected = selectedIdx === i;
                const color = aqiColor(p.aqi);
                return (
                  <button
                    key={i}
                    onClick={() => setSelectedIdx(isSelected ? null : i)}
                    className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left transition-all"
                    style={{
                      background: isSelected ? `${color}14` : "transparent",
                      border: isSelected ? `1px solid ${color}55` : "1px solid transparent",
                    }}
                  >
                    <span
                      className="shrink-0 inline-flex items-center justify-center font-bold tabular-nums"
                      style={{
                        width: 32, height: 22, borderRadius: 6,
                        background: color, color: "#0a1a0f", fontSize: 10,
                      }}
                    >
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
                    {isPeak && (
                      <span
                        className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded shrink-0"
                        style={{ background: "rgba(196,75,43,0.18)", color: "#e05a38" }}
                      >
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
      </div>
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
    <div
      className="rounded-xl px-3 py-2.5 flex flex-col gap-1"
      style={{ background: "#112217", border: "1px solid rgba(61,139,94,0.18)" }}
    >
      <div className="flex items-center gap-1.5" style={{ color: color ?? "#7dc99a" }}>
        {icon}
        <span className="text-[9px] uppercase tracking-[0.6px]" style={{ color: "#4d7a5e" }}>
          {label}
        </span>
      </div>
      <p className="font-display text-lg font-bold leading-none tabular-nums" style={{ color: color ?? "#f2ede4" }}>
        {value}
        {unit && <span className="text-[10px] font-normal ml-1" style={{ color: "#8aad96" }}>{unit}</span>}
      </p>
    </div>
  );
}
