#pragma once
#include <Adafruit_SSD1306.h>
#include "config.h"
#include "aqi.h"

// ═══════════════════════════════════════════════════════════════════════════
//  display.h — SSD1306 128×64 OLED helper functions for Node A
//
//  The Adafruit_SSD1306 object is declared in the .ino file as:
//    Adafruit_SSD1306 oled(OLED_WIDTH, OLED_HEIGHT, &Wire, -1);
//  All functions here take a reference to it.
// ═══════════════════════════════════════════════════════════════════════════

// Boot screen — shown for 2 seconds while sensors warm up.
inline void showStartup(Adafruit_SSD1306& oled) {
  oled.clearDisplay();

  oled.setTextSize(2);
  oled.setTextColor(SSD1306_WHITE);
  oled.setCursor(4, 10);
  oled.print("VayuMitti");

  oled.setTextSize(1);
  oled.setCursor(4, 34);
  oled.print("Air Node A1");

  oled.setCursor(4, 46);
  oled.print("Ward 11 | ECOTHON");

  oled.setCursor(4, 56);
  oled.print("Warming up...");

  oled.display();
  delay(2000);
}

// Top half: large AQI number + label.
// Bottom half: one line of status text (IP, MQTT status, etc.)
inline void showAQI(Adafruit_SSD1306& oled, int aqi, const char* statusLine) {
  oled.clearDisplay();

  // ── AQI number — top half ────────────────────────────────────────────────
  oled.setTextSize(3);                       // 18px per char
  oled.setTextColor(SSD1306_WHITE);

  // Right-align the AQI number in the top half
  char aqiStr[8];
  snprintf(aqiStr, sizeof(aqiStr), "%d", aqi);
  int charW    = 18;                         // size-3 char width
  int numChars = strlen(aqiStr);
  int x        = OLED_WIDTH - numChars * charW - 4;
  oled.setCursor(x, 2);
  oled.print(aqiStr);

  // AQI label — left side, top half
  oled.setTextSize(1);
  oled.setCursor(2, 2);
  oled.print("AQI");
  oled.setCursor(2, 14);
  oled.print(aqiLabel(aqi));

  // ── Divider ──────────────────────────────────────────────────────────────
  oled.drawFastHLine(0, 36, OLED_WIDTH, SSD1306_WHITE);

  // ── Status line — bottom half ─────────────────────────────────────────────
  oled.setTextSize(1);
  oled.setCursor(2, 40);
  oled.print(statusLine);

  // Alert border blink when AQI ≥ UNHEALTHY
  if (aqiAlertLevel(aqi) >= 1) {
    oled.drawRect(0, 0, OLED_WIDTH, OLED_HEIGHT, SSD1306_WHITE);
  }

  oled.display();
}

// Overwrite just the status line without redrawing the AQI (saves flicker).
inline void showStatus(Adafruit_SSD1306& oled, const char* line) {
  // Erase status area
  oled.fillRect(0, 40, OLED_WIDTH, OLED_HEIGHT - 40, SSD1306_BLACK);
  oled.setTextSize(1);
  oled.setTextColor(SSD1306_WHITE);
  oled.setCursor(2, 40);
  oled.print(line);
  oled.display();
}

// Offline / no-WiFi screen.
inline void showOffline(Adafruit_SSD1306& oled, const char* reason) {
  oled.clearDisplay();
  oled.setTextSize(1);
  oled.setTextColor(SSD1306_WHITE);
  oled.setCursor(2, 2);
  oled.print("NO CONNECTION");
  oled.setCursor(2, 14);
  oled.print(reason);
  oled.setCursor(2, 28);
  oled.print("Retrying...");
  oled.display();
}
