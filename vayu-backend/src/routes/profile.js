const express = require("express");
const multer = require("multer");
const sharp = require("sharp");
const path = require("path");
const fs = require("fs");
const { requireAuth } = require("../middleware/auth");
const { findById, updateAvatar, safeUser } = require("../services/users");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Images only"));
  },
});

const AVATARS_DIR = path.join(__dirname, "../../uploads/avatars");
if (!fs.existsSync(AVATARS_DIR)) fs.mkdirSync(AVATARS_DIR, { recursive: true });

// GET /api/profile/:user_id
router.get("/:user_id", (req, res) => {
  const user = findById(req.params.user_id);
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json(safeUser(user));
});

// POST /api/profile/avatar (auth required, multipart)
router.post("/avatar", requireAuth, upload.single("avatar"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No image uploaded" });

    const filename = `${req.user.id}.jpg`;
    const outPath = path.join(AVATARS_DIR, filename);

    await sharp(req.file.buffer)
      .resize(200, 200, { fit: "cover", position: "center" })
      .jpeg({ quality: 85 })
      .toFile(outPath);

    const avatar_url = `/uploads/avatars/${filename}`;
    updateAvatar(req.user.id, avatar_url);

    res.json({ avatar_url });
  } catch (e) {
    console.error("[AVATAR]", e);
    res.status(500).json({ error: "Upload failed" });
  }
});

module.exports = router;
