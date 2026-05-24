const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { getAll, getById, create, join } = require("../services/initiatives");
const { findById } = require("../services/users");
const { broadcastToClients } = require("./sse");

const router = express.Router();

// GET /api/initiatives?ward_id=11
router.get("/", (req, res) => {
  try {
    const list = getAll(req.query.ward_id);
    // Sort upcoming first
    list.sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: "Failed to load initiatives" });
  }
});

// GET /api/initiatives/:id
router.get("/:id", (req, res) => {
  const item = getById(req.params.id);
  if (!item) return res.status(404).json({ error: "Not found" });
  res.json(item);
});

// POST /api/initiatives (auth required)
router.post("/", requireAuth, (req, res) => {
  try {
    const { lat, lng, title, scheduled_at } = req.body;
    if (!title || !lat || !lng || !scheduled_at) {
      return res.status(400).json({ error: "title, lat, lng, scheduled_at required" });
    }
    const user = findById(req.user.id) || req.user;
    const item = create(req.body, user);
    try { broadcastToClients("initiative_created", { id: item.id, title: item.title, ward_id: item.ward_id }); } catch {}
    res.status(201).json({ ...item, pa_awarded: 30 });
  } catch (e) {
    console.error("[INIT]", e);
    res.status(500).json({ error: "Failed to create initiative" });
  }
});

// POST /api/initiatives/:id/join (auth required)
router.post("/:id/join", requireAuth, (req, res) => {
  try {
    const user = findById(req.user.id) || req.user;
    const result = join(req.params.id, user);
    if (!result) return res.status(404).json({ error: "Initiative not found" });
    if (result.alreadyJoined) return res.json({ message: "Already joined", pa_awarded: 0, initiative: result.initiative });
    try { broadcastToClients("initiative_joined", { id: req.params.id, user_id: user.id }); } catch {}
    res.json({ message: "Joined!", pa_awarded: 10, initiative: result.initiative });
  } catch (e) {
    console.error("[INIT JOIN]", e);
    res.status(500).json({ error: "Failed to join" });
  }
});

module.exports = router;
