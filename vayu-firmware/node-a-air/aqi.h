#pragma once

// ═══════════════════════════════════════════════════════════════════════════
//  aqi.h — EPA NowCast piecewise AQI from PM2.5
//  Identical formula to the canonical lib/aqi.ts on the frontend and backend.
//  DO NOT change breakpoints — they must match everywhere.
// ═══════════════════════════════════════════════════════════════════════════

// EPA NowCast breakpoint table: {Clo, Chi, Ilo, Ihi}
struct AQIBreakpoint {
  float  Clo, Chi;
  int    Ilo, Ihi;
};

static const AQIBreakpoint AQI_BREAKPOINTS[] = {
  {  0.0f,  12.0f,   0,  50 },
  { 12.1f,  35.4f,  51, 100 },
  { 35.5f,  55.4f, 101, 150 },
  { 55.5f, 150.4f, 151, 200 },
  {150.5f, 250.4f, 201, 300 },
  {250.5f, 500.4f, 301, 500 },
};

// Returns AQI (0–500) from PM2.5 concentration in μg/m³.
// Returns 500 for concentrations above the highest breakpoint.
inline int aqiFromPm25(float C) {
  for (const auto& bp : AQI_BREAKPOINTS) {
    if (C >= bp.Clo && C <= bp.Chi) {
      return (int)((float)(bp.Ihi - bp.Ilo) / (bp.Chi - bp.Clo) * (C - bp.Clo) + bp.Ilo + 0.5f);
    }
  }
  return 500;
}

// Returns a short status string for OLED display — matches aqiLabel() in frontend.
inline const char* aqiLabel(int aqi) {
  if (aqi <= 50)  return "Good";
  if (aqi <= 100) return "Moderate";
  if (aqi <= 150) return "Sensitive";
  if (aqi <= 200) return "Unhealthy";
  if (aqi <= 300) return "Very Unhealthy";
  return "Hazardous";
}

// Returns 0 (normal) or 1 (warn) or 2 (alert) — drives OLED border blink.
inline int aqiAlertLevel(int aqi) {
  if (aqi < AQI_UNHEALTHY)  return 0;
  if (aqi < AQI_HAZARDOUS)  return 1;
  return 2;
}
