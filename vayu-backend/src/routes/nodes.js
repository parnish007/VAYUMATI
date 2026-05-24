const express = require("express");
const router = express.Router();
const { nodeRegistry } = require("../services/healthCheck");

function serializeNode(n) {
  return {
    node_id:        n.id,
    type:           n.type,
    ward_id:        n.ward_id,
    field_id:       n.field_id  || null,
    status:         n.status,
    last_seen:      Math.floor(n.lastSeen / 1000),
    battery:        n.battery   ?? null,
    rssi:           n.rssi      ?? null,
    fallback_source: n.fallbackSource || null,
  };
}

// GET /api/nodes/status
router.get("/status", async (req, res) => {
  res.json(Array.from(nodeRegistry.values()).map(serializeNode));
});

// GET /api/nodes/:node_id
router.get("/:node_id", async (req, res) => {
  const node = nodeRegistry.get(req.params.node_id);
  if (!node) return res.status(404).json({ error: "node not found" });
  res.json(serializeNode(node));
});

// POST /api/nodes/:node_id/ping — lightweight heartbeat for external probes
router.post("/:node_id/ping", async (req, res) => {
  const node = nodeRegistry.get(req.params.node_id);
  if (node) node.lastSeen = Date.now();
  res.json({ ok: true });
});

module.exports = router;
