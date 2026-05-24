const MAX_STORE = 100;
const store = [];

function push(advisory) {
  if (!advisory || typeof advisory !== "object") return;
  // Ensure required fields exist so the frontend never renders undefined
  const safe = {
    ward_id:     advisory.ward_id    || "11",
    field_id:    advisory.field_id   || null,
    ts:          advisory.ts         || Math.floor(Date.now() / 1000),
    severity:    typeof advisory.severity === "number" ? advisory.severity : 1,
    headline_en: advisory.headline_en || "Advisory",
    headline_ne: advisory.headline_ne || "सूचना",
    body_en:     typeof advisory.body_en === "string" ? advisory.body_en.slice(0, 2000) : "",
    body_ne:     typeof advisory.body_ne === "string" ? advisory.body_ne.slice(0, 1800) : "",
    confidence:  advisory.confidence  ?? 0.5,
    source:      advisory.source      || "mati",
  };
  store.push(safe);
  if (store.length > MAX_STORE) store.splice(0, store.length - MAX_STORE);
}

function getLatest(ward_id, field_id) {
  return store
    .filter(
      (a) =>
        (!ward_id  || a.ward_id  === ward_id) &&
        (!field_id || a.field_id === field_id)
    )
    .sort((a, b) => b.ts - a.ts)[0] || null;
}

function getHistory(ward_id, limit = 20) {
  return store
    .filter((a) => !ward_id || a.ward_id === ward_id)
    .sort((a, b) => b.ts - a.ts)
    .slice(0, parseInt(limit));
}

module.exports = { push, getLatest, getHistory };
