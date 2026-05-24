/**
 * MATI chat — Claude primary, Gemini free-tier fallback.
 *
 * Claude is tried first on every request. If it fails for any reason
 * (credits exhausted, 429, 401, etc.) Gemini is used for that turn.
 * Conversation history is kept for Claude sessions; Gemini gets the
 * full history concatenated as a single prompt (stateless fallback).
 *
 * Session store: in-memory Map  sessionId → { messages[], lastActive }
 * TTL: 30 min idle · History cap: 20 messages
 */

const Anthropic = require("@anthropic-ai/sdk");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { nodeRegistry } = require("../services/healthCheck");

const CLAUDE_MODEL  = process.env.CLAUDE_MODEL  || "claude-sonnet-4-6";
const GEMINI_MODEL  = process.env.GEMINI_MODEL   || "gemini-2.5-flash";
const HISTORY_CAP   = 20;
const SESSION_TTL   = 30 * 60 * 1000; // 30 min

// ─── Session store ────────────────────────────────────────────────────────────

const sessions = new Map();

function getSession(id) {
  const s = sessions.get(id);
  if (s) { s.lastActive = Date.now(); return s; }
  const fresh = { messages: [], lastActive: Date.now() };
  sessions.set(id, fresh);
  return fresh;
}

setInterval(() => {
  const cutoff = Date.now() - SESSION_TTL;
  for (const [id, s] of sessions.entries()) {
    if (s.lastActive < cutoff) sessions.delete(id);
  }
}, 5 * 60 * 1000);

// ─── Live context ─────────────────────────────────────────────────────────────

function getLiveContext(ward_id) {
  const nodes = [...nodeRegistry.values()].filter((n) => n.ward_id === ward_id);
  const airSnap = nodes.filter((n) => n.type === "air").map((n) => {
    const r = n.latestReading || {};
    return `Node ${n.id}: AQI=${r.aqi ?? "?"} PM2.5=${r.pm25 ?? "?"} NO2=${r.no2 ?? "?"} status=${n.status}`;
  }).join("; ") || "No live air sensor data";

  const soilSnap = nodes.filter((n) => n.type === "soil").map((n) => {
    const r = n.latestReading || {};
    return `Node ${n.id}: pH=${r.ph ?? "?"} moisture=${r.moisture ?? "?"}% status=${n.status}`;
  }).join("; ") || "No live soil sensor data";

  return { airSnap, soilSnap };
}

// ─── System prompt ────────────────────────────────────────────────────────────

function buildSystem({ ward_id, role, airSnap, soilSnap }) {
  return `You are MATI — VayuMitti's environmental AI assistant for Kathmandu Valley Ward ${ward_id || 11}.
Help ward members understand air quality, soil health, and what protective actions to take.

CURRENT LIVE CONDITIONS:
Air: ${airSnap}
Soil: ${soilSnap}
User role: ${role || "individual"}

RULES:
- Respond in Nepali if user writes in Nepali; English otherwise.
- Under 200 words. Short and actionable.
- Reference actual sensor readings when relevant; say "no data" when unavailable.
- Never fabricate readings.
- Farmers: give crop-specific advice (potato pH 4.8–5.5, maize 5.8–7.0, rice 5.5–6.5).
- You remember this conversation — refer back to what was discussed.
- AQI guide: 0–50 Good · 51–100 Moderate · 101–150 Sensitive groups · 151–200 Unhealthy · 201+ Avoid outdoors`;
}

// ─── Claude primary ───────────────────────────────────────────────────────────

async function tryClaudeStream({ system, messages, onChunk }) {
  const client = new Anthropic();
  const stream = client.messages.stream({
    model:      CLAUDE_MODEL,
    max_tokens: 512,
    system,
    messages,
  });

  let full = "";
  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
      full += event.delta.text;
      onChunk(event.delta.text);
    }
  }
  return full;
}

// ─── Gemini fallback ──────────────────────────────────────────────────────────

async function tryGeminiStream({ system, messages, onChunk }) {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey || apiKey.length < 10) {
    throw new Error("GOOGLE_AI_API_KEY not configured");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction: system,
  });

  // Flatten history into one prompt — Gemini SDK handles turns differently
  const historyText = messages
    .slice(0, -1)
    .map((m) => `${m.role === "user" ? "User" : "MATI"}: ${m.content}`)
    .join("\n");
  const lastMsg = messages[messages.length - 1]?.content ?? "";
  const fullPrompt = historyText ? `${historyText}\nUser: ${lastMsg}` : lastMsg;

  const result = await model.generateContentStream(fullPrompt);
  let full = "";
  for await (const chunk of result.stream) {
    const text = chunk.text();
    if (text) { full += text; onChunk(text); }
  }
  return full;
}

// ─── Main export ──────────────────────────────────────────────────────────────

async function streamChatResponse({ message, sessionId, ward_id, role, onChunk, onDone }) {
  const session = getSession(sessionId || "default");
  const { airSnap, soilSnap } = getLiveContext(ward_id || "11");
  const system = buildSystem({ ward_id, role, airSnap, soilSnap });

  session.messages.push({ role: "user", content: message });
  if (session.messages.length > HISTORY_CAP) {
    session.messages = session.messages.slice(-HISTORY_CAP);
  }

  let fullText = "";
  let usedModel = "claude";

  try {
    fullText = await tryClaudeStream({ system, messages: session.messages, onChunk });
    console.log(`[CHAT] claude responded (${fullText.length} chars)`);
  } catch (claudeErr) {
    console.warn(`[CHAT] Claude failed (${claudeErr.message}) — falling back to Gemini`);
    usedModel = "gemini";
    try {
      fullText = await tryGeminiStream({ system, messages: session.messages, onChunk });
      console.log(`[CHAT] gemini fallback responded (${fullText.length} chars)`);
    } catch (geminiErr) {
      console.error("[CHAT] both models failed:", geminiErr.message);
      const errMsg = "MATI is temporarily unavailable. Both Claude and Gemini failed to respond. Please check API keys in .env.";
      onChunk(errMsg);
      onDone(errMsg);
      return;
    }
  }

  if (fullText) {
    session.messages.push({ role: "assistant", content: fullText });
  }

  onDone(fullText, usedModel);
}

module.exports = { streamChatResponse };
