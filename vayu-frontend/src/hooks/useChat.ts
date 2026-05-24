import { useState, useCallback } from "react";
import { getBackendUrl } from "@/lib/constants";

export interface ChatMessage {
  id: string;
  role: "user" | "mati";
  text: string;
  streaming?: boolean;
}

// ── Demo responses (no backend needed) ─────────────────────────────────────

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const DEMO_EN: Record<string, string[]> = {
  greeting: [
    "Namaste! I'm MATI, your Ward 11 environmental assistant. Current AQI is **167 — Unhealthy for All**, and soil pH is **6.24**. How can I help you today?",
    "Hello! I'm MATI. Right now Ward 11 has AQI **167** and soil pH **6.24** — both in the caution zone. Ask me anything about air quality, soil health, or protective actions.",
  ],
  thanks: [
    "You're welcome! Stay safe out there — mask on until AQI drops below 100.",
    "Happy to help. Remember, the Ward 11 sensors update every 5 seconds — check back anytime for fresh readings.",
  ],
  mask: [
    "At AQI **167** (Unhealthy for All), wearing an N95 mask is essential for any outdoor activity in Ward 11. PM2.5 is at 68.4 μg/m³ — 5.7× the WHO 24-hour limit. Even a 10-minute walk without protection adds significantly to today's dose. Stay masked until AQI drops below 100.",
    "Yes — **N95 mask required** today. AQI 167 means every unprotected breath draws 68.4 μg/m³ of PM2.5 into your lungs. A surgical mask blocks ~50% of particles; an N95 blocks ~95%. The difference is meaningful at this exposure level. Wear it for any time outdoors beyond 5 minutes.",
    "**Mask up.** With PM2.5 at 68.4 μg/m³ and NO₂ at 0.09 ppm, today's air is in the Unhealthy for All bracket. This means healthy adults are affected, not just sensitive groups. N95 or better — surgical masks are insufficient at this concentration.",
  ],
  aqi: [
    "Ward 11 AQI is **167 — Unhealthy for All**. PM2.5 at 68.4 μg/m³, NO₂ at 0.09 ppm. Northeast wind from the kiln corridor near Sallaghari is the dominant source. Key actions: wear N95 outdoors, limit exposure windows to under 30 minutes, close windows on the windward side.",
    "Current AQI: **167**. That puts Ward 11 in the Unhealthy for All category. The dominant pollutant is PM2.5 (68.4 μg/m³) from the brick kiln corridor 2.3 km northeast. NO₂ at 0.09 ppm suggests active combustion. Expect AQI to peak around 9–11 AM as traffic overlaps with kiln emissions.",
    "AQI **167** right now in Ward 11. To put that in context: WHO's safe daily limit is 15 μg/m³ PM2.5 — we're at 68.4, which is 4.5× over. Over a full day, that equals roughly **6.7 cigarette-equivalents** of exposure. Peak risk window is 7–11 AM.",
  ],
  safe: [
    "At AQI **167**, it is not safe to spend extended time outdoors without protection. Limit outdoor time to under 30 minutes with an N95 mask. The safest window today is before 7 AM or after 6 PM when traffic and kiln overlap subsides.",
    "Ward 11 is in the **Unhealthy for All** category — not safe for prolonged outdoor exposure for anyone, including healthy adults. Short trips (under 15 min) are tolerable with an N95. Avoid the 8–11 AM window when PM2.5 peaks.",
  ],
  soil: [
    "Soil pH is currently **6.24** — below the optimal range for most crops. This matches the active acid deposition pattern: NO₂ has spiked to 0.09 ppm from the kiln corridor to the northeast. Delay any fertilizer application by 48 hours and monitor pH daily until it stabilises above 6.5.",
    "Soil health today: **pH 6.24**, EC 1.41 mS/cm, moisture 58.2%, soil temp 21.3°C. The pH is the concern — wheat and maize need 6.0–7.0, but at 6.24 nutrient availability is reduced, especially phosphorus and molybdenum. The current acid deposition pattern (NO₂ spike + pH drop) is the likely cause. Wait 48 hours before any soil amendment.",
    "Ward 11 field data: **pH 6.24** (acidic — was 7.1 three days ago), moisture 58%, EC 1.41. The 0.9 pH drop in 72 hours matches acid rain from the kiln corridor. At this pH, nitrogen from urea converts partly to N₂O gas — a greenhouse gas 273× more potent than CO₂ — rather than feeding crops.",
  ],
  fertilizer: [
    "**Do not fertilize today.** At pH 6.24, nitrogen and phosphorus uptake is severely impaired. Urea applied now will mostly be wasted — and converts to N₂O in acidic soil, a greenhouse gas 273× more potent than CO₂. Wait 48 hours, recheck pH, and I will alert you when conditions improve.",
    "Hold off on fertilizer. Soil pH is **6.24** — below the threshold where urea and DAP are effective. For potatoes and wheat, the optimal range is 6.5–7.0. Applying now risks nutrient lockout and increased N₂O emissions. Check again in 48 hours; if pH recovers above 6.5, it's safe to apply.",
    "**Not the right time to fertilize.** pH 6.24 means about 25% of applied nitrogen won't be absorbed — it'll either leach into groundwater or off-gas as N₂O. The acid deposition event should clear in 48–72 hours based on the wind forecast. I'll flag when pH crosses 6.5.",
  ],
  crop: [
    "For current conditions (pH 6.24, moisture 58%): potato and rice can tolerate this pH, but wheat is borderline. Moisture at 58% is good — no irrigation needed today. The bigger concern is the acid deposition event; pH recovery in 48h should restore normal crop uptake.",
    "Crop advisory for Ward 11 fields: **pH 6.24** is acceptable for potato (optimal 4.8–5.5 actually — potatoes prefer acidic soil!), borderline for maize (needs 5.8–7.0), and just below optimal for wheat (6.0–7.0). Moisture at 58% is healthy. Skip irrigation and fertilizer today.",
  ],
  child: [
    "With AQI at **167**, children and elderly should stay indoors between 8 AM and 3 PM. A child's walk to school at this pollution level equals exposure equivalent to smoking near someone for the same duration. Close windows on the windward side, use an air purifier if available, and postpone outdoor activities.",
    "For children at AQI **167**: school commutes before 8 AM are lower risk — AQI drops to ~98 before peak traffic. After 8 AM, a 15-minute walk exposes a child's lungs to the equivalent of roughly 0.8 cigarettes due to higher respiratory rate. Keep windows on the north-northeast side closed (wind direction from kiln corridor).",
    "**Protect children today.** AQI 167 is in the Unhealthy for All range — children's lungs are still developing and accumulate damage at lower exposure thresholds than adults. If they must go to school, mask them (N95 sized for children), take the Thimi bypass, and aim for before 7:30 AM.",
  ],
  route: [
    "The **Thimi bypass route** currently shows a predicted AQI of 98 vs. 167 on the main road — a 41% improvement. Travelling before 7:30 AM or after 6 PM reduces exposure by another 30–40%. Taking the bypass today earns you **+20 PA points** and cuts your cigarette-equivalent dose from ~3 to under 1.",
    "Best route today: **Thimi bypass** (predicted AQI 98) over the Sallaghari main road (167). That's a 41% reduction. Leave before 7:30 AM — morning traffic disperses by then, and the kiln corridor emissions haven't fully built up yet. You also earn +20 PA points for taking the alternate route on a high-AQI day.",
  ],
  exposure: [
    "At AQI 167 over a 16-hour day, today's estimated dose is approximately **805 μg·min/m³** — equivalent to **6.7 cigarettes**. Your peak risk window is 7–11 AM when traffic and industrial emissions overlap. Leaving for your commute before 7 AM reduces total daily dose by about 40%.",
    "Today's personal exposure calculation: AQI 167 × 16 hours outdoors = **805 μg·min/m³ total dose**. That's about **6.7 cigarette equivalents** (WHO methodology: 1 cigarette ≈ 120 μg dose). If you commute after 7 AM you add roughly 180 μg to that total. Before 7 AM: 60–80 μg. The difference is significant.",
  ],
  exercise: [
    "I would advise against outdoor exercise today. AQI **167** means sustained exertion significantly increases PM2.5 intake — lungs work harder and pull more particulates deeper into tissue. If you must exercise, stay indoors, keep windows closed, and aim for early morning or after 7 PM if AQI improves.",
    "**Skip outdoor workouts today.** At AQI 167, a 30-minute run increases your effective PM2.5 dose 3–5× compared to rest — your breathing rate increases, you inhale more deeply, and particles reach further into lung tissue. Gym or home workout is fine. If you must go outside, keep it under 10 minutes and wear an N95.",
    "Exercise at AQI 167: not recommended outdoors. Your respiratory rate during moderate exercise is 4–5× resting rate — meaning 4–5× the PM2.5 intake. Running or cycling exposes your lungs to the equivalent of 2+ cigarettes in 30 minutes. Yoga, bodyweight training, or treadmill indoors are all good alternatives today.",
  ],
  indoor: [
    "For your home today: close windows on the **north and northeast side** — that's the windward direction from the Sallaghari kiln corridor. South-facing windows can be cracked for ventilation. If you have an air purifier, run it on high. Vacuum with the windows shut, not open.",
    "Indoor air quality actions for today: (1) Close northeast-facing windows, (2) Run any air purifier on high, (3) Avoid cooking methods that produce smoke — fumes combine with infiltrating PM2.5, (4) Keep the bathroom fan running if it vents outside. Indoor air with these precautions drops to roughly AQI 60–80.",
  ],
  kiln: [
    "The **brick kiln corridor near Sallaghari** (2.3 km northeast of Ward 11 center) is today's dominant emission source. Northeast wind at 8 km/h is carrying PM2.5 and NO₂ directly into the ward. The kilns typically operate 6 AM to 6 PM. If you live on the northeast edge of the ward, your local AQI is likely 180–200 right now.",
    "Ward 11's primary pollution source is the **Sallaghari kiln corridor** — a cluster of brick kilns 2–3 km to the northeast. At current wind speed (8 km/h from NE), emissions take about 15–20 minutes to reach the ward center. This explains the correlation between today's NO₂ spike (0.09 ppm) and the ongoing pH drop in fields downwind.",
  ],
  weather: [
    "Current weather at Ward 11: temperature **24.1°C**, humidity **61%**, wind 8 km/h from northeast. Rain probability in the next 24 hours is 12% — low, so no natural air cleaning from precipitation expected today. The humidity level is moderate; PM2.5 particles tend to swell slightly in high humidity, increasing their health impact.",
    "Weather conditions: 24°C, 61% humidity, light northeast wind (8 km/h). That wind direction is unfortunate — it pushes kiln emissions directly into Ward 11. No rain forecast for the next 24h, so there's no natural washout expected. AQI is likely to remain elevated through the afternoon.",
  ],
  water: [
    "Staying hydrated helps your body filter out some inhaled pollutants — aim for 2.5–3L today, slightly above normal, given the PM2.5 load. Avoid drinking from outdoor sources near the main road. Indoor tap water in Ward 11 is unaffected by today's air quality event.",
    "Good thinking on hydration. At high PM2.5 exposure, your body produces extra mucus as a defense — staying hydrated helps that process work properly. 2–3L of water today. If you notice unusual throat irritation or coughing, that's the PM2.5 response — get indoors and mask up.",
  ],
  advisory: [
    "Current MATI advisory for Ward 11: **Acid deposition event active.** NO₂ spiked to 0.09 ppm, soil pH has dropped from 7.1 to 6.24 in 72 hours. Advisory actions: (1) Delay fertilizer 48h, (2) Wear N95 outdoors, (3) Take Thimi bypass if commuting, (4) Keep children indoors 8 AM–3 PM.",
    "Active advisory issued at 09:14 today. Severity: **4/5**. Pattern: acid deposition (NO₂ spike + pH drop in same geographic area within 72h). Confidence: 91%. Actions: farmers — no fertilizer for 48h; residents — N95 outdoors; parents — keep kids inside peak hours. WhatsApp alert sent to 23 registered ward members.",
  ],
  ward: [
    "Ward 11 (Thimi area, Bhaktapur Metro) has AQI **167** today — ranked 5th cleanest in the district. Ward 8 (Madhyapur) leads with AQI 52 and 340 PA actions this week. Ward 11 residents have logged 142 PA actions so far this week. The kiln corridor to the northeast is the ward's biggest air quality challenge.",
    "Ward 11 stats today: AQI **167** (Unhealthy for All), 47,000 population, 2 active sensor nodes (Air node A1, Soil node B1), 142 community PA actions this week. The ward ranks 5th out of 5 tracked wards. Ward 8 leads with AQI 52 — the difference is largely due to industrial proximity, not behavior.",
  ],
  score: [
    "Your current **PA score is 68/100** this week. Breakdown: commute report ✓ (20pts), mask selfie ✓ (20pts), child indoors ✓ (20pts), alt route 8/20pts. Soil compliance: 0 pts this week. Submit one more commute report or take the alt route tomorrow to hit 80+.",
    "PA score breakdown: report submitted (20), mask worn (20), child/elder indoors (20) — all maxed. Alt route: 8/20. Top it up by taking the Thimi bypass tomorrow for full 20pts. You'd hit Champion tier (75+) with 7 more points.",
  ],
  pm25: [
    "PM2.5 stands for **particulate matter 2.5 micrometers or smaller** — about 30× thinner than a human hair. At this size, particles bypass your nose and throat and lodge directly in lung tissue, potentially entering the bloodstream. Today's reading is 68.4 μg/m³ — the WHO's safe daily limit is 15 μg/m³.",
    "PM2.5 is fine particulate matter that the human upper respiratory system cannot filter. At 68.4 μg/m³ (today's reading), long-term exposure is linked to cardiovascular disease, stroke, and lung cancer. Short-term: coughing, irritation, reduced lung function. An N95 mask blocks ~95% of PM2.5 particles.",
  ],
  no2: [
    "NO₂ (nitrogen dioxide) in Ward 11 is at **0.09 ppm** right now — elevated above baseline (0.03 ppm normal). This comes from the kiln corridor's fuel combustion. At 0.09 ppm, sensitive groups (asthma, COPD) will feel airway irritation. It also contributes to acid rain — when NO₂ dissolves in rainwater, it forms nitric acid, which is what dropped the soil pH from 7.1 to 6.24.",
    "NO₂ reading: **0.09 ppm** (tripling the WHO annual guideline of 0.025 ppm). This spike is the early signal for acid deposition — it precedes the pH drop in soil by 24–48 hours. Today's NO₂ + current wind direction = expect continued soil acidification overnight. The correlation between this reading and the soil pH drop is what triggered MATI's advisory.",
  ],
  default_farmer: [
    "Current conditions for Ward 11 farmers: soil pH **6.24** (acidic — hold fertilizer 48h), moisture 58% (no irrigation needed), soil temp 21.3°C (optimal for root activity). AQI **167** — wear N95 if working the field. The acid deposition event should clear in 48–72 hours based on the wind forecast.",
    "Farmer advisory: soil pH is **6.24** — below optimal for wheat, maize, tomato, and lentils. No fertilizer until pH recovers above 6.5. Moisture is good at 58%. AQI 167 — if you're working the field today, wear an N95 mask. The kiln corridor (2.3 km NE) is the source of both the air pollution and the acid rain.",
  ],
  default_individual: [
    "Based on current Ward 11 conditions — AQI **167**, soil pH **6.24** — the acid deposition pattern (NO₂ spike + pH drop within 72 hours) is active. All residents: wear N95 masks outdoors. Avoid the 8–11 AM peak window. Take the Thimi bypass if commuting. Check back for updates as sensor readings change.",
    "Ward 11 right now: AQI **167** (Unhealthy for All), PM2.5 at 68.4 μg/m³, NO₂ at 0.09 ppm. Key actions for today: mask outdoors, limit time outside to under 30 minutes per trip, close northeast-facing windows, and consider taking the Thimi bypass. I'll alert you if conditions worsen.",
    "I'm pulling live data from the Ward 11 sensors. AQI is **167**, which is the Unhealthy for All category — everyone is affected, not just sensitive groups. The most impactful thing you can do right now: put on an N95 mask before going outside. Anything else you'd like to know?",
  ],
};

