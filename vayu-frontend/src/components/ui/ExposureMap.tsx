"use client";

import { useEffect, useMemo } from "react";
import L from "leaflet";
import {
  MapContainer,
  TileLayer,
  Polyline,
  CircleMarker,
  Marker,
  useMap,
} from "react-leaflet";
import { aqiColor } from "@/lib/aqi";
import type { ExposurePoint } from "@/types";

interface ExposureMapProps {
  points: ExposurePoint[];
  height?: number | string;
  selectedIdx?: number | null;
  onSelect?: (idx: number) => void;
  /** Pulse the last point as the "current location". Default: true. */
  showLivePulse?: boolean;
}

const DARK_TILES = "https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png";
const LABEL_TILES = "https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png";
const ATTRIBUTION = '&copy; <a href="https://carto.com/" target="_blank">CARTO</a>';

// ─── Pulse + marker CSS (injected once, idempotent) ──────────────────────────
const STYLES = `
@keyframes vayu-pulse {
  0%   { transform: scale(1);   opacity: 0.60; }
  70%  { transform: scale(3.2); opacity: 0;    }
  100% { transform: scale(3.2); opacity: 0;    }
}
@keyframes vayu-wp-in {
  from { opacity: 0; transform: translate(-50%, -50%) scale(0.3); }
  to   { opacity: 1; transform: translate(-50%, -50%) scale(1);   }
}
.vayu-pulse-wrap {
  position: relative;
  width: 22px; height: 22px;
}
.vayu-pulse-ring {
  position: absolute; inset: 0;
  border-radius: 50%;
  animation: vayu-pulse 1.8s ease-out infinite;
}
.vayu-pulse-ring.delay { animation-delay: 0.9s; }
.vayu-pulse-core {
  position: absolute; inset: 6px;
  border-radius: 50%;
  border: 2px solid #0a1a0f;
  box-shadow: 0 2px 10px rgba(0,0,0,0.5);
}
.vayu-waypoint {
  background: transparent !important;
  border: none !important;
}
.vayu-waypoint-pill {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 3px 7px;
  border-radius: 999px;
  font: 700 10px/1 var(--font-body, system-ui, sans-serif);
  letter-spacing: 0.2px;
  color: #0a1a0f;
  border: 1.5px solid #0a1a0f;
  box-shadow: 0 2px 8px rgba(0,0,0,0.45);
  transform: translate(-50%, -50%);
  white-space: nowrap;
  animation: vayu-wp-in 0.28s ease-out both;
}
.vayu-waypoint-pill.selected {
  outline: 2px solid #f2ede4;
  outline-offset: 1px;
}
.vayu-waypoint-pill .dot {
  width: 5px; height: 5px; border-radius: 50%; background: #0a1a0f;
}
.leaflet-container.vayu-map {
  font-family: var(--font-body, system-ui, sans-serif);
}
`;

function injectStylesOnce() {
  if (typeof document === "undefined") return;
  if (document.getElementById("vayu-exposure-map-styles")) return;
  const s = document.createElement("style");
  s.id = "vayu-exposure-map-styles";
  s.innerHTML = STYLES;
  document.head.appendChild(s);
}

function MapBounds({ points }: { points: ExposurePoint[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length < 2) return;
    const latlngs = points.map((p) => [p.lat, p.lng] as [number, number]);
    map.fitBounds(latlngs as [[number, number], [number, number]], {
      padding: [56, 56],
      animate: true,
      duration: 0.6,
    });
  }, [points, map]);
  return null;
}

