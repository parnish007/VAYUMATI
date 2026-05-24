const { GoogleGenerativeAI } = require("@google/generative-ai");
const { getAvailableKeys, markRateLimited, isRateLimitError } = require("../services/geminiKeyPool");

const CROP_KNOWLEDGE = `
CROP KNOWLEDGE FOR KATHMANDU VALLEY FARMERS:
- Potato (आलु): optimal pH 4.8–5.5. Below pH 5.2: do NOT fertilize (nutrient lockout + scab risk). Temp 15–20°C.
- Maize (मकै): optimal pH 5.8–7.0. Sensitive to waterlogging. Temp 20–30°C.
- Rice (धान): optimal pH 5.5–6.5. Flooded paddy tolerates 5.0–6.0. Temp 20–35°C.
- Wheat (गहुँ): optimal pH 6.0–7.0. Needs drainage. Temp 10–25°C.
- Tomato: optimal pH 6.0–6.8. Calcium deficiency below 5.8. Temp 15–30°C.
- Mustard (रायो): optimal pH 5.8–6.8.
- Lentil (मसुरो): optimal pH 6.0–7.0. Nitrogen fixation fails below 6.0.
- Cabbage (बन्दा): optimal pH 6.0–7.5.
- Cauliflower: optimal pH 6.0–7.0.
- Onion (प्याज): optimal pH 6.0–7.0.
- Garlic (लसुन): optimal pH 6.0–7.5.
- Ginger (अदुवा): optional pH 5.5–6.5.
- Turmeric (बेसार): optimal pH 5.5–7.0.
- Spinach (पालुंगो): optimal pH 6.0–7.5.
- Cucumber: optimal pH 5.5–6.8.
`;

const AQI_KNOWLEDGE = `
AQI HEALTH THRESHOLDS (EPA Standard):
- 0–50 (Good): Safe for all. Normal outdoor activity fine.
- 51–100 (Moderate): Acceptable. Unusually sensitive people limit prolonged outdoor exertion.
- 101–150 (Unhealthy for Sensitive Groups): Children, elderly, heart/lung disease patients reduce outdoor time.
- 151–200 (Unhealthy for All): Everyone reduce prolonged outdoor exertion. N95 mask strongly recommended.
- 201–300 (Very Unhealthy): Avoid all outdoor activity. Stay indoors, close windows.
- 301–500 (Hazardous): Emergency. Do not go outside under any circumstances.
`;

function buildSystemPrompt({ aqi, aqiLabel, ph, role, wardId }) {
  return `You are MATI, VayuMitti's environmental AI assistant for Kathmandu Valley Ward ${wardId || 11}.
You help ward members understand air quality, soil health, and take protective actions.

CURRENT CONDITIONS:
- Air Quality Index (AQI): ${aqi || "unknown"} — ${aqiLabel || "checking"}
- Soil pH: ${ph || "unknown"}
- User role: ${role || "individual"}

${AQI_KNOWLEDGE}

${role === "farmer" ? CROP_KNOWLEDGE : ""}

RESPONSE RULES:
- If user writes in Nepali, respond in Nepali. If English, respond in English. Mix is fine.
- If user is a farmer, give practical farming advice in simple language.
- Keep responses under 200 words — concise and actionable.
- Always reference current AQI and pH when relevant.
- Never fabricate sensor readings. If you don't know, say so.
- For health advice, always recommend consulting a doctor for specific medical situations.
- Be warm and helpful. You are a community assistant, not a chatbot.`;
}

async function streamChatResponse({ message, context, onChunk, onDone }) {
  const keys = getAvailableKeys();

  if (keys.length === 0) {
    onChunk("MATI is at capacity right now. All API keys are on cooldown. Please try again in about a minute.");
    onDone();
    return;
  }

  for (const key of keys) {
    try {
      const genAI = new GoogleGenerativeAI(key);
      const model = genAI.getGenerativeModel({
        model:             "gemini-2.0-flash",
        systemInstruction: buildSystemPrompt(context),
      });

      const result = await model.generateContentStream(message);
      for await (const chunk of result.stream) {
        const text = chunk.text();
        if (text) onChunk(text);
      }
      onDone();
      return; // success — stop trying keys

    } catch (err) {
      if (isRateLimitError(err)) {
        markRateLimited(key);
        console.warn(`[GEMINI-CHAT] key rate-limited, trying next (${keys.indexOf(key) + 1}/${keys.length})`);
        continue;
      }

      // Non-rate-limit error — don't retry
      console.error("[GEMINI-CHAT]", err.message);
      const msg = err.message?.includes("API_KEY_INVALID")
        ? "Invalid API key. Please check GOOGLE_AI_API_KEY_1 in .env"
        : `MATI is temporarily unavailable. (${err.message ?? "unknown error"})`;
      onChunk(msg);
      onDone();
      return;
    }
  }

  // All keys were rate-limited
  onChunk("MATI is at capacity right now. Please try again in about a minute.");
  onDone();
}

module.exports = { streamChatResponse };