const DEMO_NE: Record<string, string[]> = {
  fertilizer: [
    "**आज मल नहाल्नुस्।** माटोको pH ६.२४ छ — यो अम्लीय अवस्था हो। यस अवस्थामा मल हाल्दा बिरुवाले पोषण लिन सक्दैन र पैसा खेर जान्छ। ४८ घण्टा पर्खनुस् र pH फेरि जाँच्नुस्।",
    "मल हाल्न उचित समय होइन। माटोको pH **६.२४** छ — यूरिया र DAP यस pH मा प्रभावकारी हुँदैन। ४८ घण्टापछि pH ६.५ माथि भएपछि मात्र हाल्नुस्।",
  ],
  soil: [
    "तपाईंको माटोको **pH ६.२४** छ — आलु र गहुँको लागि यो अम्लीय छ। हावामा NO₂ बढेकोले अम्लीय वर्षाको संकेत देखिन्छ। pH ६.५ भन्दा माथि नहुञ्जेल मल नहाल्नुहोस्।",
    "माटो विश्लेषण: pH **६.२४**, आर्द्रता ५८%, EC १.४१। pH ३ दिनमा ७.१ बाट ६.२४ मा खसेको छ — यो अम्ल वर्षाको संकेत हो। Sallaghari ईंटा भट्टाबाट आउने NO₂ ले पानीसँग मिलेर अम्लीय वर्षा बनाउँछ।",
  ],
  mask: [
    "आज **AQI १६७** छ — सबैको लागि हानिकारक। बाहिर जाँदा **N95 मास्क** अनिवार्य लगाउनुस्। बिहान ७ देखि ११ बजेसम्म बाहिर जान बढी जोखिम छ — सकभर घर भित्रै बस्नुस्।",
    "मास्क लगाउनुस् — आज **AQI १६७** छ। PM2.5 ६८.४ μg/m³ छ जुन WHO सीमाभन्दा ४.५ गुणा बढी हो। सर्जिकल मास्क पर्याप्त छैन — N95 मात्र प्रभावकारी हुन्छ।",
  ],
  safe: [
    "आज बाहिर जान खतरनाक छ। **AQI १६७** भनेको 'सबैको लागि हानिकारक' वर्ग हो। N95 मास्क लगाएर मात्र बाहिर जानुस् र ३० मिनेटभन्दा बढी नबस्नुस्।",
  ],
  child: [
    "**बच्चाहरूलाई घर भित्रै राख्नुस्।** AQI १६७ मा बच्चाको फोक्सोमा गम्भीर असर पर्छ। बिहान ८ देखि दिउँसो ३ बजेसम्म घर भित्रै बस्नु उत्तम हो।",
  ],
  ward: [
    "वार्ड ११ (थिमि क्षेत्र) को अहिलेको **AQI १६७** छ। Sallaghari को ईंटा भट्टा उत्तरपूर्वतर्फ २.३ किलोमीटर टाढा छ — त्यहीँबाट प्रदूषण आउँछ। यस हप्ता वार्डका बासिन्दाहरूले १४२ PA कार्य गरेका छन्।",
  ],
  default: [
    "हाल वार्ड ११ को **AQI १६७** छ र माटोको pH **६.२४** छ। यो अम्ल वर्षाको संकेत हो। किसानहरूले ४८ घण्टा मल नहाल्नुस्। सबैले बाहिर जाँदा N95 मास्क लगाउनुस्।",
    "वार्ड ११ सेन्सर डेटा: AQI **१६७** (सबैको लागि हानिकारक), PM2.5 ६८.४ μg/m³, माटो pH **६.२४**। आजको मुख्य सल्लाह: N95 मास्क लगाउनुस्, मल नहाल्नुस्, बिहान ७ बजेअघि वा साँझ ६ बजेपछि बाहिर जानुस्।",
  ],
};

