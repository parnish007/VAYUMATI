"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import useSWR from "swr";
import { aqiColor, aqiLabel } from "@/lib/aqi";
import { DEFAULT_WARD_ID, DEFAULT_LAT, DEFAULT_LNG, getBackendUrl } from "@/lib/constants";

const PulseMap = dynamic(() => import("@/components/pulse/PulseMap"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        flex: 1,
        background: "#080f0a",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <span style={{ color: "#2d5040", fontSize: 12 }}>Loading map…</span>
    </div>
  ),
});

interface HistoryPoint {
  ts: number;
  aqi: number;
  pm25: number;
}

const WARD_ID = DEFAULT_WARD_ID;

function aqiToRadius(aqi: number): number {
  return Math.round(72 + Math.min(Math.max(aqi, 0), 500) * 0.38);
}

function makeDemoHistory(): HistoryPoint[] {
  const now = Math.floor(Date.now() / 1000);
  return Array.from({ length: 288 }, (_, i) => {
    const frac = i / 288;
    const base =
      118 +
      Math.sin(frac * Math.PI * 4.2) * 52 +
      Math.sin(frac * Math.PI * 2.1) * 28;
    const aqi = Math.max(22, Math.min(340, Math.round(base)));
    return {
      ts: now - (288 - i) * 300,
      aqi,
      pm25: Math.round(aqi * 0.39),
    };
  });
}

