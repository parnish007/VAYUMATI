/**
 * 10 pre-generated advisory templates.
 * Each has a `conditions` object (used for Euclidean distance matching)
 * and a full advisory payload matching the MATI output schema.
 *
 * Distance is computed in normalised (aqi/500, ph/14, moisture/100, ec/5) space.
 * If ec is null/"unavailable" in the context, ec is excluded from distance.
 */

const TEMPLATES = [
  {
    id: "t01_hazardous_air",
    conditions: { aqi: 260, ph: 6.5, moisture: 55, ec: 1.5 },
    advisory: {
      headline_en: "Hazardous air quality — stay indoors",
      headline_ne: "खतरनाक वायु — घरभित्र बस्नुहोस्",
      body_en:
        "AQI has reached hazardous levels. All outdoor activity should be suspended. " +
        "Keep windows closed. Children, elderly, and those with respiratory conditions " +
        "are at severe risk.",
      body_ne:
        "वायु गुणस्तर सूचकांक अत्यन्त खतरनाक स्तरमा पुगेको छ। सबै बाहिरी गतिविधि " +
        "रोक्नुहोस्। झ्याल–ढोका बन्द राख्नुहोस्। बालबालिका, वृद्ध र श्वास–प्रश्वास " +
        "समस्या भएका व्यक्तिहरू गम्भीर जोखिममा छन्।",
      audience: "individual",
      severity: 4,
      confidence: 0.92,
      actions: [
        "Stay indoors with windows closed",
        "Wear N95 mask if outdoor movement is essential",
        "Contact ward health post if breathing difficulty develops",
      ],
      source_note: "Cached advisory — live sensor data unavailable at generation time.",
    },
  },
  {
    id: "t02_unhealthy_all",
    conditions: { aqi: 175, ph: 6.2, moisture: 50, ec: 1.4 },
    advisory: {
      headline_en: "Unhealthy air quality for all groups",
      headline_ne: "सबैका लागि अस्वस्थ वायु गुणस्तर",
      body_en:
        "AQI is in the Unhealthy range. Avoid prolonged outdoor exertion. " +
        "Wear a mask when outside. Sensitive groups should remain indoors.",
      body_ne:
        "वायु गुणस्तर सूचकांक अस्वस्थ स्तरमा छ। लामो समयसम्म बाहिर ब्यायाम नगर्नुहोस्। " +
        "बाहिर जाँदा मास्क लगाउनुहोस्। संवेदनशील समूहले घरभित्रै बस्नु राम्रो।",
      audience: "individual",
      severity: 3,
      confidence: 0.88,
      actions: [
        "Wear an N95 or surgical mask outdoors",
        "Reduce outdoor activity duration",
        "Keep children and elderly indoors",
      ],
      source_note: "Cached advisory — live sensor data unavailable at generation time.",
    },
  },
  {
    id: "t03_sensitive_groups",
    conditions: { aqi: 125, ph: 6.5, moisture: 55, ec: 1.5 },
    advisory: {
      headline_en: "Air quality unhealthy for sensitive groups",
      headline_ne: "संवेदनशील समूहका लागि अस्वस्थ वायु",
      body_en:
        "AQI is in the Unhealthy for Sensitive Groups range. Children, elderly, " +
        "and those with asthma or heart conditions should limit outdoor time.",
      body_ne:
        "वायु गुणस्तर सूचकांक संवेदनशील समूहका लागि अस्वस्थ छ। बालबालिका, वृद्ध " +
        "र दमा वा मुटु रोग भएकाहरूले बाहिरी समय घटाउनु पर्छ।",
      audience: "individual",
      severity: 2,
      confidence: 0.85,
      actions: [
        "Sensitive groups should stay indoors",
        "Postpone outdoor exercise to morning hours",
        "Monitor AQI updates hourly",
      ],
      source_note: "Cached advisory — live sensor data unavailable at generation time.",
    },
  },
  {
    id: "t04_acid_deposition",
    conditions: { aqi: 185, ph: 4.9, moisture: 62, ec: 1.8 },
    advisory: {
      headline_en: "Acid deposition detected — air and soil alert",
      headline_ne: "एसिड वर्षा संकेत — वायु र माटो सतर्कता",
      body_en:
        "NO2 spike with simultaneous pH drop detected — acid deposition pattern. " +
        "Crops and water sources in the ward are at risk. Avoid outdoor activity.",
      body_ne:
        "NO2 वृद्धि र माटोको pH एकैसाथ घटेको छ — एसिड वर्षाको संकेत। " +
        "वडाका बाली र पानीका स्रोत खतरामा छन्। बाहिर जानुबाट बच्नुहोस्।",
      audience: "farmer",
      severity: 4,
      confidence: 0.91,
      actions: [
        "Cover crops to prevent acid rain damage",
        "Do not irrigate with open rainwater today",
        "Apply lime to soil if pH is confirmed below 5.5",
        "Report to ward agriculture office",
      ],
      source_note: "Cached advisory — live sensor data unavailable at generation time.",
    },
  },
  {
    id: "t05_low_ph",
    conditions: { aqi: 80, ph: 4.8, moisture: 65, ec: 2.1 },
    advisory: {
      headline_en: "Soil pH critically low — farmer alert",
      headline_ne: "माटोको pH अत्यन्त न्यून — कृषक सतर्कता",
      body_en:
        "Soil pH has dropped to an acidic level that will harm most crops. " +
        "Stop fertiliser application immediately. Liming is advised.",
      body_ne:
        "माटोको pH अम्लीय स्तरमा पुगेको छ जसले अधिकांश बालीलाई हानि गर्नेछ। " +
        "तुरुन्त मलखाद प्रयोग रोक्नुहोस्। चुनको प्रयोग सुझाइन्छ।",
      audience: "farmer",
      severity: 3,
      confidence: 0.87,
      actions: [
        "Stop all fertiliser application immediately",
        "Apply agricultural lime to raise pH",
        "Do not plant new seedlings until pH is above 5.5",
        "Consult ward agriculture extension office",
      ],
      source_note: "Cached advisory — live sensor data unavailable at generation time.",
    },
  },
  {
    id: "t06_high_ph_dry",
    conditions: { aqi: 90, ph: 8.3, moisture: 22, ec: 0.9 },
    advisory: {
      headline_en: "Alkaline dry soil — irrigation adjustment needed",
      headline_ne: "क्षारीय सुक्खा माटो — सिंचाई समायोजन आवश्यक",
      body_en:
        "Soil pH is elevated and moisture is critically low. Alkaline conditions " +
        "will lock out micronutrients. Irrigate and apply acidifying amendment.",
      body_ne:
        "माटोको pH उच्च छ र आर्द्रता अत्यन्त कम छ। क्षारीय अवस्थाले " +
        "सूक्ष्म पोषक तत्वहरू अवरुद्ध गर्नेछ। सिंचाई गर्नुहोस् र अम्लीकरण गर्ने सामग्री प्रयोग गर्नुहोस्।",
      audience: "farmer",
      severity: 2,
      confidence: 0.82,
      actions: [
        "Irrigate the field immediately",
        "Apply sulphur-based acidifying amendment",
        "Check irrigation water EC before applying",
        "Monitor pH over next 48 hours",
      ],
      source_note: "Cached advisory — live sensor data unavailable at generation time.",
    },
  },
  {
    id: "t07_moderate_air",
    conditions: { aqi: 75, ph: 6.5, moisture: 55, ec: 1.5 },
    advisory: {
      headline_en: "Moderate air quality — general precautions advised",
      headline_ne: "मध्यम वायु गुणस्तर — सामान्य सावधानी",
      body_en:
        "AQI is moderate. Most people can continue normal activities, " +
        "but sensitive groups should reduce prolonged outdoor exertion.",
      body_ne:
        "वायु गुणस्तर सूचकांक मध्यम छ। अधिकांश मानिसले सामान्य गतिविधि जारी राख्न सक्छन् " +
        "तर संवेदनशील समूहले लामो बाहिरी क्रियाकलाप घटाउनु पर्छ।",
      audience: "individual",
      severity: 2,
      confidence: 0.80,
      actions: [
        "Sensitive groups reduce prolonged outdoor time",
        "Carry a mask if going to busy roads",
        "Check AQI again in 2 hours",
      ],
      source_note: "Cached advisory — live sensor data unavailable at generation time.",
    },
  },
  {
    id: "t08_good_conditions",
    conditions: { aqi: 45, ph: 6.8, moisture: 60, ec: 1.3 },
    advisory: {
      headline_en: "Good air quality and healthy soil conditions",
      headline_ne: "राम्रो वायु गुणस्तर र स्वस्थ माटो",
      body_en:
        "Air quality is Good and soil conditions are within normal range. " +
        "Good time for outdoor activity and field work.",
      body_ne:
        "वायु गुणस्तर राम्रो छ र माटोको अवस्था सामान्य दायरामा छ। " +
        "बाहिरी गतिविधि र खेत काम गर्नका लागि राम्रो समय।",
      audience: "individual",
      severity: 1,
      confidence: 0.95,
      actions: [
        "Normal outdoor activity is safe",
        "Good conditions for planting or harvesting",
        "Continue monitoring daily AQI",
      ],
      source_note: "Cached advisory — live sensor data unavailable at generation time.",
    },
  },
  {
    id: "t09_waterlogged",
    conditions: { aqi: 98, ph: 5.9, moisture: 92, ec: 2.4 },
    advisory: {
      headline_en: "Waterlogged soil — drainage action required",
      headline_ne: "जलभराव माटो — निकास कार्य आवश्यक",
      body_en:
        "Soil moisture is critically high, indicating waterlogging. Root rot and " +
        "crop loss are likely without immediate drainage.",
      body_ne:
        "माटोमा आर्द्रता अत्यन्त उच्च छ जसले जलभराव संकेत गर्छ। तुरुन्त निकास " +
        "नगरिए जराको सड्ने र बाली नोक्सानी हुन सक्छ।",
      audience: "farmer",
      severity: 3,
      confidence: 0.86,
      actions: [
        "Open field drainage channels immediately",
        "Do not irrigate until moisture drops below 70%",
        "Check crop roots for early rot signs",
        "Report to ward agriculture office if more than 2 fields affected",
      ],
      source_note: "Cached advisory — live sensor data unavailable at generation time.",
    },
  },
  {
    id: "t10_critical_soil_class",
    conditions: { aqi: 140, ph: 5.2, moisture: 56, ec: 1.9 },
    advisory: {
      headline_en: "Critical soil classification — combined air and soil alert",
      headline_ne: "गम्भीर माटो वर्गीकरण — वायु र माटो दुवै सतर्कता",
      body_en:
        "TinyML soil model flagged critical soil class. Combined with elevated AQI, " +
        "conditions indicate multi-factor environmental stress. Immediate assessment needed.",
      body_ne:
        "TinyML माटो मोडेलले गम्भीर माटो वर्ग संकेत गरेको छ। उच्च AQI सँगै " +
        "बहुकारक वातावरणीय तनाव देखिएको छ। तत्काल मूल्यांकन आवश्यक।",
      audience: "govt",
      severity: 3,
      confidence: 0.84,
      actions: [
        "Dispatch ward-level field assessment team",
        "Issue precautionary agricultural advisory",
        "Collect soil samples for laboratory pH and EC analysis",
        "Trigger MATI advisory for affected field",
      ],
      source_note: "Cached advisory — live sensor data unavailable at generation time.",
    },
  },
];