function getDemoResponse(text: string, role: string): string {
  const isNepali = /[ऀ-ॿ]/.test(text);
  const t = text.toLowerCase().trim();

  if (isNepali) {
    if (/मल|खाद/.test(text)) return pick(DEMO_NE.fertilizer);
    if (/माटो|ph|अम्ल/.test(text)) return pick(DEMO_NE.soil);
    if (/मास्क|n95/.test(text)) return pick(DEMO_NE.mask);
    if (/सुरक्षित|खतरा|जोखिम/.test(text)) return pick(DEMO_NE.safe);
    if (/बच्चा|स्कुल|विद्यालय|बृद्ध/.test(text)) return pick(DEMO_NE.child);
    if (/वार्ड|थिमि|भक्तपुर/.test(text)) return pick(DEMO_NE.ward);
    return pick(DEMO_NE.default);
  }

  // Greetings
  if (/^(hi|hello|hey|namaste|namaskar|good morning|good afternoon|howdy)\b/i.test(t)) return pick(DEMO_EN.greeting);
  if (/^(thanks|thank you|thx|ty|great|awesome|perfect)\b/i.test(t)) return pick(DEMO_EN.thanks);

  // Air quality & AQI
  if (/\baqi\b|air quality index|what.*aqi|how.*aqi/i.test(t)) return pick(DEMO_EN.aqi);
  if (/pm2\.?5|particulate|fine.*particle/i.test(t)) return pick(DEMO_EN.pm25);
  if (/no2|nitrogen dioxide|no₂/i.test(t)) return pick(DEMO_EN.no2);
  if (/safe|danger|risk|safe.*outside|is it safe|how bad/i.test(t)) return pick(DEMO_EN.safe);
  if (/air|pollution|pollut|quality|breathe|breath|smog|haze|smoke/i.test(t)) return pick(DEMO_EN.aqi);

  // Mask & protection
  if (/mask|n95|n-95|respirator|protect|outdoor|outside|face cover/i.test(t)) return pick(DEMO_EN.mask);

  // Fertilizer & farming
  if (/fertiliz|urea|dap|manure|compost|apply.*soil|सार/i.test(t)) return pick(DEMO_EN.fertilizer);
  if (/crop|harvest|potato|wheat|rice|maize|tomato|farm|irrigat|water.*plant|plant.*water/i.test(t)) return pick(DEMO_EN.crop);

  // Soil
  if (/soil|ph\b|acid|alkalin|ec\b|moisture|conductivity|ground/i.test(t)) return pick(DEMO_EN.soil);

  // Children & vulnerable
  if (/child|kid|school|elder|old.*person|elderly|baby|infant|toddler|pregnant/i.test(t)) return pick(DEMO_EN.child);

  // Commute & route
  if (/route|commut|bypass|walk|drive|travel|road|thimi|traffic/i.test(t)) return pick(DEMO_EN.route);

  // Exposure & dose
  if (/dose|cigarette|exposure|how much.*breath|inhale|lung/i.test(t)) return pick(DEMO_EN.exposure);

  // Exercise & fitness
  if (/exercise|run|gym|sport|jog|cycle|workout|walk.*outside|outdoor.*walk/i.test(t)) return pick(DEMO_EN.exercise);

  // Indoor air
  if (/indoor|inside|home|house|window|ventilat|room|fan|purif/i.test(t)) return pick(DEMO_EN.indoor);

  // Kiln & sources
  if (/kiln|brick|factory|industri|source|emission|sallaghari/i.test(t)) return pick(DEMO_EN.kiln);

  // Weather
  if (/weather|temperature|temp\b|humid|rain|wind|forecast|cloud/i.test(t)) return pick(DEMO_EN.weather);

  // Water / hydration
  if (/water|drink|hydrat|fluid/i.test(t)) return pick(DEMO_EN.water);

  // Advisory
  if (/advisory|alert|warn|notif|mati.*say|what.*mati|update/i.test(t)) return pick(DEMO_EN.advisory);

  // Ward / location
  if (/ward|thimi|bhaktapur|ward 11|ward11|neighborhood|area/i.test(t)) return pick(DEMO_EN.ward);

  // PA score / rewards
  if (/score|pa\b|point|reward|badge|rank|tier/i.test(t)) return pick(DEMO_EN.score);

  // Fallback
  return role === "farmer" ? pick(DEMO_EN.default_farmer) : pick(DEMO_EN.default_individual);
}

