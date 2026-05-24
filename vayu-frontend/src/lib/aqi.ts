const BREAKPOINTS: [number, number, number, number][] = [
  [0.0,   12.0,   0,   50],
  [12.1,  35.4,  51,  100],
  [35.5,  55.4, 101,  150],
  [55.5, 150.4, 151,  200],
  [150.5, 250.4, 201, 300],
  [250.5, 500.4, 301, 500],
];

export function aqiFromPm25(C: number): number {
  for (const [Clo, Chi, Ilo, Ihi] of BREAKPOINTS) {
    if (C >= Clo && C <= Chi) {
      return Math.round(((Ihi - Ilo) / (Chi - Clo)) * (C - Clo) + Ilo);
    }
  }
  return 500;
}

export function aqiColor(aqi: number): string {
  if (aqi <= 50)  return "#3d8b5e";
  if (aqi <= 100) return "#d4a017";
  if (aqi <= 150) return "#e8600a";
  if (aqi <= 200) return "#c44b2b";
  if (aqi <= 300) return "#7b2d8b";
  return "#7b0000";
}

export function aqiLabel(aqi: number): string {
  if (aqi <= 50)  return "Good";
  if (aqi <= 100) return "Moderate";
  if (aqi <= 150) return "Unhealthy for Sensitive Groups";
  if (aqi <= 200) return "Unhealthy for All";
  if (aqi <= 300) return "Very Unhealthy";
  return "Hazardous";
}

export function aqiLabelShort(aqi: number): string {
  if (aqi <= 50)  return "Good";
  if (aqi <= 100) return "Moderate";
  if (aqi <= 150) return "Sensitive Groups";
  if (aqi <= 200) return "Unhealthy";
  if (aqi <= 300) return "Very Unhealthy";
  return "Hazardous";
}

export function cigaretteEquiv(dailyDoseUg: number): number {
  return Math.round((dailyDoseUg / 120) * 10) / 10;
}

export function timeAgo(ts: number): string {
  const diffSec = Math.floor(Date.now() / 1000) - ts;
  if (diffSec < 60)  return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  return `${Math.floor(diffSec / 3600)}h ago`;
}
