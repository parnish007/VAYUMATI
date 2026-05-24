"use client";

import { MapContainer, TileLayer } from "react-leaflet";
import type { LatLngExpression } from "leaflet";
import { aqiColor } from "@/lib/aqi";

interface PulseMapProps {
  lat: number;
  lng: number;
  aqi: number;
  auraRadius: number;
}

export default function PulseMap({ lat, lng, aqi, auraRadius }: PulseMapProps) {
  const center: LatLngExpression = [lat, lng];
  const color = aqiColor(aqi);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <MapContainer
        center={center}
        zoom={14}
        zoomControl={false}
        attributionControl={false}
        dragging={false}
        scrollWheelZoom={false}
        doubleClickZoom={false}
        style={{ width: "100%", height: "100%", background: "#0a1a0f" }}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          maxZoom={19}
        />
      </MapContainer>

      {/* CSS aura — centered on ward, transitions with AQI */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: auraRadius * 2,
          height: auraRadius * 2,
          transform: "translate(-50%, -50%)",
          borderRadius: "50%",
          background: `radial-gradient(circle at 50% 50%, ${color}2e 0%, ${color}18 38%, ${color}08 62%, transparent 75%)`,
          boxShadow: `0 0 ${Math.round(auraRadius * 0.55)}px ${color}55, 0 0 ${Math.round(auraRadius * 0.25)}px ${color}88 inset`,
          pointerEvents: "none",
          animation: "aura-breathe 3s ease-in-out infinite",
          transition: "width 0.6s ease, height 0.6s ease, background 0.6s ease, box-shadow 0.6s ease",
          zIndex: 500,
        }}
      />

      {/* Ward center pin */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: 16,
          height: 16,
          transform: "translate(-50%, -50%)",
          borderRadius: "50%",
          background: color,
          border: "2.5px solid rgba(255,255,255,0.4)",
          boxShadow: `0 0 16px ${color}aa, 0 0 6px ${color}`,
          pointerEvents: "none",
          zIndex: 600,
          transition: "background 0.6s ease, box-shadow 0.6s ease",
        }}
      />

      <style>{`
        @keyframes aura-breathe {
          0%, 100% { opacity: 0.88; transform: translate(-50%, -50%) scale(1); }
          50%       { opacity: 0.62; transform: translate(-50%, -50%) scale(1.08); }
        }
      `}</style>
    </div>
  );
}
