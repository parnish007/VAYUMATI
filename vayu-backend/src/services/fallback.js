const axios = require("axios");

// Open-Meteo Air Quality API — free, no key, covers Nepal
// Note: OpenAQ v2 was deprecated (410 Gone), v3 requires paid API key as of 2024.
// Open-Meteo AQ returns pm10, pm2_5, nitrogen_dioxide, carbon_monoxide.
const OPENMETEO_AQ_BASE = "https://air-quality-api.open-meteo.com/v1";

// Open-Meteo forecast API for soil moisture + temperature
const OPENMETEO_BASE = process.env.OPENMETEO_API_URL || "https://api.open-meteo.com/v1";

// SoilGrids ISRIC REST API — free, no key, 250m resolution, covers Nepal
// phh2o is returned in tenths of pH (pH × 10); divide by 10 to get standard pH.
const SOILGRIDS_BASE = "https://rest.soilgrids.org/soilgrids/v2.0";

// Known pH for Kathmandu Valley loam soils (surface layer 0-5cm).
// Used only if SoilGrids is unreachable — ensures pH is never null.
const KATHMANDU_VALLEY_PH_ESTIMATE = 6.2;

/**
 * Fetch air quality from Open-Meteo Air Quality API (free, no key).
 * Returns data in the same shape as a live air_update SSE payload.
 */
async function fetchOpenAQFallback(lat, lng) {
  const url =
    `${OPENMETEO_AQ_BASE}/air-quality?latitude=${lat}&longitude=${lng}` +
    `&hourly=pm10,pm2_5,nitrogen_dioxide,carbon_monoxide` +
    `&timezone=auto&forecast_days=1`;

  const response = await axios.get(url, { timeout: 8000 });
  const hourly   = response.data?.hourly;

  if (!hourly) {
    console.warn("[FALLBACK] Open-Meteo AQ returned no data for", lat, lng);
    return buildAirFallback({}, "fallback_openaq");
  }

  const pm25 = hourly.pm2_5?.[0]  ?? null;
  const pm10 = hourly.pm10?.[0]   ?? null;
  // nitrogen_dioxide from Open-Meteo is in μg/m³; convert to a rough ppm proxy
  const no2  = hourly.nitrogen_dioxide?.[0] != null
    ? Math.round((hourly.nitrogen_dioxide[0] / 1000) * 10000) / 10000
    : null;
  const aqi  = pm25 != null ? aqiFromPm25(pm25) : null;

  console.log(`[FALLBACK] Open-Meteo AQ: pm25=${pm25} aqi=${aqi} no2=${no2}`);
  return buildAirFallback({ pm25, pm10, no2, aqi }, "fallback_openaq");
}

/**
 * Fetch soil pH from SoilGrids ISRIC REST API (free, no key, 250m resolution).
 * phh2o (pH in H2O) is returned in tenths of pH; divide by 10 for standard scale.
 * Soil moisture and temperature come from Open-Meteo forecast (also free).
 * EC has no free public fallback and is returned as null.
 * pH is guaranteed non-null: falls back to Kathmandu Valley regional estimate
 * (6.2) if SoilGrids is unreachable.
 * Returns data in the same shape as a live soil_update SSE payload.
 */
