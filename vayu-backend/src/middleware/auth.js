const jwt = require("jsonwebtoken");

const ROLE_HIERARCHY = { individual: 1, farmer: 2, executive: 3 };

function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing auth token" });
  }
  const token = header.slice(7);
  try {
    if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET env var not set");
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

function requireRole(roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Not authenticated" });
    const userLevel = ROLE_HIERARCHY[req.user.role] ?? 0;
    const minLevel = Math.min(...roles.map((r) => ROLE_HIERARCHY[r] ?? 99));
    if (userLevel >= minLevel) return next();
    return res.status(403).json({ error: "Insufficient role" });
  };
}

module.exports = { requireAuth, requireRole };
