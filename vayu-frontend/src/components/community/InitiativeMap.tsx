"use client";

import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";

const CATEGORIES: Record<string, { color: string; icon: string; label: string }> = {
  waste_cleanup:    { color: "#e8600a", icon: "🧹", label: "Waste Cleanup" },
  tree_planting:    { color: "#4fa870", icon: "🌳", label: "Tree Planting" },
  air_monitoring:   { color: "#2d7a9a", icon: "📡", label: "Air Monitoring" },
  community_garden: { color: "#d4a017", icon: "🌱", label: "Community Garden" },
  awareness_drive:  { color: "#7b2d8b", icon: "📢", label: "Awareness Drive" },
};

interface Initiative {
  id: string;
  title: string;
  category: string;
  lat: number;
  lng: number;
  location_name: string;
  scheduled_at: string;
  joined_by: { id: string; name: string }[];
}

interface Props {
  initiatives: Initiative[];
  joinedIds: Set<string>;
  onJoin: (id: string) => void;
}

export default function InitiativeMap({ initiatives, joinedIds, onJoin }: Props) {
  const center: [number, number] =
    initiatives.length > 0
      ? [initiatives[0].lat, initiatives[0].lng]
      : [27.691, 85.38];

  return (
    <MapContainer
      center={center}
      zoom={14}
      scrollWheelZoom={false}
      style={{ height: 360, borderRadius: 12, background: "#0a1a0f" }}
      zoomControl={false}
      attributionControl={false}
    >
      <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
      {initiatives.map((item) => {
        const cat = CATEGORIES[item.category] ?? CATEGORIES.awareness_drive;
        const isJoined = joinedIds.has(item.id);
        return (
          <CircleMarker
            key={item.id}
            center={[item.lat, item.lng]}
            radius={isJoined ? 14 : 10}
            pathOptions={{
              color: cat.color,
              fillColor: cat.color,
              fillOpacity: isJoined ? 0.9 : 0.6,
              weight: isJoined ? 3 : 1.5,
            }}
          >
            <Popup>
              <div style={{ fontSize: 12, color: "#111", minWidth: 160 }}>
                <div style={{ fontWeight: "bold", marginBottom: 4 }}>
                  {cat.icon} {item.title}
                </div>
                <div style={{ opacity: 0.7, marginBottom: 4 }}>{item.location_name}</div>
                <div style={{ opacity: 0.7, marginBottom: 8 }}>
                  {item.joined_by.length} attending
                </div>
                <button
                  onClick={() => onJoin(item.id)}
                  style={{
                    background: isJoined ? "#e0f2e9" : "#4fa870",
                    color: isJoined ? "#3d8b5e" : "#fff",
                    border: "none",
                    borderRadius: 8,
                    padding: "4px 12px",
                    cursor: "pointer",
                    fontWeight: "bold",
                    fontSize: 11,
                  }}
                >
                  {isJoined ? "✓ Going" : "Join · +10 PA"}
                </button>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
