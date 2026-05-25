# VayuMitti — UI/UX Decisions
## For ECOTHON PRAKRITI 2026 · Prepared for judge Q&A

Read this top to bottom once. Every answer below maps to something you can point to on screen.

---

## 1. Why dark theme only?

**The decision:** Single dark theme. No light mode toggle, no system preference detection.

**The reason:** VayuMitti is an environmental intelligence tool, not a productivity app. The data it shows is urgent and serious — AQI 247 is not neutral information. A dark base (`#0a1a0f` — a very dark forest green, not pure black) makes the coloured AQI readings and alert states the visual loudest thing on screen, which is exactly right. On a projector in a bright room, a dark interface with high-contrast data points reads better than a white interface where everything competes.

The base colour is not `#000000`. It's `#0a1a0f` — a very dark forest green. This connects the app visually to the Kathmandu Valley environment it is monitoring. It is a design decision, not an accessibility shortcut.

---

## 2. The colour system

**Five functional colour groups, each with a purpose:**

| Group | Hex range | Used for |
|---|---|---|
| Sage greens | `#3d8b5e` → `#7dc99a` | Good states, primary actions, active nav, data labels |
| Ink greens | `#0a1a0f` → `#1a2f20` | Backgrounds — 3 depth levels |
| AQI semantics | `#3d8b5e` → `#7b0000` | AQI readings only — codified EPA colour scale |
| Amber/gold | `#d4a017` → `#f0bb2a` | Warnings, carbon credits, moderate AQI |
| Rust/red | `#c44b2b` → `#e05a38` | Unhealthy states, destructive actions, alerts |

**Why not Material Design / standard UI colours?** Standard UI colour conventions (blue for primary, red for error) would conflict with the AQI semantic colour system. If `blue = link` and `red = error`, what does `red AQI` mean? We needed to own the entire colour vocabulary. The sage-green primary colour was chosen because the brand is rooted in vegetation and soil — it is not arbitrary.

**The AQI colour scale is locked and shared between firmware, backend, and frontend.** The same `aqiColor()` function produces the same hex for AQI 167 whether it is on the OLED display, the dashboard gauge, or the exposure route map. Consistency here is not aesthetic — it is critical for the demo to make sense.

---

## 3. Typography — two systems, deliberately separate

**System 1: App UI** — Fraunces (display, serif) + Instrument Sans (body)

- **Fraunces** is used for all data numbers — AQI readings, PA scores, CO₂e amounts, cigarette counts. It is an optical-size variable serif that renders beautifully at both 64px (hero numbers) and 11px (dashboard labels). The slight ink-trap character at display sizes gives it a printed quality that is appropriate for data that has weight and consequence.
- **Instrument Sans** is used for all body copy, labels, navigation, descriptions. It is a geometric humanist sans that is legible at 9px on a phone screen without looking compressed. We chose it over Inter because it has slightly wider letterforms at small sizes.

**System 2: Carbon certificate** — DM Serif Display + Cormorant Garamond + IBM Plex Mono

This is a deliberately separate typographic voice used exclusively for the Soil Bond certificate on the Rewards page. The decision was to make the carbon certificate feel like a physical document — a Verra registry printout — rather than an app screen. This required a completely different typeface palette:

- **DM Serif Display** — the certificate name and big CO₂e number. High-contrast serif, looks hand-set.
- **Cormorant Garamond** — the italic body text and schedule entries. Classic italic serif, reads as formal prose.
- **IBM Plex Mono** — methodology codes, registry numbers, MRV stamps. Monospaced, reads as printed receipt / terminal output.

The reason three separate typefaces is justified: the certificate is not UI — it is a document rendered inside UI. Breaking typography conventions here is the point.

---

## 4. Navigation: why two completely separate nav systems

**Mobile (< 768px):** Fixed bottom nav, 56px minimum height, 5 tabs max.

**Desktop (≥ 768px):** 176px fixed left sidebar with grouped navigation.

**The reason for the hard split:** The user base is split into two fundamentally different use cases:

