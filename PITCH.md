# VayuMitti · Stage Demo Script — v2 (Carbon Edition)

> This supersedes the "Demo Sequence" section of `CLAUDE.md` for ECOTHON PRAKRITI 2026.
> Total stage time: **6:30**. If running long, drop Beat 8 (architecture aside). Never drop Beat 4.5.

---

## What changed from v1

The original 9-beat script (CLAUDE.md) tells the air + soil + WhatsApp + community story but **does not surface the carbon-credit revenue model**. That model is built into the app now (Mero Bari Gold Ledger, Rewards Carbon Wallet, Dashboard ward strap) and Nepal received $9.4M from the World Bank FCPF in November 2025 — judges from any climate-finance background will be listening for it.

**Beat 4.5 (new)** plants the carbon flag between the pH-drop advisory and the WhatsApp arrival. ~45 seconds. Restructures the closing economics in Beat 9.

---

## The Run

### Beat 1 — Walk up (0:00 → 0:15)
No slides. Dashboard projected. Both nodes physical on table. Phone (registered demo number) on table, screen up.
**Pause for 3 seconds. Let them look at the AQI gauge climb.**

### Beat 2 — The protagonist (0:15 → 0:45)
> "Her name is Anisha. She lives in Ward 11, Thimi. Her AQI right now is 167. That's worse than smoking five cigarettes a day. She doesn't know — until our sensor tells her."

Tap dashboard → Anisha's exposure tab. **Show the 10-point S-curve route on the 3D-tilted map.** Point at the kiln corridor peak (AQI 207).

### Beat 3 — The air node speaks (0:45 → 1:30)
Walk to Node A. Blow into the PMS5003 inlet (or wave a lit incense stick 30cm away for 10s — better visual).
**The OLED ticks up. The dashboard AQI ticks up. Within 3 seconds.**
> "MQTT → InfluxDB → SSE. Three hundred and thirty milliseconds end to end. No cloud middleman."

### Beat 4 — The soil node responds (1:30 → 2:30)
Pick up dropper bottle of dilute vinegar. **Drop two drops into the soil pot near Node B's pH probe.**
Within 5 seconds the dashboard soil card drops from pH 6.41 → 5.88.
> "Acid deposition pattern. NO₂ spike from the kiln plus pH crash in the soil. MATI sees both at once."

Watch the right-hand reasoning trace populate. **3 tool calls. 8-second timeout never hits.**

### Beat 4.5 — *Carbon as revenue, not gimmick* (2:30 → 3:15) **← NEW**
Switch dashboard role to Farmer (top-right pill). Open the **Community → Bari** tab.
> "When Anisha's father — Ram — sees this advisory, he doesn't just delay fertilizer. He composts the residue instead of burning it. Watch."

Tap **Composted** chip in the Mero Bari quick-log. Tap **Log it**.
**Gold toast pops:** `+20 silver · +1.8 kg gold · रू 6`
> "Two ladders. Silver PA points for protective behavior. Gold carbon credits for climate impact. Verra VM0042 methodology — the same methodology Nepal's REDD+ program used to bring in $9.4 million from the World Bank in November."

Point at the Gold Carbon Ledger card. **84.6 kg CO₂e cumulative. रू 292.**
> "Provisional — the cohort opens in December. But the MRV layer is real. Every gold kilogram on this card is backed by a Mero Bari diary entry plus a Node B pH and EC reading within one kilometer. That's auditable. That's what gets paid."

Switch to **Rewards** tab. **Two cards side by side: Silver tier ring, Gold Carbon Wallet.**
> "When Ram hits 100 kilograms, he cashes out at the ward cooperative. Not theoretical. Boomitra and Varaha already do this in India — Varaha raised $20 million doing exactly this in October."

### Beat 5 — WhatsApp lands (3:15 → 4:00)
Pivot back to dashboard.
**The demo phone buzzes.** Pick it up. Show the Twilio WhatsApp message — Nepali on top, English below.

Read the first line aloud (in Nepali if comfortable, English otherwise):
> "एसिड वर्षा संकेत — मल नहाल्नुस् ४८ घण्टा।"
> "Acid deposition detected. Hold fertilizer 48 hours. Take alt route."

### Beat 6 — Mask wall (4:00 → 4:45)
Take the spare N95 from the table. Selfie. Tap Share to Wall.
**~2 seconds while Claude Vision verifies.** Approved. Selfie pops onto the community wall.
> "Mask verified by Claude Vision. +20 PA. Compliance ticker hits 38% — past the social-proof threshold. Neighbors seeing neighbors act."

