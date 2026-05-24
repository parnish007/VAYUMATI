"""
Face mask detection inference script.
Called by Node.js: python mask_predict.py <image_path> <model_path>

Supports:
  .pkl  — sklearn / joblib / keras-via-pickle model
  .h5   — Keras / TensorFlow SavedModel
  .onnx — ONNX model (lightweight, no TF needed)

Output (stdout): JSON  {"mask_detected": true, "confidence": 0.95, "model": "..."}
"""

import sys
import json
import os
import numpy as np

IMAGE_PATH = sys.argv[1] if len(sys.argv) > 1 else None
MODEL_PATH = sys.argv[2] if len(sys.argv) > 2 else None

IMG_SIZE   = (224, 224)

def load_image(path):
    try:
        from PIL import Image
        img = Image.open(path).convert("RGB").resize(IMG_SIZE)
        arr = np.array(img, dtype=np.float32) / 255.0
        return arr
    except ImportError:
        pass
    try:
        import cv2
        img = cv2.imread(path)
        img = cv2.resize(img, IMG_SIZE)
        img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        return img.astype(np.float32) / 255.0
    except ImportError:
        raise RuntimeError("Install Pillow or opencv-python: pip install Pillow")


def predict_pkl(model_path, img_arr):
    import pickle, joblib
    try:
        model = joblib.load(model_path)
    except Exception:
        with open(model_path, "rb") as f:
            model = pickle.load(f)

    # Try as Keras model first
    try:
        x = np.expand_dims(img_arr, axis=0)
        pred = model.predict(x, verbose=0)[0]
        # Binary: index 0 = no_mask, index 1 = mask  (or single value)
        if hasattr(pred, "__len__") and len(pred) >= 2:
            confidence = float(pred[1])
        else:
            confidence = float(pred[0])
        return confidence
    except Exception:
        pass

    # Try as sklearn classifier (needs flat input)
    flat = img_arr.flatten().reshape(1, -1)
    proba = model.predict_proba(flat)[0]
    # Assume class order: 0=no_mask, 1=mask
    return float(proba[1]) if len(proba) > 1 else float(proba[0])


def _patch_keras2_compat():
    """Patch Keras 3 initializers to accept the 'dtype' kwarg that Keras 2 serialised into configs."""
    try:
        import keras.src.initializers as _m
        for _attr in dir(_m):
            _cls = getattr(_m, _attr)
            if not (isinstance(_cls, type) and issubclass(_cls, _m.Initializer)):
                continue
            _orig = _cls.__init__
            def _compat(self, *a, dtype=None, _orig=_orig, **kw):
                try:
                    _orig(self, *a, **kw)
                except TypeError:
                    _orig(self)
            _cls.__init__ = _compat
    except Exception:
        pass


def predict_h5(model_path, img_arr):
    import tensorflow as tf
    _patch_keras2_compat()
    model = tf.keras.models.load_model(model_path, compile=False)
    x = np.expand_dims(img_arr, axis=0)
    pred = model.predict(x, verbose=0)[0]
    if hasattr(pred, "__len__") and len(pred) >= 2:
        # Class order (alphabetical from LabelBinarizer): 0=with_mask, 1=without_mask
        return float(pred[0])
    return float(pred[0])


def predict_onnx(model_path, img_arr):
    import onnxruntime as rt
    sess = rt.InferenceSession(model_path, providers=["CPUExecutionProvider"])
    input_name = sess.get_inputs()[0].name
    x = np.expand_dims(img_arr, axis=0)  # (1, 224, 224, 3)
    # Some ONNX models expect (1, 3, 224, 224)
    try:
        out = sess.run(None, {input_name: x})
    except Exception:
        x = np.transpose(x, (0, 3, 1, 2))
        out = sess.run(None, {input_name: x})
    pred = out[0][0]
    if hasattr(pred, "__len__") and len(pred) >= 2:
        # Apply softmax if raw logits
        e = np.exp(pred - np.max(pred))
        prob = e / e.sum()
        return float(prob[1])
    return float(pred)


def main():
    if not IMAGE_PATH or not MODEL_PATH:
        print(json.dumps({"mask_detected": False, "confidence": 0,
                          "error": "Usage: python mask_predict.py <image> <model>"}))
        return

    if not os.path.exists(IMAGE_PATH):
        print(json.dumps({"mask_detected": False, "confidence": 0,
                          "error": f"Image not found: {IMAGE_PATH}"}))
        return

    if not os.path.exists(MODEL_PATH):
        print(json.dumps({"mask_detected": False, "confidence": 0,
                          "error": f"Model not found: {MODEL_PATH}"}))
        return

    try:
        img = load_image(IMAGE_PATH)
        ext = os.path.splitext(MODEL_PATH)[1].lower()

        if ext in (".pkl", ".joblib"):
            confidence = predict_pkl(MODEL_PATH, img)
        elif ext in (".h5", ".keras", ".model", ""):
            confidence = predict_h5(MODEL_PATH, img)
        elif ext == ".onnx":
            confidence = predict_onnx(MODEL_PATH, img)
        else:
            # Try pkl as default
            confidence = predict_pkl(MODEL_PATH, img)

        print(json.dumps({
            "mask_detected": confidence >= 0.65,
            "confidence":    round(confidence, 3),
            "model":         os.path.basename(MODEL_PATH),
        }))

    except Exception as e:
        print(json.dumps({"mask_detected": False, "confidence": 0, "error": str(e)}))


main()