- **Ward members and farmers on mobile** need to act quickly — log a commute, share a mask selfie, read an advisory. Bottom navigation is the standard for action-oriented mobile apps (iOS Maps, Instagram, Grab). Thumb reach to bottom tabs is ergonomic.
- **Ward executives on desktop** need to monitor and govern — read sensor grids, approve member requests, generate PDFs. A sidebar with labelled groups (MONITOR / ENGAGE) matches the mental model of a dashboard tool.

There is no hamburger menu, no overlay drawer, no responsive sidebar. The two navigations are written as separate components (`Sidebar.tsx` and `BottomNav.tsx`) because they serve different users in different contexts. Trying to merge them would produce a compromise that serves neither well.

**Role-based nav content:** The navigation items change based on user role (individual / farmer / executive). A farmer sees `Soil/Air` where an individual sees `Ward Pulse`. An executive sees `Members` and `Requests` that others do not. This is not personalisation for its own sake — it is reducing irrelevant cognitive load. A farmer does not need to think about member management.

---

## 5. The `Card` component

Every content block in the app uses the same `Card` — `rounded-2xl bg-ink-2 border border-sage-tint p-4`. This is an intentional constraint.

`border-sage-tint` is `rgba(61,139,94,0.12)` — the border is barely visible. It is present to give cards physical boundaries on screen without creating a boxed/imprisoned feeling. The very low opacity (12%) keeps the interface breathing.

`bg-ink-2` (`#112217`) lifts cards one depth level above the page background (`#0a1a0f`). Two-level depth: page → card. There is no three-level nesting in this design. If you find yourself needing to put a card inside a card, the element should be a different UI pattern.

`rounded-2xl` is 16px border radius. This is not the default `rounded` (4px) or `rounded-lg` (8px). At 16px, cards feel organic and hand-crafted rather than corporate-template. It matches the brand's connection to natural landscape shapes.

---

## 6. Loading states and skeletons

`Skeleton` uses `animate-pulse` with `bg-ink-3` (`#1a2f20`). This is a pulse, not a shimmer. The reasoning: shimmer implies the content is loading progressively (suitable for image-heavy feeds). Our content is structured data — AQI readings, pH values. Pulse says "placeholder, data incoming" without implying anything about the structure of what will fill it. The pulse stays within the three-level depth system — it is slightly lighter than the card background, slightly darker than the loaded content.

For the data that matters most (the AQI reading), the loading state is a specific sized placeholder `h-7 w-20 rounded-full` that occupies the exact space the AQI pill will fill. This prevents layout shift when data arrives.

---

## 7. Animation philosophy

Three animation types, each with a specific purpose:

- **`fadeUp` (0.2s ease)** — used on page entry. Content rises 6px and fades in. This is subtle and fast — 200ms is deliberately below the threshold where a user notices an "animation". It just makes the page feel responsive without being theatrical.
- **`pulse-dot` (opacity 1 → 0.25 → 1, 1.6s infinite)** — used on live indicator dots. The asymmetric timing (not a simple 0→1→0) makes the pulse read as a heartbeat rather than a blink. Used exclusively on data that is genuinely live — the AQI pill, the sensor live dot, the logged-in user indicator.
- **`shimmer` (translateX 200%)** — used on loading skeletons in the community wall and card lists. A single bright bar sweeps left to right at 1.5s. Indicates the system is working, not stuck.

**What was deliberately excluded:** Page transition animations (Framer Motion), hover animations on cards, scroll-triggered animations. These would have added noise to a data-dense interface where the data itself is the animation.

---

## 8. Map decisions

**Library: Leaflet + react-leaflet, CartoDB dark tiles**

The alternatives considered were Google Maps and Mapbox. Both were rejected:

- **Google Maps** — requires an API key, has usage billing, and the default tile style is light/white which would break the dark UI. Adding a custom dark style on Google Maps requires additional configuration and a paid account.
- **Mapbox** — dark styles available, but requires an access token and has free tier limits that could fail during the live demo.
- **Leaflet + CartoDB Voyager Dark** — no API key, no billing, 100% free tier, the tile server is highly reliable, and the dark tile style (`dark_all`) matches the app's ink-green background almost perfectly out of the box.

The exposure route map uses **AQI-coloured polyline segments** — each GPS waypoint segment is coloured using the same `aqiColor()` function as the rest of the app. Green at home, orange on main roads, red through the kiln corridor. This creates a visual story on the map without any labels.

