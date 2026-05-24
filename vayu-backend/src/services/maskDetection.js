"use strict";

/**
 * Face-mask detection via a local Python CNN model.
 *
 * Place your downloaded model at:
 *   vayu-backend/data/models/mask_model.pkl   (or .h5 / .onnx)
 *
 * The Python script handles all three formats automatically.
 * Required Python deps (install once): pip install Pillow numpy
 *   + joblib  (for .pkl)
 *   + tensorflow  (for .h5)
 *   + onnxruntime  (for .onnx)
 */

const { spawn } = require("child_process");
const path      = require("path");
const fs        = require("fs");
const os        = require("os");

const SCRIPT_PATH = path.join(__dirname, "../../scripts/mask_predict.py");
const MODELS_DIR  = path.join(__dirname, "../../data/models");

// Model lookup: try common extensions in order
function findModel() {
  const names = ["mask_model.pkl", "mask_model.h5", "mask_model.keras", "mask_model.onnx"];
  for (const name of names) {
    const p = path.join(MODELS_DIR, name);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

// Try python, then python3, then py (Windows Launcher)
function findPython() {
  return process.platform === "win32" ? "python" : "python3";
}

async function detectMask(imageBuffer) {
  const modelPath = findModel();
  if (!modelPath) {
    console.warn("[MASK] No model file found in data/models/ — selfie approved by default");
    return { mask_detected: true, confidence: 0.5, model: "no_model_fallback" };
  }

  const tmpPath = path.join(os.tmpdir(), `mask_${Date.now()}.jpg`);
  fs.writeFileSync(tmpPath, imageBuffer);

  return new Promise((resolve) => {
    const py  = findPython();
    const proc = spawn(py, [SCRIPT_PATH, tmpPath, modelPath], { timeout: 45000 });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (d) => { stdout += d.toString(); });
    proc.stderr.on("data", (d) => { stderr += d.toString(); });

    proc.on("close", (code) => {
      try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }

      if (stderr) console.warn("[MASK PY]", stderr.slice(0, 300));

      try {
        const result = JSON.parse(stdout.trim());
        resolve(result);
      } catch {
        console.error("[MASK] Failed to parse Python output:", stdout.slice(0, 200));
        resolve({ mask_detected: false, confidence: 0, error: "Python parse failed" });
      }
    });

    proc.on("error", (err) => {
      try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
      console.error("[MASK] Spawn error:", err.message);
      resolve({ mask_detected: false, confidence: 0, error: err.message });
    });
  });
}

module.exports = { detectMask };
