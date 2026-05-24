"use strict";

const { GoogleGenerativeAI } = require("@google/generative-ai");
const { tools, dispatchTool }           = require("./tools");
const { SYSTEM_PROMPT, buildTriggerMessage } = require("./prompts");
const { getClosestTemplate }            = require("./templates");
const { getAvailableKeys, markRateLimited, isRateLimitError } = require("../services/geminiKeyPool");

const TIMEOUT_MS = 12000;
const MAX_TURNS  = 6;

const googleFunctionDeclarations = tools.map(({ name, description, input_schema }) => ({
  name,
  description,
  parameters: input_schema,
}));

const INJECTION_RE =
  /(ignore previous|system prompt|developer mode|reveal.*prompt|jailbreak|override.*instruction|forget.*rules|hidden instruction|bypass safety)/i;

const CANNED_REFUSAL = {
  headline_en:  "Advisory unavailable",
  headline_ne:  "सल्लाह उपलब्ध छैन",
  body_en:      "The trigger message contained disallowed content and was blocked.",
  body_ne:      "ट्रिगर सन्देशमा अस्वीकार्य सामग्री भेटियो र रोकियो।",
  audience:     "individual",
  severity:     1,
  confidence:   0,
  actions:      [],
  source_note:  "Request blocked by injection guard.",
  tool_call_log: [],
};

// Run the full agentic loop with a specific API key.
// Throws on rate-limit so the caller can rotate to the next key.
// Returns the raw text response on success.
async function tryWithKey(key, triggerMessage, toolCallLog) {
  const genAI = new GoogleGenerativeAI(key);
  const model = genAI.getGenerativeModel({
    model:             "gemini-2.0-flash",
    systemInstruction: SYSTEM_PROMPT,
    tools:             [{ functionDeclarations: googleFunctionDeclarations }],
  });

  const chat = model.startChat();

  const withTimeout = (promise) =>
    Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("LLM_TIMEOUT")), TIMEOUT_MS)
      ),
    ]);

  let result = await withTimeout(chat.sendMessage(triggerMessage));

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const calls = result.response.functionCalls();
    if (!calls || calls.length === 0) break;

    const functionResponses = [];
    for (const call of calls) {
      console.log(`[MATI] tool: ${call.name}`, call.args);
      let toolResult;
      try {
        toolResult = await dispatchTool(call.name, call.args);
      } catch (e) {
        toolResult = { error: e.message };
      }
      toolCallLog.push({ tool: call.name, input: call.args, output: toolResult });
      functionResponses.push({
        functionResponse: { name: call.name, response: { result: JSON.stringify(toolResult) } },
      });
    }

    result = await withTimeout(chat.sendMessage(functionResponses));
  }

  return result.response.text().trim();
}

async function runMatiAgent(triggerContext) {
  const textToCheck = [triggerContext.reason, triggerContext.ward_id, triggerContext.field_id]
    .filter(Boolean)
    .join(" ");

  if (INJECTION_RE.test(textToCheck)) {
    console.warn("[MATI] injection attempt blocked:", textToCheck);
    return CANNED_REFUSAL;
  }

  const triggerMessage = buildTriggerMessage(triggerContext);
  const toolCallLog    = [];
  const keys           = getAvailableKeys();

  if (keys.length === 0) {
    console.warn("[MATI] all API keys on cooldown — serving template fallback");
    return templateFallback(triggerContext, toolCallLog, "all_keys_rate_limited");
  }

  for (const key of keys) {
    try {
      const text     = await tryWithKey(key, triggerMessage, toolCallLog);
      const advisory = extractAdvisory(text);

      if (!advisory) {
        console.warn("[MATI] parse failed — serving template fallback");
        return templateFallback(triggerContext, toolCallLog, "parse_error");
      }

      advisory.tool_call_log = toolCallLog;
      advisory.ward_id       = triggerContext.ward_id;
      advisory.field_id      = triggerContext.field_id || null;
      advisory.ts            = Math.floor(Date.now() / 1000);
      advisory.source        = "mati_agent";

      console.log(`[MATI] advisory OK: severity=${advisory.severity} confidence=${advisory.confidence}`);
      return advisory;

    } catch (err) {
      if (isRateLimitError(err)) {
        markRateLimited(key);
        console.warn(`[MATI] key rate-limited, trying next (${keys.indexOf(key) + 1}/${keys.length})`);
        continue;
      }

      const reason = err.message === "LLM_TIMEOUT" ? "timeout" : err.message;
      console.warn("[MATI] non-rate-limit failure —", reason, "— serving template fallback");
      return templateFallback(triggerContext, toolCallLog, reason);
    }
  }

  // Exhausted all available keys
  console.warn("[MATI] all available keys exhausted — serving template fallback");
  return templateFallback(triggerContext, toolCallLog, "all_keys_exhausted");
}

function extractAdvisory(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch { /* fall through */ }
    }
    return {
      headline_en:  "Advisory generated",
      headline_ne:  "सल्लाह उत्पन्न भयो",
      body_en:      text.slice(0, 400),
      body_ne:      text.slice(0, 900),
      audience:     "individual",
      severity:     1,
      confidence:   0.4,
      actions:      [],
      source_note:  "Structured parse failed — raw model output returned.",
    };
  }
}

function templateFallback(ctx, toolCallLog, reason) {
  // Sensor-triggered anomalies should always fire WhatsApp (severity >= 3),
  // even when the template matcher picks a low-severity template because the
  // current AQI doesn't reflect the spike yet (e.g. NO2 fired before AQI caught up).
  const triggeredBySensor =
    typeof ctx.reason === "string" &&
    (ctx.reason.includes("high_aqi") ||
      ctx.reason.includes("high_no2") ||
      ctx.reason.includes("high_pm25") ||
      ctx.reason.includes("low_ph") ||
      ctx.reason.includes("sensor"));

  // For sensor anomalies, pick a template that reflects the actual spike
  // rather than relying on the (possibly stale) ctx.aqi snapshot.
  let lookupCtx = ctx;
  if (triggeredBySensor) {
    const r = ctx.reason || "";
    if (r.includes("high_no2") || r.includes("acid_deposition")) {
      // NO2 spike → acid deposition pattern template (severity 4)
      lookupCtx = { aqi: 185, ph: 4.9, moisture: 62, ec: 1.8 };
    } else if (r.includes("high_aqi") || r.includes("high_pm25")) {
      // AQI spike — pick by the actual numeric AQI
      const aqi = Number(ctx.aqi) || 200;
      lookupCtx = aqi >= 250
        ? { aqi: 260, ph: ctx.ph ?? 6.5, moisture: ctx.moisture ?? 55, ec: ctx.ec ?? 1.5 }   // hazardous
        : { aqi: 175, ph: ctx.ph ?? 6.2, moisture: ctx.moisture ?? 50, ec: ctx.ec ?? 1.4 };  // unhealthy
    }
  }

  const tpl = getClosestTemplate(lookupCtx);
  const severity = triggeredBySensor ? Math.max(tpl.severity || 1, 3) : (tpl.severity || 1);

  return {
    ...tpl,
    severity,
    ward_id:         ctx.ward_id,
    field_id:        ctx.field_id || null,
    ts:              Math.floor(Date.now() / 1000),
    source:          "template_fallback",
    fallback_reason: reason,
    tool_call_log:   toolCallLog,
  };
}

module.exports = { runMatiAgent };
