"use client";

import { aqiColor, aqiLabel } from "@/lib/aqi";

interface AQIGaugeProps {
  aqi: number;
  size?: number; // SVG width/height in px
}

export function AQIGauge({ aqi, size = 200 }: AQIGaugeProps) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.38;
  const strokeWidth = size * 0.08;

  // Arc spans 270° (from 135° to 405° = 135° + 270°)
  const startDeg = 135;
  const totalDeg = 270;
  const clampedAqi = Math.min(Math.max(aqi, 0), 500);
  const pct = clampedAqi / 500;
  const fillDeg = totalDeg * pct;

  function polarToXY(deg: number, radius: number) {
    const rad = ((deg - 90) * Math.PI) / 180;
    return {
      x: cx + radius * Math.cos(rad),
      y: cy + radius * Math.sin(rad),
    };
  }

  function describeArc(startDeg: number, endDeg: number, radius: number) {
    const start = polarToXY(startDeg, radius);
    const end = polarToXY(endDeg, radius);
    const largeArc = endDeg - startDeg > 180 ? 1 : 0;
    return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y}`;
  }

  const trackPath = describeArc(startDeg, startDeg + totalDeg, r);
  const fillEnd = startDeg + fillDeg;
  const fillPath =
    fillDeg > 0 ? describeArc(startDeg, fillEnd, r) : "";

  const color = aqiColor(aqi);
  const label = aqiLabel(aqi);
  const fontSize = size * 0.14;
  const labelSize = size * 0.07;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-label={`AQI ${aqi} — ${label}`}
    >
      {/* Track */}
      <path
        d={trackPath}
        fill="none"
        stroke="#1a2f20"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      {/* Fill */}
      {fillPath && (
        <path
          d={fillPath}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
      )}
      {/* AQI value */}
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={fontSize}
        fontWeight="700"
        fill={color}
        fontFamily="var(--font-display, serif)"
      >
        {aqi}
      </text>
      {/* Label */}
      <text
        x={cx}
        y={cy + fontSize * 0.9}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={labelSize}
        fill="#c8d9cc"
        fontFamily="var(--font-body, sans-serif)"
      >
        {label}
      </text>
    </svg>
  );
}
