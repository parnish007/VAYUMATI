#pragma once
#include <Arduino.h>
#include "config.h"

// ═══════════════════════════════════════════════════════════════════════════
//  ph_calibration.h — pH ADC → pH value conversion and venue calibration mode
//
//  CALIBRATION PROCEDURE (run once at venue before demo):
//    1. Power on Node B while holding the BOOT button (GPIO0).
//    2. Open Serial Monitor at 115200 baud.
//    3. Dip probe in pH 7.0 buffer solution. Wait 30 s for reading to stabilise.
//       Note the printed raw ADC value → set PH_V7 in config.h.
//    4. Rinse probe with distilled water. Dip in pH 4.0 buffer. Wait 30 s.
//       Note raw ADC value → set PH_V4 in config.h.
//    5. Update config.h, recompile, and flash.
//
//  The slope and intercept are computed from PH_V7 and PH_V4 at compile time:
//    pH = PH_SLOPE * raw + PH_INTERCEPT
//
//  IMPORTANT: Recalibrate at venue temperature. pH electrode slope changes
//  approximately 0.003 pH/°C from the 25°C reference. For a 10°C difference
//  from calibration temperature, expect ±0.03 pH error — acceptable for demo.
// ═══════════════════════════════════════════════════════════════════════════

// Take N averaged ADC readings from the pH pin to reduce noise.
inline int readPhRaw(int samples = 16) {
  long sum = 0;
  for (int i = 0; i < samples; i++) {
    sum += analogRead(PIN_PH);
    delay(5);
  }
  return (int)(sum / samples);
}

// Convert raw ADC to pH using two-point linear calibration.
// Returns clamped value in [2.0, 12.0] — outside this range the probe is
// either saturated or not in solution.
inline float rawToPH(int raw) {
  float ph = PH_SLOPE * (float)raw + PH_INTERCEPT;
  return constrain(ph, 2.0f, 12.0f);
}

// pH value validation — returns true if reading is plausible for soil.
inline bool phPlausible(float ph) {
  return (ph >= 3.5f && ph <= 10.0f);
}

// ── Calibration mode ──────────────────────────────────────────────────────────
//  Called from setup() when GPIO0 is held LOW at boot.
//  Prints raw ADC values continuously for manual calibration.
//  Exits only on device reset (never returns).
inline void runCalibrationMode() {
  Serial.println("\n========================================");
  Serial.println("  pH CALIBRATION MODE");
  Serial.println("========================================");
  Serial.println("  Printing raw ADC every 1 second.");
  Serial.println("  STEP 1: Dip probe in pH 7.0 buffer.");
  Serial.println("          Note the stable raw value → PH_V7 in config.h");
  Serial.println("  STEP 2: Rinse. Dip in pH 4.0 buffer.");
  Serial.println("          Note the stable raw value → PH_V4 in config.h");
  Serial.println("  Power cycle to exit calibration mode.");
  Serial.println("========================================\n");

  Serial.printf("  Current config: PH_V7=%d  PH_V4=%d\n", PH_V7, PH_V4);
  Serial.printf("  Slope=%.5f  Intercept=%.3f\n\n", (double)PH_SLOPE, (double)PH_INTERCEPT);

  int  iteration = 0;
  while (true) {
    int   raw = readPhRaw(32); // 32-sample average for stable reading
    float ph  = rawToPH(raw);

    Serial.printf("[CALIB %4d]  raw=%4d  →  pH=%.2f", iteration, raw, ph);

    // Hint which buffer is closest
    if (abs(raw - PH_V7) < abs(raw - PH_V4)) {
      Serial.printf("  (closest to pH7 buffer, Δraw=%d)", abs(raw - PH_V7));
    } else {
      Serial.printf("  (closest to pH4 buffer, Δraw=%d)", abs(raw - PH_V4));
    }
    Serial.println();

    iteration++;
    delay(1000);
  }
}