Offer the spare mask to a judge. Let them take a selfie. **Their face appears on the wall.** Brief silence — let it land.

*(Optional 10-sec aside: tap the mic icon on the MATI chat tab → "What's safer for me tomorrow morning?" → voice-input demo. Drop only if running over.)*

### Beat 7 — Ward Board (4:45 → 5:15)
Switch to executive role. Open Community → Board.
> "Ward 8 is cleanest. Not because they got lucky with the wind. Because their farmers logged 340 PA actions this week. The Clean Ward Board scores collective behavior — air quality is the lagging indicator, not the leading one."

Point at the Gold Carbon column. **Ward 11 is #3 today — 2.34 tCO₂e avoided, 47 contributors.**

### Beat 8 — Resilience (5:15 → 5:45) *— cut this beat if running long*
> "One last thing. Hardware fails. Networks fail. So do we."

**Unplug Node A's USB.** Within 90 seconds the dashboard switches to amber: *Fallback · Open-Meteo*.
> "Open-Meteo Air Quality API picks up. SoilGrids for the soil node. The advisory keeps coming. The selfie wall keeps loading. The carbon ledger keeps counting — because compost evidence is local."

Plug Node A back in. Watch the dot go green.

### Beat 9 — The ask (5:45 → 6:30)
**No projection change. Just talk.**
> "VayuMitti is one ward, two nodes, one phone, three lakhs in capital cost. Multiply by 32,000 wards in Nepal and you have a continuous environmental ledger feeding a real carbon market."
>
> "We are applying to the **CRPF Urban Climate Resilience component**. The Mero Bari carbon ledger is the bridge — it pays farmers in NPR backed by a Verra methodology, it gives ward executives a public dashboard, and it gives the Bhaktapur Metro a measurable KPI for their climate budget."
>
> "Three lakhs to deploy this ward. Three crores to deploy the metro. Three hundred crores to cover Nepal. And every gold kilogram on every ledger is auditable."

**STOP. Do not say anything else.**

---

## Pre-stage checklist (do this < 30 min before)

- [ ] Demo phone **9742585185** opted in to Twilio sandbox (`join <keyword>` SMS sent)
- [ ] `claude-sonnet-4-6` set in `vayu-backend/.env` (the `claude-sonnet-4-20250514` string EOLs 2026-06-15)
- [ ] Both nodes connected to **venue Wi-Fi** (not phone hotspot — try venue first)
- [ ] HiveMQ dashboard shows **3 clients** connected (A1, B1, backend)
- [ ] InfluxDB Cloud data explorer shows fresh writes (within 30s)
- [ ] Vercel + Railway deploys green; `/api/health` returns 200
- [ ] Spare N95 on table for the judge selfie moment
- [ ] Dropper bottle of dilute white vinegar (1:5 with water)
- [ ] Phone screen brightness at 100%, do-not-disturb OFF
- [ ] Both nodes' OLEDs facing the judge bench

## Anticipated judge questions & verified answers

**Q: "What's the latency from sensor to dashboard?"**
A: ~330ms total. MQTT publish ~200ms (HiveMQ EU-Central), Influx write ~80ms (batched), SSE push <50ms. Demonstrated live on stage.

**Q: "How do you prove a farmer actually composted?"**
A: Three converging signals. (1) Mero Bari diary entry with optional photo. (2) Node B pH/EC reading from the same field within ±1 km / ±1h. (3) Cross-check against absence of smoke spike at the nearest Node A. No single signal can be faked alone.

**Q: "Who pays for Verra audit?"**
A: Cooperative aggregates 200+ farmers per cohort to amortize the $30-50k audit cost. We're targeting the Bhaktapur Metro's climate budget for the first cohort + a pre-purchase agreement with a carbon trader as the financing bridge. Not figured-out-on-the-fly — this is how Boomitra and Varaha already structure it in India.

**Q: "What about leakage — farmer logs compost but burns half the residue at night?"**
A: Node A picks up the night smoke plume. We flag and zero out that day's gold credit. The sensor network *is* the leakage guard. This is why we don't accept carbon credits from users without a nearby active sensor — disclosed on the ledger.

**Q: "Why ICVCM cookstove methodology and not Verra alone?"**
A: ICVCM gave green light to Gold Standard TPDDTEC and Verra VM0050 in November 2025. Both are valid. We default to TPDDTEC for cookstove switches because Nepal's existing cookstove pipeline is Gold Standard-aligned.

---

*Last updated: 2026-05-25 · v2 with carbon track*
