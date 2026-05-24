#pragma once

// ═══════════════════════════════════════════════════════════════════════════
//  soil_model.h — TinyML classifier placeholder
//
//  REPLACE WITH m2cgen OUTPUT BEFORE DEMO.
//
//  To generate the real model:
//    1. Collect soil readings labelled 0 (good), 1 (borderline), 2 (critical).
//    2. Train a DecisionTreeClassifier (max_depth <= 8) in scikit-learn.
//    3. Run: m2cgen model --language C --indent 4 > soil_model.h
//    4. Add #pragma once and this header comment block.
//    5. Set USE_ML_MODEL true in config.h.
//    6. Set MOISTURE_MIN/MAX, PH_MIN/MAX, EC_MIN/MAX, TEMP_MIN/MAX in config.h
//       from training data min/max values.
//
//  Input order for predict(): [moisture_norm, ph_norm, ec_norm, temp_norm]
//  All inputs are normalised to [0, 1] using the defines in config.h.
//
//  Placeholder always returns class 0 (good).  The main sketch ignores
//  predict() when USE_ML_MODEL is false — it uses classify() thresholds instead.
// ═══════════════════════════════════════════════════════════════════════════

double score(double* input) {
  (void)input;
  return 1.0; // placeholder — REPLACE WITH m2cgen OUTPUT BEFORE DEMO
}

int predict(double* input) {
  (void)input;
  return 0;   // placeholder — REPLACE WITH m2cgen OUTPUT BEFORE DEMO
}
