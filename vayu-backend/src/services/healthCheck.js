const { broadcastToClients } = require("../routes/sse");

const nodeRegistry = new Map();

const STATUS = { LIVE: "live", FALLBACK: "fallback", OFFLINE: "offline" };

function registerNode(nodeId, type, wardId, fieldId) {
  if (!nodeRegistry.has(nodeId)) {
    nodeRegistry.set(nodeId, {
      id:            nodeId,
      type,
      ward_id:       wardId,
      field_id:      fieldId || null,
      status:        STATUS.LIVE,
      lastSeen:      Date.now(),
      fallbackSource: null,
      battery:       null,
      rssi:          null,
    });
    console.log(`[HEALTH] registered node ${nodeId} type=${type} ward=${wardId}`);
  }
}

function updateNodeSeen(nodeId, extras = {}) {
  const node = nodeRegistry.get(nodeId);
  if (node) {
    node.lastSeen      = Date.now();
    node.status        = STATUS.LIVE;
    node.fallbackSource = null;
    if (extras.battery !== undefined) node.battery = extras.battery;
    if (extras.rssi    !== undefined) node.rssi    = extras.rssi;
  }
}

function startHealthCheckLoop() {
  const interval   = parseInt(process.env.HEALTH_CHECK_INTERVAL) || 30000;
  const timeout    = parseInt(process.env.NODE_TIMEOUT_MS) || 90000;

  console.log(`[HEALTH] loop started — interval=${interval}ms timeout=${timeout}ms`);

  setInterval(() => {
    const now = Date.now();
    for (const [id, node] of nodeRegistry.entries()) {
      const elapsed = now - node.lastSeen;
      const prevStatus = node.status;

      if (elapsed > timeout * 3) {
        // 270s — offline
        if (prevStatus !== STATUS.OFFLINE) {
          node.status = STATUS.OFFLINE;
          console.log(`[HEALTH] node ${id} → OFFLINE (${Math.round(elapsed / 1000)}s silent)`);
          broadcastToClients("node_offline", { node_id: id, ward_id: node.ward_id });
        }
      } else if (elapsed > timeout) {
        // 90s — fallback
        if (prevStatus !== STATUS.FALLBACK) {
          node.status         = STATUS.FALLBACK;
          node.fallbackSource = node.type === "air" ? "openaq" : "soilgrids";
          console.log(`[HEALTH] node ${id} → FALLBACK via ${node.fallbackSource}`);
          activateFallback(node);
          broadcastToClients("node_fallback", {
            node_id:        id,
            ward_id:        node.ward_id,
            fallbackSource: node.fallbackSource,
          });
        }
      } else if (prevStatus !== STATUS.LIVE) {
        // Came back online
        node.status         = STATUS.LIVE;
        node.fallbackSource = null;
        console.log(`[HEALTH] node ${id} → LIVE`);
        broadcastToClients("node_online", { node_id: id, ward_id: node.ward_id });
      }
    }
  }, interval);
}

async function activateFallback(node) {
  try {
    const { fetchOpenAQFallback, fetchSoilGridsFallback } = require("./fallback");
    const lat = parseFloat(process.env.DEFAULT_LAT) || 27.717;
    const lng = parseFloat(process.env.DEFAULT_LNG) || 85.324;

    if (node.type === "air") {
      const data = await fetchOpenAQFallback(lat, lng);
      broadcastToClients("air_update", { ...data, node_id: node.id, ward_id: node.ward_id });
    } else {
      const data = await fetchSoilGridsFallback(lat, lng);
      broadcastToClients("soil_update", { ...data, node_id: node.id, ward_id: node.ward_id, field_id: node.field_id });
    }
  } catch (e) {
    console.error(`[HEALTH] fallback fetch failed for ${node.id}:`, e.message);
  }
}

module.exports = { nodeRegistry, registerNode, updateNodeSeen, startHealthCheckLoop, STATUS };