async function fetchSoilGridsFallback(lat, lng) {
  // Fetch moisture + temperature from Open-Meteo in parallel with pH from SoilGrids
  const [soilMeta, soilPh] = await Promise.allSettled([
    fetchOpenMeteoSoil(lat, lng),
    fetchSoilGridsPh(lat, lng),
  ]);

  const { moisture, soil_temp } = soilMeta.status === "fulfilled"
    ? soilMeta.value
    : { moisture: null, soil_temp: null };

  const ph = soilPh.status === "fulfilled"
    ? soilPh.value
    : KATHMANDU_VALLEY_PH_ESTIMATE;

  if (soilPh.status === "rejected") {
    console.warn(
      `[FALLBACK] SoilGrids unreachable (${soilPh.reason?.message}); ` +
      `using regional pH estimate ${KATHMANDU_VALLEY_PH_ESTIMATE}`
    );
  }

  return buildSoilFallback({ ph, moisture, soil_temp }, "fallback_soilgrids");
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Fetch phh2o from SoilGrids ISRIC REST API.
 * Returns parsed pH value (standard scale), never null on success.
 * Throws on network or parse error.
 */
async function fetchSoilGridsPh(lat, lng) {
  const url =
    `${SOILGRIDS_BASE}/properties/query` +
    `?lon=${lng}&lat=${lat}&property=phh2o&property=ocd&depth=0-5cm&value=mean`;

  const response = await axios.get(url, { timeout: 8000 });
  const layers   = response.data?.properties?.layers;

  if (!layers || layers.length === 0) {
    throw new Error("SoilGrids returned empty layers");
  }

  const phLayer  = layers.find((l) => l.name === "phh2o");
  const depthObj = phLayer?.depths?.find((d) => d.label === "0-5cm");
  const rawPh    = depthObj?.values?.mean;

  if (rawPh == null) {
    throw new Error("SoilGrids phh2o mean value missing");
  }

  // SoilGrids phh2o is pH × 10 (tenths of pH unit)
  const ph = Math.round((rawPh / 10) * 100) / 100;
  console.log(`[FALLBACK] SoilGrids pH raw=${rawPh} → pH=${ph}`);
  return ph;
}

/**
 * Fetch soil moisture and temperature from Open-Meteo forecast.
 */
async function fetchOpenMeteoSoil(lat, lng) {
  const url =
    `${OPENMETEO_BASE}/forecast?latitude=${lat}&longitude=${lng}` +
    `&hourly=soil_moisture_0_to_1cm,soil_temperature_0cm` +
    `&timezone=auto&forecast_days=1`;

  const response = await axios.get(url, { timeout: 8000 });
  const hourly   = response.data?.hourly;

  if (!hourly) return { moisture: null, soil_temp: null };

  const rawMoisture = hourly.soil_moisture_0_to_1cm?.[0];
  // m³/m³ → percentage (× 100), one decimal place
  const moisture = rawMoisture != null
    ? Math.round(rawMoisture * 100 * 10) / 10
    : null;
  const soil_temp = hourly.soil_temperature_0cm?.[0] ?? null;

  return { moisture, soil_temp };
}

// ─── Payload builders ─────────────────────────────────────────────────────────

function buildAirFallback(data, source) {
  return {
    aqi:      data.aqi  ?? null,
    pm25:     data.pm25 ?? null,
    pm10:     data.pm10 ?? null,
    co2:      data.co2  ?? null,
    no2:      data.no2  ?? null,
    temp:     data.temperature ?? null,
    humidity: data.humidity    ?? null,
    source,
    ts: Math.floor(Date.now() / 1000),
  };
}

function buildSoilFallback(data, source) {
  return {
    moisture:      data.moisture  ?? null,
    ph:            data.ph        ?? KATHMANDU_VALLEY_PH_ESTIMATE,
    ec:            null,            // No free EC fallback API exists
    soil_temp:     data.soil_temp ?? null,
    ml_class:      null,
    ml_confidence: null,
    source,
    ts: Math.floor(Date.now() / 1000),
  };
}

// ─── AQI formula ─────────────────────────────────────────────────────────────

// EPA NowCast piecewise linear — mirrors CLAUDE.md canonical implementation
function aqiFromPm25(C) {
  const bp = [
    [0.0,   12.0,    0,  50],
    [12.1,  35.4,   51, 100],
    [35.5,  55.4,  101, 150],
    [55.5,  150.4, 151, 200],
    [150.5, 250.4, 201, 300],
    [250.5, 500.4, 301, 500],
  ];
  for (const [Clo, Chi, Ilo, Ihi] of bp) {
    if (C >= Clo && C <= Chi) {
      return Math.round(((Ihi - Ilo) / (Chi - Clo)) * (C - Clo) + Ilo);
    }
  }
  return 500;
}

module.exports = { fetchOpenAQFallback, fetchSoilGridsFallback };
