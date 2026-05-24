const express = require("express");
const bcrypt  = require("bcryptjs");
const jwt     = require("jsonwebtoken");
const {
  findByUsername,
  findById,
  safeUser,
  createUser,
  approveUser,
  rejectUser,
  getPending,
  getApproved,
} = require("../services/users");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();
const SECRET = process.env.JWT_SECRET;
if (!SECRET) { console.error("[AUTH] FATAL: JWT_SECRET env var not set. Server will reject all tokens."); }
const EXPIRY = process.env.JWT_EXPIRY  || "7d";

function signToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, name: user.name, role: user.role, ward_id: user.ward_id },
    SECRET,
    { expiresIn: EXPIRY }
  );
}

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ error: "Username and password required" });

    const user = await findByUsername(username);
    if (!user) return res.status(401).json({ error: "Invalid credentials" });
    if (user.status !== "approved")
      return res.status(403).json({ error: "Account pending approval by Ward Executive" });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    return res.json({ token: signToken(user), user: safeUser(user) });
  } catch (err) {
    console.error("[AUTH] login error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// Normalise a Nepal phone number to E.164.
// Accepts:  9742585185 / 9779742585185 / +9779742585185 / 977-9742-585185
// Returns:  +9779742585185  (or null if blank)
function normalisePhone(raw) {
  if (!raw) return null;
  const digits = raw.replace(/[\s\-\(\)]/g, "");
  if (digits.startsWith("+"))  return digits;              // already E.164
  if (digits.startsWith("977")) return "+" + digits;       // country code present
  if (digits.length === 10)     return "+977" + digits;    // bare 10-digit Nepal number
  return "+" + digits;                                     // best-effort
}

// POST /api/auth/register
router.post("/register", async (req, res) => {
  try {
    const { username, name, password, phone, role, ward_id } = req.body;
    if (!username || !name || !password)
      return res.status(400).json({ error: "username, name, password required" });
    if (role === "executive")
      return res.status(400).json({ error: "Cannot self-register as executive" });

    if (await findByUsername(username))
      return res.status(409).json({ error: "Username already taken" });

    const password_hash = await bcrypt.hash(password, 10);
    const user = await createUser({ username, name, password_hash, phone: normalisePhone(phone), role: role || "individual", ward_id: ward_id || "11" });
    return res.status(201).json({
      message: "Registration submitted. Pending approval by Ward Executive.",
      id: user.id,
    });
  } catch (err) {
    console.error("[AUTH] register error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// GET /api/auth/me
router.get("/me", requireAuth, async (req, res) => {
  try {
    const user = await findById(req.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    return res.json(safeUser(user));
  } catch (err) {
    console.error("[AUTH] me error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// GET /api/auth/pending (executive only)
router.get("/pending", requireAuth, requireRole(["executive"]), async (req, res) => {
  try {
    return res.json(await getPending());
  } catch (err) {
    console.error("[AUTH] pending error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// POST /api/auth/approve/:id (executive only)
router.post("/approve/:id", requireAuth, requireRole(["executive"]), async (req, res) => {
  try {
    const ok = await approveUser(req.params.id);
    if (!ok) return res.status(404).json({ error: "User not found" });
    return res.json({ ok: true });
  } catch (err) {
    console.error("[AUTH] approve error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// POST /api/auth/reject/:id (executive only)
router.post("/reject/:id", requireAuth, requireRole(["executive"]), async (req, res) => {
  try {
    const ok = await rejectUser(req.params.id);
    if (!ok) return res.status(404).json({ error: "User not found" });
    return res.json({ ok: true });
  } catch (err) {
    console.error("[AUTH] reject error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// GET /api/auth/members (executive only — all approved)
router.get("/members", requireAuth, requireRole(["executive"]), async (req, res) => {
  try {
    const { ward_id } = req.query;
    return res.json(await getApproved(ward_id));
  } catch (err) {
    console.error("[AUTH] members error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