---

## 9. The PM Particles visualisation

**Technology: Three.js WebGL particle system**

On the dashboard, when AQI is above moderate, a particle cloud renders above the AQI hero section — 200 to 1,000 particles (scaled linearly with AQI up to 500), coloured with the AQI semantic colour, drifting upward.

**The decision:** PM2.5 is invisible. You cannot photograph it, you cannot point to it. The particles make the invisible visible. At AQI 167 (unhealthy), the cloud is amber and dense. At AQI 310 (very unhealthy), it is purple and nearly opaque. This is not decoration — it is the data.

**Why Three.js and not a CSS/SVG animation?** At 800+ particles, CSS transforms would cause layout thrashing. Three.js uses WebGL which runs on the GPU, keeping the main thread free for data updates. The canvas is absolutely positioned and pointer-events-none so it never interferes with touch targets.

The particle count and colour are both reactive — they update within 3 seconds of a new sensor reading via SSE, so the cloud changes visibly during the demo when the sensor is triggered.

---

## 10. The Soil Cross-Section

A 80px tall layered view showing a topsoil / subsoil cross-section with colour that shifts with the live pH reading. The colour scale maps directly to soil chemistry:

- pH < 5.5 → rust red (strongly acidic, crop damage range)
- pH 5.5–6.0 → amber (slightly acidic, correction needed)
- pH 6.0–7.0 → sage green (optimal for most Nepal crops)
- pH > 7.5 → amber → rust (alkaline, salt-stress risk)

The decision was to show the soil visually, not just as a number. A farmer who does not read English sees the colour shift from green to red and understands the pH dropped. The label says "Strongly Acidic" in English, but the colour communicates it in any language.

---

## 11. The Soil Bond certificate — a different aesthetic language

The carbon credits certificate on the Rewards page deliberately breaks every visual convention in the rest of the app. Where the app is dark-background / sage-green / geometric sans, the certificate is:

- **Parchment background** (`#ede2c4` → `#d9c89f`)
- **Engraved brass borders** (corner scrollwork SVGs)
- **Three different typefaces** (DM Serif Display, Cormorant Garamond, IBM Plex Mono)
- **Vermilion notary stamp** (rotated -13°, double-ring circle)
- **Dotted ledger lines** in the schedule

**Why break the system?** The certificate is not a UI screen — it is a document. Carbon credits exist in a physical world of legal registries, notarised certificates, and audited ledgers. Rendering the certificate to look like a Verra registry printout communicates credibility, not just data. A judge who looks at it should feel like they could print it out and it would hold in a room with accountants. That is the intent.

---

## 12. Data fetching: SWR and polling

**Pattern:** SWR with `refreshInterval: 30_000` for non-critical data, `60_000` for score data. SSE push for live sensor updates.

**Why not WebSocket?** SSE (Server-Sent Events) is unidirectional (server → client), which is all we need for sensor push. It works through corporate proxies and hackathon venue firewalls better than WebSocket. It is also simpler to debug — you can open Network → EventStream in DevTools and see every event as it arrives.

**Why SWR and not React Query?** SWR's stale-while-revalidate model is semantically correct for sensor data: show the last known value immediately (no blank screen), then silently fetch fresh data in the background. React Query has the same feature but is a larger bundle and the extra features (mutations, infinite scroll) are not needed here.

**Cache: no-store on all sensor routes.** Next.js App Router caches `fetch()` responses by default. All sensor API routes have `cache: 'no-store'` to prevent stale data being served from the CDN edge. A judge who sees AQI 167 must be seeing the current reading, not a 5-minute-old edge-cached response.

---

## 13. Responsive breakpoint: one single breakpoint

The entire app uses exactly one responsive breakpoint: `md:` which is `768px` in Tailwind.

Below 768px: ward member UX — full-screen single column, bottom nav, large tap targets.
At and above 768px: ward executive UX — sidebar, multi-column grid, dense information.

There is no `sm:`, no `lg:`, no `xl:`. One breakpoint, two distinct layouts, with no ambiguous states in between. The reason: two user types, two devices, one clean boundary. Adding more breakpoints would produce five or six intermediate states that serve no actual user.