// ─── Distance matching ────────────────────────────────────────────────────────

/**
 * Find the closest template using Euclidean distance in normalised feature space.
 * Dimensions: aqi (÷500), ph (÷14), moisture (÷100), ec (÷5 when available).
 * If a context dimension is null or "unavailable", it is excluded from the calculation.
 *
 * @param {{ aqi?: number, ph?: number, moisture?: number, ec?: number|string }} ctx
 * @returns {object} The matching template's advisory payload
 */
function getClosestTemplate(ctx) {
  const normCtx = normalise(ctx);
  let bestDist  = Infinity;
  let bestIndex = 0;

  for (let i = 0; i < TEMPLATES.length; i++) {
    const normTpl = normalise(TEMPLATES[i].conditions);
    const dist    = euclidean(normCtx, normTpl);
    if (dist < bestDist) {
      bestDist  = dist;
      bestIndex = i;
    }
  }

  const tpl = TEMPLATES[bestIndex];
  return {
    ...tpl.advisory,
    _template_id:   tpl.id,
    _template_dist: Math.round(bestDist * 1000) / 1000,
  };
}

function normalise({ aqi, ph, moisture, ec }) {
  return {
    aqi:      aqi      != null                           ? aqi / 500  : null,
    ph:       ph       != null                           ? ph / 14    : null,
    moisture: moisture != null                           ? moisture / 100 : null,
    ec:       (ec != null && ec !== "unavailable")       ? ec / 5     : null,
  };
}

function euclidean(a, b) {
  const keys = ["aqi", "ph", "moisture", "ec"];
  let sumSq = 0;
  let dims  = 0;
  for (const k of keys) {
    if (a[k] != null && b[k] != null) {
      sumSq += Math.pow(a[k] - b[k], 2);
      dims++;
    }
  }
  if (dims === 0) return Infinity;
  return Math.sqrt(sumSq / dims); // normalise by dimension count
}

module.exports = { getClosestTemplate, TEMPLATES };
