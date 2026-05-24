"use strict";

// Load up to 3 keys. GOOGLE_AI_API_KEY is kept as legacy alias for key 1.
const KEYS = [
  process.env.GOOGLE_AI_API_KEY_1 || process.env.GOOGLE_AI_API_KEY,
  process.env.GOOGLE_AI_API_KEY_2,
  process.env.GOOGLE_AI_API_KEY_3,
].filter(Boolean);

if (KEYS.length === 0) {
  console.warn("[GEMINI-POOL] No API keys configured. Set GOOGLE_AI_API_KEY_1 (and optionally _2, _3) in .env");
}

const COOLDOWN_MS = 65 * 1000; // 65s — just over the standard 60s Gemini quota window

// key → timestamp when cooldown expires
const cooldowns = new Map();

function isRateLimitError(err) {
  const msg = (err?.message || "").toLowerCase();
  const status = err?.status ?? err?.code ?? 0;
  return (
    status === 429 ||
    msg.includes("resource_exhausted") ||
    msg.includes("quota exceeded") ||
    msg.includes("rate limit") ||
    msg.includes("too many requests") ||
    msg.includes("429")
  );
}

// Returns keys that are not currently on cooldown, in priority order.
function getAvailableKeys() {
  const now = Date.now();
  return KEYS.filter((key) => now >= (cooldowns.get(key) || 0));
}

function markRateLimited(key) {
  cooldowns.set(key, Date.now() + COOLDOWN_MS);
  const masked = `...${key.slice(-6)}`;
  const allStatus = KEYS.map((k) => {
    const remaining = Math.max(0, Math.round(((cooldowns.get(k) || 0) - Date.now()) / 1000));
    return `${k.slice(-6)}: ${remaining > 0 ? `cooldown ${remaining}s` : "ready"}`;
  }).join(", ");
  console.warn(`[GEMINI-POOL] Key ${masked} rate-limited for ${COOLDOWN_MS / 1000}s | pool: [${allStatus}]`);
}

function poolStatus() {
  const now = Date.now();
  return KEYS.map((k, i) => {
    const remaining = Math.max(0, Math.round(((cooldowns.get(k) || 0) - now) / 1000));
    return { slot: i + 1, ready: remaining === 0, cooldown_remaining_s: remaining };
  });
}

module.exports = { KEYS, getAvailableKeys, markRateLimited, isRateLimitError, poolStatus };
