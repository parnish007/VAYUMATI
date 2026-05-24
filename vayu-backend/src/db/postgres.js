const { Pool } = require("pg");

const realPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("localhost")
    ? false
    : { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
});

realPool.on("error", (err) => {
  console.error("[PG] Unexpected client error:", err.message);
});

// Errors that mean "connection layer hiccuped, retry will probably succeed".
// Neon free-tier compute suspends after ~5min idle; the first query after
// wake-up frequently fails with ENOTFOUND, ECONNRESET, or 'Connection terminated'.
const TRANSIENT_CODES = new Set([
  "ENOTFOUND", "ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "EAI_AGAIN",
  "57P01", "57P02", "57P03", // postgres admin shutdown / db_dropped / cannot_connect_now
]);
function isTransient(err) {
  if (!err) return false;
  if (TRANSIENT_CODES.has(err.code)) return true;
  const m = (err.message || "").toLowerCase();
  return m.includes("connection terminated") || m.includes("connection ended");
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function queryWithRetry(text, params, attempts = 3) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await realPool.query(text, params);
    } catch (err) {
      lastErr = err;
      if (!isTransient(err) || i === attempts - 1) throw err;
      const delay = 500 * Math.pow(2, i); // 500ms, 1s, 2s
      console.warn(`[PG] transient ${err.code || err.message} — retrying in ${delay}ms (attempt ${i + 2}/${attempts})`);
      await sleep(delay);
    }
  }
  throw lastErr;
}

module.exports = {
  query:   queryWithRetry,
  connect: (...a) => realPool.connect(...a),
  end:     (...a) => realPool.end(...a),
  on:      (...a) => realPool.on(...a),
};