function buildPulseIcon(color: string) {
  return L.divIcon({
    className: "vayu-waypoint",
    html: `
      <div class="vayu-pulse-wrap">
        <div class="vayu-pulse-ring" style="background:${color};"></div>
        <div class="vayu-pulse-ring delay" style="background:${color};"></div>
        <div class="vayu-pulse-core" style="background:${color};"></div>
      </div>
    `,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

function buildWaypointPill(aqi: number, selected: boolean, idx: number) {
  const color = aqiColor(aqi);
  return L.divIcon({
    className: "vayu-waypoint",
    html: `
      <div class="vayu-waypoint-pill${selected ? " selected" : ""}" style="background:${color};animation-delay:${idx * 80}ms;">
        <span class="dot"></span>
        <span>${aqi}</span>
      </div>
    `,
    iconSize: [44, 22],
    iconAnchor: [22, 11],
  });
}

export default function ExposureMap({
  points,
  height = 360,
  selectedIdx = null,
  onSelect,
  showLivePulse = true,
}: ExposureMapProps) {
  useEffect(() => { injectStylesOnce(); }, []);

  const center: [number, number] = points.length > 0
    ? [points[0].lat, points[0].lng]
    : [27.717, 85.324];

  const positions = useMemo(
    () => points.map((p) => [p.lat, p.lng] as [number, number]),
    [points]
  );

  const last = points.length > 0 ? points[points.length - 1] : null;
  const pulseIcon = useMemo(() => last ? buildPulseIcon(aqiColor(last.aqi)) : null, [last]);

  return (
    <MapContainer
      center={center}
      zoom={15}
      style={{ height, width: "100%", background: "#05100a" }}
      className="vayu-map"
      zoomControl={false}
      attributionControl={false}
      scrollWheelZoom={false}
      dragging={true}
      doubleClickZoom={false}
    >
      <TileLayer url={DARK_TILES} attribution={ATTRIBUTION} />

      {/* Soft glow under each point — shows exposure intensity */}
      {points.map((p, i) => (
        <CircleMarker
          key={`glow-${i}`}
          center={[p.lat, p.lng]}
          radius={Math.max(28, Math.min(60, 24 + (p.aqi / 200) * 36))}
          pathOptions={{
            stroke: false,
            fillColor: aqiColor(p.aqi),
            fillOpacity: 0.16,
          }}
          interactive={false}
        />
      ))}

      {/* Gradient route: render each segment as its own polyline, coloured by
          the starting waypoint's AQI. Creates a smooth visual gradient
          along the route without needing a real shader. */}
      {positions.length > 1 && positions.slice(0, -1).map((from, i) => {
        const to = positions[i + 1];
        const c = aqiColor(points[i].aqi);
        return (
          <Polyline
            key={`seg-${i}`}
            positions={[from, to]}
            pathOptions={{
              color: c,
              weight: 5,
              opacity: 0.92,
              lineCap: "round",
              lineJoin: "round",
            }}
          />
        );
      })}

      {/* Faint outer halo line for premium "glow" feel */}
      {positions.length > 1 && (
        <Polyline
          positions={positions}
          pathOptions={{
            color: "#7dc99a",
            weight: 14,
            opacity: 0.12,
            lineCap: "round",
            lineJoin: "round",
          }}
          interactive={false}
        />
      )}

      {/* Waypoint pills — every point except the last (last is the live pulse) */}
      {points.map((p, i) => {
        const isLast = i === points.length - 1 && showLivePulse;
        if (isLast) return null;
        return (
          <Marker
            key={`wp-${i}`}
            position={[p.lat, p.lng]}
            icon={buildWaypointPill(p.aqi, selectedIdx === i, i)}
            eventHandlers={onSelect ? { click: () => onSelect(i) } : undefined}
          />
        );
      })}

      {/* Live "current location" pulse on the last point */}
      {last && showLivePulse && pulseIcon && (
        <Marker
          position={[last.lat, last.lng]}
          icon={pulseIcon}
          eventHandlers={onSelect ? { click: () => onSelect(points.length - 1) } : undefined}
        />
      )}

      {/* Labels layer on top — keeps street names readable above route */}
      <TileLayer url={LABEL_TILES} />

      {positions.length > 1 && <MapBounds points={points} />}
    </MapContainer>
  );
}
