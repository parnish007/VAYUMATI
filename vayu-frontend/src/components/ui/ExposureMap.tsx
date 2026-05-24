"use client";

import { useEffect, useMemo, useState } from "react";
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
  showLivePulse?: boolean;
}

const TILES = [
  {
    id: "dark",
    label: "Dark",
    icon: "🌙",
    base: "https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png",
    labels: "https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png",
    attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
  },
  {
    id: "satellite",
    label: "Satellite",
    icon: "🛰️",
    base: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    labels: "https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png",
    attribution: '&copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS',
  },
  {
    id: "street",
    label: "Street",
    icon: "🗺️",
    base: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    labels: null,
    attribution: '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>',
  },
  {
    id: "terrain",
    label: "Terrain",
    icon: "🏔️",
    base: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png",
    labels: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png",
    attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
  },
] as const;

type TileId = (typeof TILES)[number]["id"];

// ─── CSS injected once ───────────────────────────────────────────────────────
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

// ─── Tile switcher button rendered inside the map ────────────────────────────
function TileSwitcher({
  current,
  onChange,
}: {
  current: TileId;
  onChange: (id: TileId) => void;
}) {
  const idx = TILES.findIndex((t) => t.id === current);
  const next = TILES[(idx + 1) % TILES.length];
  const cur = TILES[idx];

  return (
    <div
      style={{
        position: "absolute",
        bottom: 48,
        right: 10,
        zIndex: 1000,
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      {/* Current layer badge */}
      <div
        style={{
          background: "rgba(8,15,10,0.82)",
          border: "1px solid rgba(125,201,154,0.25)",
          backdropFilter: "blur(8px)",
          borderRadius: 8,
          padding: "3px 8px",
          fontSize: 9,
          fontFamily: "var(--font-body, system-ui)",
          color: "#7dc99a",
          letterSpacing: "0.5px",
          textTransform: "uppercase",
          pointerEvents: "none",
          textAlign: "center",
        }}
      >
        {cur.icon} {cur.label}
      </div>

      {/* Cycle button */}
      <button
        onClick={() => onChange(next.id)}
        title={`Switch to ${next.label}`}
        style={{
          background: "rgba(8,15,10,0.88)",
          border: "1px solid rgba(125,201,154,0.28)",
          backdropFilter: "blur(8px)",
          borderRadius: 8,
          padding: "5px 8px",
          fontSize: 10,
          fontFamily: "var(--font-body, system-ui)",
          color: "#c8ddd0",
          cursor: "pointer",
          letterSpacing: "0.3px",
          textAlign: "center",
          lineHeight: 1.3,
        }}
      >
        {next.icon} {next.label} →
      </button>
    </div>
  );
}

export default function ExposureMap({
  points,
  height = 360,
  selectedIdx = null,
  onSelect,
  showLivePulse = true,
}: ExposureMapProps) {
  useEffect(() => { injectStylesOnce(); }, []);

  const [tileId, setTileId] = useState<TileId>("dark");
  const tile = TILES.find((t) => t.id === tileId) ?? TILES[0];

  const center: [number, number] = points.length > 0
    ? [points[0].lat, points[0].lng]
    : [27.700, 85.320];

  const positions = useMemo(
    () => points.map((p) => [p.lat, p.lng] as [number, number]),
    [points]
  );

  const last = points.length > 0 ? points[points.length - 1] : null;
  const pulseIcon = useMemo(() => last ? buildPulseIcon(aqiColor(last.aqi)) : null, [last]);

  return (
    <div style={{ position: "relative", height, width: "100%" }}>
      <MapContainer
        center={center}
        zoom={14}
        style={{ height: "100%", width: "100%", background: "#05100a" }}
        className="vayu-map"
        zoomControl={false}
        attributionControl={false}
        scrollWheelZoom={false}
        dragging={true}
        doubleClickZoom={false}
      >
        <TileLayer key={tile.id + "-base"} url={tile.base} attribution={tile.attribution} />

        {/* Glow auras */}
        {points.map((p, i) => (
          <CircleMarker
            key={`glow-${i}`}
            center={[p.lat, p.lng]}
            radius={Math.max(28, Math.min(60, 24 + (p.aqi / 200) * 36))}
            pathOptions={{ stroke: false, fillColor: aqiColor(p.aqi), fillOpacity: 0.16 }}
            interactive={false}
          />
        ))}

        {/* Per-segment coloured route */}
        {positions.length > 1 && positions.slice(0, -1).map((from, i) => (
          <Polyline
            key={`seg-${i}`}
            positions={[from, positions[i + 1]]}
            pathOptions={{ color: aqiColor(points[i].aqi), weight: 5, opacity: 0.92, lineCap: "round", lineJoin: "round" }}
          />
        ))}

        {/* Outer halo */}
        {positions.length > 1 && (
          <Polyline
            positions={positions}
            pathOptions={{ color: "#7dc99a", weight: 14, opacity: 0.12, lineCap: "round", lineJoin: "round" }}
            interactive={false}
          />
        )}

        {/* Waypoint pills */}
        {points.map((p, i) => {
          if (i === points.length - 1 && showLivePulse) return null;
          return (
            <Marker
              key={`wp-${i}`}
              position={[p.lat, p.lng]}
              icon={buildWaypointPill(p.aqi, selectedIdx === i, i)}
              eventHandlers={onSelect ? { click: () => onSelect(i) } : undefined}
            />
          );
        })}

        {/* Live pulse on last point */}
        {last && showLivePulse && pulseIcon && (
          <Marker
            position={[last.lat, last.lng]}
            icon={pulseIcon}
            eventHandlers={onSelect ? { click: () => onSelect(points.length - 1) } : undefined}
          />
        )}

        {/* Label overlay — skip for OSM (already has labels) */}
        {tile.labels && <TileLayer key={tile.id + "-labels"} url={tile.labels} />}

        {positions.length > 1 && <MapBounds points={points} />}
      </MapContainer>

      {/* Tile switcher — outside MapContainer to avoid Leaflet z-index fights */}
      <TileSwitcher current={tileId} onChange={setTileId} />
    </div>
  );
}