export default function PulsePage() {
  const { data: history, isLoading } = useSWR<HistoryPoint[]>(
    `${getBackendUrl()}/api/air/${WARD_ID}/history?range=-24h`,
    async (url: string) => {
      const r = await fetch(url, { cache: "no-store" });
      if (!r.ok) return [];
      return (await r.json()) as HistoryPoint[];
    },
    { refreshInterval: 300_000 }
  );

  const points = useMemo<HistoryPoint[]>(() => {
    if (!history || history.length === 0) return makeDemoHistory();
    return history;
  }, [history]);

  // null = pinned to "live" (last point); number = scrubbed index
  const [scrubIdx, setScrubIdx] = useState<number | null>(null);
  const isLive = scrubIdx === null;
  const currentIdx = scrubIdx ?? points.length - 1;
  const point = points[currentIdx] ?? points[points.length - 1];

  const color = point ? aqiColor(point.aqi) : "#4fa870";
  const radius = point ? aqiToRadius(point.aqi) : 124;

  const percent =
    points.length > 1
      ? ((currentIdx / (points.length - 1)) * 100).toFixed(1)
      : "100";

  function formatTime(ts: number) {
    return new Date(ts * 1000).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }
  function formatDate(ts: number) {
    return new Date(ts * 1000).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  }

  // Sparkline path for the 24h mini-chart behind the scrubber
  const sparkline = useMemo(() => {
    if (points.length < 2) return "";
    const W = 300;
    const H = 18;
    const maxAqi = Math.max(...points.map((p) => p.aqi));
    const minAqi = Math.min(...points.map((p) => p.aqi));
    const range = maxAqi - minAqi || 1;
    const step = W / (points.length - 1);
    return points
      .map((p, i) => {
        const x = (i * step).toFixed(1);
        const y = (H - ((p.aqi - minAqi) / range) * H).toFixed(1);
        return `${i === 0 ? "M" : "L"}${x},${y}`;
      })
      .join(" ");
  }, [points]);

  const controlPanel = (
    <>
      {/* AQI + timestamp */}
      {point && (
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            marginBottom: 10,
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              <span
                style={{
                  fontFamily: "var(--font-fraunces)",
                  fontSize: 50,
                  fontWeight: 700,
                  lineHeight: 1,
                  color,
                  textShadow: `0 0 28px ${color}55`,
                  transition: "color 0.4s, text-shadow 0.4s",
                }}
              >
                {point.aqi}
              </span>
              <span style={{ fontSize: 12, color: "#4d7a5e", fontWeight: 600 }}>
                AQI
              </span>
            </div>
            <p
              style={{
                fontSize: 11,
                fontWeight: 600,
                color,
                marginTop: 2,
                transition: "color 0.4s",
              }}
            >
              {aqiLabel(point.aqi)}
            </p>
          </div>
          <div style={{ textAlign: "right" }}>
            <p
              style={{
                fontFamily: "var(--font-fraunces)",
                fontSize: 26,
                fontWeight: 700,
                color: "#c8ddd0",
                letterSpacing: "-0.5px",
              }}
            >
              {formatTime(point.ts)}
            </p>
            <p style={{ fontSize: 10, color: "#4d7a5e" }}>
              {formatDate(point.ts)}
            </p>
          </div>
        </div>
      )}

      {/* Tags */}
      {point && (
        <div
          style={{
            display: "flex",
            gap: 6,
            flexWrap: "wrap",
            marginBottom: 14,
          }}
        >
          <span
            style={{
              padding: "3px 9px",
              borderRadius: 12,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(61,139,94,0.18)",
              fontSize: 10,
              color: "#8aad96",
            }}
          >
            PM2.5{" "}
            <b style={{ color: "#c8ddd0" }}>{point.pm25.toFixed(1)}</b> μg/m³
          </span>
          <span
            style={{
              padding: "3px 9px",
              borderRadius: 12,
              background: isLive
                ? "rgba(79,168,112,0.10)"
                : "rgba(255,255,255,0.04)",
              border: isLive
                ? "1px solid rgba(79,168,112,0.30)"
                : "1px solid rgba(61,139,94,0.12)",
              fontSize: 10,
              fontWeight: isLive ? 700 : 400,
              color: isLive ? "#4fa870" : "#4d7a5e",
            }}
          >
            {isLive
              ? "● Live"
              : `${points.length - 1 - currentIdx} steps before now`}
          </span>
        </div>
      )}

      {/* Vinyl scrubber */}
      <div style={{ position: "relative" }}>
        <svg
          viewBox="0 0 300 18"
          preserveAspectRatio="none"
          style={{
            position: "absolute",
            top: "50%",
            left: 0,
            right: 0,
            width: "100%",
            height: 22,
            transform: "translateY(-50%)",
            opacity: 0.32,
            pointerEvents: "none",
          }}
        >
          <path
            d={sparkline}
            fill="none"
            stroke={color}
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <input
          type="range"
          min={0}
          max={Math.max(0, points.length - 1)}
          value={currentIdx}
          onChange={(e) => {
            const v = Number(e.target.value);
            setScrubIdx(v >= points.length - 1 ? null : v);
          }}
          className="pulse-scrubber"
          style={{ width: "100%", position: "relative", zIndex: 2 }}
        />
      </div>

      {/* Time labels */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 9,
          color: "#2d5040",
          marginTop: 4,
        }}
      >
        <span>24h ago</span>
        <span>12h ago</span>
        <span style={{ color: isLive ? "#4fa870" : "#2d5040" }}>Now</span>
      </div>
    </>
  );

  return (
    <>
      {/* ── Mobile: true full-screen immersive overlay ─────────────── */}
      <div
        className="md:hidden"
        style={{
          position: "fixed",
          inset: 0,
          bottom: 56,
          zIndex: 40,
          display: "flex",
          flexDirection: "column",
          background: "#050d07",
        }}
      >
        {/* Header fade overlay */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 20,
            padding: "14px 18px 48px",
            background:
              "linear-gradient(to bottom, rgba(5,13,7,0.92) 0%, transparent 100%)",
            pointerEvents: "none",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                fontFamily: "var(--font-fraunces)",
                fontSize: 19,
                fontWeight: 700,
                color: "#c8ddd0",
                letterSpacing: "-0.2px",
              }}
            >
              Ward Pulse
            </span>
            {isLive && (
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  background: "rgba(79,168,112,0.15)",
                  border: "1px solid rgba(79,168,112,0.4)",
                  color: "#4fa870",
                  padding: "2px 7px",
                  borderRadius: 20,
                  textTransform: "uppercase",
                  letterSpacing: "0.6px",
                }}
              >
                LIVE
              </span>
            )}
          </div>
          <p style={{ fontSize: 10, color: "#4d7a5e", marginTop: 2 }}>
            24h AQI aura replay · Ward {WARD_ID}
          </p>
        </div>

        {/* Map */}
        <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
          <PulseMap
            lat={DEFAULT_LAT}
            lng={DEFAULT_LNG}
            aqi={point?.aqi ?? 100}
            auraRadius={radius}
          />
          {isLoading && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(5,13,7,0.55)",
                zIndex: 10,
              }}
            >
              <span style={{ color: "#4d7a5e", fontSize: 12 }}>
                Loading 24h history…
              </span>
            </div>
          )}
        </div>

        {/* Controls */}
        <div
          style={{
            background: "rgba(8,15,10,0.98)",
            borderTop: "1px solid rgba(61,139,94,0.22)",
            padding: "14px 20px 18px",
            flexShrink: 0,
          }}
        >
          {controlPanel}
        </div>
      </div>

      {/* ── Desktop: contained layout ──────────────────────────────── */}
      <div className="hidden md:flex md:flex-col md:gap-4 md:max-w-2xl md:mx-auto md:animate-fade-up">
        <div>
          <h1 className="font-display text-2xl font-semibold text-parchment">
            Ward Pulse
          </h1>
          <p className="text-xs mt-0.5" style={{ color: "#4d7a5e" }}>
            24-hour AQI aura replay · Ward {WARD_ID}
          </p>
        </div>

        <div
          style={{
            height: 460,
            borderRadius: 16,
            overflow: "hidden",
            position: "relative",
            border: "1px solid rgba(61,139,94,0.20)",
          }}
        >
          <PulseMap
            lat={DEFAULT_LAT}
            lng={DEFAULT_LNG}
            aqi={point?.aqi ?? 100}
            auraRadius={radius}
          />
          {isLive && (
            <div
              style={{
                position: "absolute",
                top: 14,
                left: 14,
                zIndex: 20,
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "5px 10px",
                borderRadius: 20,
                background: "rgba(8,15,10,0.85)",
                border: "1px solid rgba(61,139,94,0.3)",
                backdropFilter: "blur(8px)",
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: "#4fa870",
                  animation: "pulse-dot 1.6s infinite",
                }}
              />
              <span style={{ fontSize: 10, color: "#7dc99a", fontWeight: 700 }}>
                LIVE
              </span>
            </div>
          )}
        </div>

        <div
          style={{
            background: "#0d1f12",
            border: "1px solid rgba(61,139,94,0.18)",
            borderRadius: 16,
            padding: "16px 20px",
            display: "flex",
            flexDirection: "column",
            gap: 0,
          }}
        >
          {controlPanel}
        </div>
      </div>

      {/* ── Global scrubber styles ─────────────────────────────────── */}
      <style>{`
        .pulse-scrubber {
          -webkit-appearance: none;
          appearance: none;
          height: 36px;
          background: transparent;
          outline: none;
          cursor: pointer;
          padding: 0;
          display: block;
        }
        .pulse-scrubber::-webkit-slider-runnable-track {
          height: 3px;
          background: linear-gradient(
            to right,
            ${color} ${percent}%,
            rgba(61,139,94,0.18) ${percent}%
          );
          border-radius: 99px;
        }
        .pulse-scrubber::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: conic-gradient(
            from 0deg,
            #1a3022 0%,
            #4fa870 35%,
            #2d5040 55%,
            #4d7a5e 75%,
            #1a3022 100%
          );
          border: 2.5px solid ${color};
          margin-top: -13px;
          box-shadow: 0 0 14px ${color}66, 0 2px 8px rgba(0,0,0,0.45);
          cursor: grab;
          transition: border-color 0.4s, box-shadow 0.4s;
        }
        .pulse-scrubber:active::-webkit-slider-thumb {
          cursor: grabbing;
          box-shadow: 0 0 22px ${color}99, 0 2px 10px rgba(0,0,0,0.55);
        }
        .pulse-scrubber::-moz-range-track {
          height: 3px;
          background: rgba(61,139,94,0.18);
          border-radius: 99px;
        }
        .pulse-scrubber::-moz-range-progress {
          height: 3px;
          background: ${color};
          border-radius: 99px;
        }
        .pulse-scrubber::-moz-range-thumb {
          width: 26px;
          height: 26px;
          border-radius: 50%;
          background: conic-gradient(
            from 0deg,
            #1a3022 0%,
            #4fa870 35%,
            #2d5040 55%,
            #4d7a5e 75%,
            #1a3022 100%
          );
          border: 2px solid ${color};
          box-shadow: 0 0 12px ${color}66;
          cursor: grab;
        }
      `}</style>
    </>
  );
}
