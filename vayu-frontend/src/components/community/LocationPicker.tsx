"use client";

import { useState, useCallback } from "react";
import { MapContainer, TileLayer, CircleMarker, useMapEvents } from "react-leaflet";

interface Props {
  onPick: (lat: number, lng: number, name: string) => void;
}

function ClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click: (e) => {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function LocationPicker({ onPick }: Props) {
  const [pin, setPin] = useState<[number, number] | null>(null);
  const [geocoding, setGeocoding] = useState(false);

  const handleClick = useCallback(
    async (lat: number, lng: number) => {
      setPin([lat, lng]);
      setGeocoding(true);
      try {
        const r = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
          { headers: { "Accept-Language": "en", "User-Agent": "VayuMitti/1.0" } }
        );
        const data = (await r.json()) as { display_name?: string };
        const name =
          data.display_name?.split(",").slice(0, 3).join(", ") ??
          `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        onPick(lat, lng, name);
      } catch {
        onPick(lat, lng, `${lat.toFixed(4)}, ${lng.toFixed(4)}`);
      } finally {
        setGeocoding(false);
      }
    },
    [onPick]
  );

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[11px]" style={{ color: "#8aad96" }}>
        {geocoding ? "Getting address…" : "Tap anywhere on the map to set location"}
      </p>
      <MapContainer
        center={[27.691, 85.38]}
        zoom={14}
        scrollWheelZoom={false}
        style={{ height: 280, borderRadius: 12, background: "#0a1a0f" }}
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
        <ClickHandler onPick={handleClick} />
        {pin && (
          <CircleMarker
            center={pin}
            radius={8}
            pathOptions={{
              color: "#4fa870",
              fillColor: "#4fa870",
              fillOpacity: 0.9,
              weight: 2,
            }}
          />
        )}
      </MapContainer>
    </div>
  );
}