---

## 14. Minimum tap targets

All interactive elements on mobile are `min-h-[48px]` or wrapped in elements that meet the 48×48px minimum. The bottom nav tabs are `min-h-[56px]`. The tracking start/stop button is `py-3.5` which at the default font size produces a 52px touch target.

The reason is not just WCAG compliance. In Nepal, smartphones are often used with one hand while doing something else — walking, cooking, carrying produce. Small tap targets cause misses, frustration, and abandonment. 48px minimum is the baseline for an app that will be used outdoors.

---

## 15. The `env(safe-area-inset-bottom)` padding

The main content area has `pb-[calc(5rem+env(safe-area-inset-bottom))]` on mobile. This is the CSS environment variable for the iOS home indicator notch. Without it, the last card on any page would be hidden behind the home bar on iPhones. This is a real usability failure on the device most ward members in Kathmandu use. We included it because the demo is on phones, not simulators.

---

## 16. Accessibility decisions

Things we got right for the demo context:

- **Colour is never the only signal.** Every AQI colour state also has a text label ("Good", "Moderate", "Unhealthy for Sensitive Groups"). Colour-blind users can still read the information.
- **`aria-label` on icon buttons.** The fullscreen toggle has `aria-label={isFs ? "Exit fullscreen" : "Enter fullscreen"}`. The icon alone conveys nothing to a screen reader.
- **`tabular-nums` on all numbers.** AQI readings, scores, and CO₂e values use `tabular-nums` so that changing numbers (e.g., AQI updating live) do not cause layout shift. A number changing from 167 to 312 would otherwise push other elements sideways because 3 is narrower than 1.
- **`font-display: swap`** on all Google Fonts. Text renders in the fallback font immediately; the custom font loads in without a blank flash or layout shift.

Things that are not perfect (honest answer if asked):

- Dark backgrounds with `#4d7a5e` text fail WCAG AA contrast ratio (4.5:1 required). This applies to secondary labels throughout the app. It was a deliberate aesthetic choice (we preferred the muted green over accessible grey) and would need to be addressed in a production release.
- The PM Particles Three.js canvas has no alt text or fallback. Users on browsers without WebGL (rare) see a black rectangle.

---

## 17. Demo-mode UX

The app has a demo mode that bypasses authentication and uses pre-populated sensor data. The demo toggle (`DemoToggle.tsx`) is a small pill in the top bar and sidebar, visible only in demo mode.

The design decision was: **demo mode should feel exactly like live mode.** The same components, the same data shapes, the same animations. The only visible difference is a small amber `DEMO` label in the top bar. This is intentional — judges are evaluating the product, not the demo scaffold.

The role switcher (individual / farmer / executive) is demo-only. It lets a judge switch perspectives in real time during Q&A without logging out and back in. Each role switch updates the navigation, the dashboard perspective, the rewards data, and the carbon certificate identity simultaneously.

---

## One-line answers for fast Q&A

- **"Why dark theme?"** — Makes coloured AQI data the loudest visual signal on screen, which is the right hierarchy for an emergency information tool.
- **"Why two nav systems?"** — Two user types, two devices, two mental models. Merge them and you serve neither well.
- **"Why Leaflet not Google Maps?"** — No API key, no billing, dark tiles match the UI, 100% free tier reliable enough for the demo.
- **"Why that specific green?"** — `#3d8b5e` is sage/forest green. The brand is about Kathmandu Valley environment. The colour is derived from the context, not from a UI kit.
- **"Why does the carbon certificate look so different?"** — It is a legal document rendered inside a UI, not a UI component. Different register, different visual language on purpose.
- **"Why serif for numbers?"** — Fraunces at large sizes has ink traps that give readings weight and seriousness. "AQI 247" should feel heavy. A geometric sans at the same size would feel light and neutral.
- **"What did you not get right?"** — Secondary label contrast fails WCAG AA. We prioritised the aesthetic coherence of the muted sage palette over strict contrast compliance. In a production app with real users, we would fix it.

---

*Written against actual source code · VayuMitti · ECOTHON PRAKRITI 2026 · Ward 11, Kathmandu*