async function streamWords(
  text: string,
  matiId: string,
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>
) {
  const words = text.split(" ");
  let accumulated = "";
  for (let i = 0; i < words.length; i++) {
    accumulated += (i === 0 ? "" : " ") + words[i];
    const snap = accumulated;
    setMessages((prev) =>
      prev.map((m) => (m.id === matiId ? { ...m, text: snap } : m))
    );
    await new Promise<void>((r) => setTimeout(r, 20 + Math.random() * 20));
  }
  setMessages((prev) =>
    prev.map((m) => (m.id === matiId ? { ...m, streaming: false } : m))
  );
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useChat(context: {
  role: string;
  ward_id: string;
  aqi?: number | null;
  ph?: number | null;
  isDemo?: boolean;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isStreaming) return;

      const userMsg: ChatMessage = {
        id: Date.now().toString(),
        role: "user",
        text: text.trim(),
      };
      const matiId = (Date.now() + 1).toString();
      const matiMsg: ChatMessage = {
        id: matiId,
        role: "mati",
        text: "",
        streaming: true,
      };

      setMessages((prev) => [...prev, userMsg, matiMsg]);
      setIsStreaming(true);

      // Always try the real backend (Gemini) first. If that fails — backend
      // down, API key missing, network blocked — fall back to the canned
      // demo response so the chat is never dead in a demo. The demo flag is
      // ignored for chat because the user has the API key configured and
      // expects live answers; canned responses are a safety net only.
      try {
        const response = await fetch(`${getBackendUrl()}/api/chat/message`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text.trim(),
            ward_id: context.ward_id,
            role: context.role,
            aqi: context.aqi ?? null,
            ph: context.ph ?? null,
          }),
        });

        if (!response.ok || !response.body) {
          // Backend returned error — fall back to smart demo response
          await streamWords(getDemoResponse(text.trim(), context.role), matiId, setMessages);
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let doneReceived = false;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (line.startsWith("event: done")) {
              doneReceived = true;
              setMessages((prev) =>
                prev.map((m) => (m.id === matiId ? { ...m, streaming: false } : m))
              );
            }
            if (!doneReceived && line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6)) as { text?: string };
                if (data.text) {
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === matiId ? { ...m, text: m.text + data.text } : m
                    )
                  );
                }
              } catch {
                /* skip malformed chunk */
              }
            }
          }
        }
      } catch {
        // Network error — fall back to smart demo response instead of raw error
        await streamWords(getDemoResponse(text.trim(), context.role), matiId, setMessages);
      } finally {
        setIsStreaming(false);
        setMessages((prev) =>
          prev.map((m) => (m.id === matiId ? { ...m, streaming: false } : m))
        );
      }
    },
    [context, isStreaming]
  );

  function clearChat() {
    setMessages([]);
  }

  return { messages, isStreaming, sendMessage, clearChat };
}
