const express = require("express");
const multer  = require("multer");
const path    = require("path");
const fs      = require("fs");
const { detectMask } = require("../services/maskDetection");
const { addAction }  = require("../services/paScores");
const { broadcastToClients } = require("./sse");

const router = express.Router();

// In-memory selfie store (resets on restart — acceptable for demo)
const selfies = [];

// In-memory soil diary store
const diaryEntries = [];

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Images only"));
  },
});

const SELFIES_DIR = path.join(__dirname, "../../uploads/selfies");
if (!fs.existsSync(SELFIES_DIR)) fs.mkdirSync(SELFIES_DIR, { recursive: true });

// GET /api/community/selfies
router.get("/selfies", (req, res) => {
  const ward_id = req.query.ward_id || "11";
  res.json(selfies.filter((s) => s.ward_id === ward_id));
});

// POST /api/community/selfie — upload mask selfie, auto-validated by CNN
router.post("/selfie", upload.single("selfie"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No image uploaded" });

    // Run CNN mask detection
    const detection = await detectMask(req.file.buffer);

    if (!detection.mask_detected) {
      return res.status(422).json({
        error: detection.error
          ? "Mask detection service unavailable — try again shortly."
          : "No mask detected. Please wear a mask clearly visible in the photo and try again.",
        confidence: detection.confidence,
        mask_detected: false,
      });
    }

    // Save image
    const id       = "s_" + Date.now().toString(36);
    const filename = `${id}.jpg`;
    const outPath  = path.join(SELFIES_DIR, filename);

    try {
      const sharp = require("sharp");
      await sharp(req.file.buffer).resize(300, 300, { fit: "cover" }).jpeg({ quality: 80 }).toFile(outPath);
    } catch {
      fs.writeFileSync(outPath, req.file.buffer);
    }

    const selfie = {
      selfie_id:     id,
      user_id:       req.body.user_id  || "anonymous",
      name:          req.body.name     || "Ward Member",
      ward_id:       req.body.ward_id  || "11",
      ts:            Math.floor(Date.now() / 1000),
      image_url:     `/uploads/selfies/${filename}`,
      mask_detected: true,
      confidence:    detection.confidence,
      approved:      true,
    };

    selfies.push(selfie);

    // Credit mask_worn PA action for the uploading user.
    const userId = selfie.user_id;
    const userRole = req.body.role || "individual";
    if (userId && userId !== "anonymous") {
      try {
        const result = addAction(userId, "mask_worn", userRole);
        broadcastToClients("score_update", { user_id: userId, ...result });
        if (result.newBadges?.length > 0) {
          result.newBadges.forEach((badge) => {
            broadcastToClients("badge_unlocked", { user_id: userId, badge });
          });
        }
      } catch (scoreErr) {
        console.warn("[SELFIE] PA score update failed:", scoreErr.message);
      }
    }

    res.json(selfie);
  } catch (e) {
    console.error("[SELFIE]", e);
    res.status(500).json({ error: "Upload failed" });
  }
});

// ─── Mero Bari — Soil Health Diary ──────────────────────────────────────────

const DIARY_TYPES = ["watered", "fertilized", "soil_checked", "harvest", "problem", "other"];

// GET /api/community/diary
router.get("/diary", (req, res) => {
  const ward_id = req.query.ward_id || "11";
  const limit = Math.min(parseInt(req.query.limit || "50", 10), 100);
  res.json(diaryEntries.filter((e) => e.ward_id === ward_id).slice(0, limit));
});

// POST /api/community/diary
router.post("/diary", (req, res) => {
  try {
    const { entry_type, note, ward_id, user_id, user_name, role } = req.body;

    if (!entry_type || !DIARY_TYPES.includes(entry_type)) {
      return res.status(400).json({ error: "Invalid entry_type. Use: " + DIARY_TYPES.join(", ") });
    }

    const entry = {
      id:         "d_" + Date.now().toString(36),
      user_id:    user_id    || "anonymous",
      user_name:  user_name  || "Ward Member",
      entry_type,
      note:       (note || "").slice(0, 200),
      ward_id:    ward_id    || "11",
      ts:         Math.floor(Date.now() / 1000),
    };

    diaryEntries.unshift(entry); // newest first, bounded at 500
    if (diaryEntries.length > 500) diaryEntries.length = 500;

    // PA scoring: non-fertilizer = responsible practice = soil_compliance
    const scoredUserId = entry.user_id;
    if (scoredUserId && scoredUserId !== "anonymous" && entry_type !== "fertilized") {
      try {
        const userRole = role || "farmer";
        const result = addAction(scoredUserId, "soil_compliance", userRole);
        broadcastToClients("score_update", { user_id: scoredUserId, ...result });
        if (result.newBadges?.length > 0) {
          result.newBadges.forEach((badge) => {
            broadcastToClients("badge_unlocked", { user_id: scoredUserId, badge });
          });
        }
      } catch (scoreErr) {
        console.warn("[DIARY] PA score update failed:", scoreErr.message);
      }
    }

    broadcastToClients("diary_entry", { ward_id: entry.ward_id, entry });
    res.json(entry);
  } catch (e) {
    console.error("[DIARY]", e);
    res.status(500).json({ error: "Failed to save diary entry" });
  }
});

// GET /api/community/leaderboard
router.get("/leaderboard", (req, res) => {
  res.json([
    { rank: 1, ward_id: "8",  name: "Ward 8 — Kirtipur",   score: 94, aqi: 52,  pa_actions: 340 },
    { rank: 2, ward_id: "11", name: "Ward 11 — Thimi",     score: 87, aqi: 91,  pa_actions: 284 },
    { rank: 3, ward_id: "15", name: "Ward 15 — Bhaktapur", score: 81, aqi: 112, pa_actions: 219 },
    { rank: 4, ward_id: "3",  name: "Ward 3 — Madhyapur",  score: 74, aqi: 138, pa_actions: 187 },
    { rank: 5, ward_id: "22", name: "Ward 22 — Sankhu",    score: 68, aqi: 151, pa_actions: 143 },
  ]);
});

module.exports = router;
