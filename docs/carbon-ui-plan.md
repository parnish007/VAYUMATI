# VayuMitti Carbon Credits UI Design Plan
## ECOTHON PRAKRITI 2026 — Surface Expansion for the "Soil Bond" Journey

---

## 1. Implementation Order

1. Dashboard personal brass strip (highest visibility, smallest scope)
2. Rewards page enhancements (builds on existing certificate)
3. Community page carbon teaser (Wall tab injection)

---

## 2. Surface 1 — Dashboard Personal Brass Strip

### Current State

The dashboard has a ward-level Soil Bond strap showing collective ward stats. What is missing is the personal carbon status — the user's own CO₂e, NPR value, and tier, which the rewards page shows but the dashboard does not reference.

### Visual Layout

```
┌─────────────────────────────────────────────────────────┐
│ 🌿  Sapling  ·  You  ·  28.4 kg CO₂e    ≈ रू 98   →   │
└─────────────────────────────────────────────────────────┘
```

Background: `rgba(156,115,32,0.08)`, border: `1px solid rgba(156,115,32,0.22)`, border-radius 10px, padding `py-2 px-3.5`.

- Left: tier icon + tier label (8px bond-mono uppercase gold) + bullet + user's first name
- Center: `{co2e_kg.toFixed(1)} kg CO₂e` in `font-display font-bold text-sm` at `#c8a43a` + `≈ रू {total_npr}` in `text-xs` at `#8a6a2c`
- Right: `View Bond →` pill (`background: rgba(156,115,32,0.14), color: #9c7320`), wrapped in `<Link href="/rewards">`
- Sub-line: `Provisional · next Verra audit Q4 2026` in 9px mist — use `PROVISIONAL_DISCLOSURE` constant

### Where to Insert (dashboard/page.tsx)

- Mobile: after the ward strap block, before `<PeopleCounter>`
- Desktop: after the ward strap block, before the `grid-cols-3` section

### New imports needed

```tsx
import { DEMO_CARBON_LEDGER_BY_ROLE } from "@/lib/demoData";
import { carbonTier } from "@/lib/carbon";
```

### Inline function to define

```tsx
function PersonalCarbonStrip({ carbon, role }: { carbon: CarbonLedger; role: UserRole }) { ... }
```

---

## 3. Surface 2 — Rewards Page Enhancements

### Current State

The Soil Bond certificate (rewards/page.tsx lines 129–279) ends with the MRV countersignature ribbon. Below it is the silver PA card. Two blocks need to go between them.

### Block A — Journey Arc / Tier Progress Timeline

Horizontal timeline with four milestone nodes: Sprout (0 kg) → Sapling (10 kg) → Grove (50 kg) → Steward (200 kg)

```
 Sprout   Sapling   Grove    Steward
  ●────────●────────●────────●── ─ ─ 200 kg
 0 kg    10 kg    50 kg   200 kg
              ↑ You are here (28.4 kg)
```

- Connecting line: `<div>` with absolute positioning, `height: 2px`, gradient from `#9c7320` to `rgba(156,115,32,0.15)`, width = `progressPct%`
- `const progressPct = Math.min(100, (carbon.total_co2e_kg / 200) * 100)`
- "You are here" dot: amber glow ring, `box-shadow: 0 0 8px rgba(240,187,42,0.5)`
- Below timeline: `{(carbon.next_payout_kg - carbon.total_co2e_kg).toFixed(1)} kg to cooperative cash-out threshold · cohort opens Sep 2026` in bond-mono 9px gold
- Container: `border-radius: 12px, padding: 16px, background: rgba(156,115,32,0.06), border: 1px solid rgba(156,115,32,0.22)`

### Block B — "What Generates Carbon" Explainer

Static read-only list card. Title: `◈ What earns Soil Bond carbon credits`. Grid of `CARBON_META` entries:

| Icon | Label | Methodology code | CO₂e per event | Unit note |
|---|---|---|---|---|
| Each `CARBON_META[kind].icon` | `.label` | stripped methodology | `.co2e_per_event_kg kg` | `.unit_note` |

- `grid-cols-1` on mobile, `sm:grid-cols-2` on wider
- Rows where `carbon.by_kind[kind].count > 0` get highlight background + `✓ {count} logged` in 9px gold
- Left border per row: gold for soil actions, blue for alt_route, green for tree_planted, orange for cookstove

### Where to Insert (rewards/page.tsx)

After line 279 (closing `</div>` of brass certificate), before line 282 (silver PA `<Card>`).

### New imports needed

```tsx
import { carbonTier, CARBON_META, CARBON_TIERS, nextCarbonTier } from "@/lib/carbon";
```
(add `CARBON_TIERS` and `nextCarbonTier` to existing carbon.ts import)

---

## 4. Surface 3 — Community Page Carbon Teaser

### Visual Layout

```
┌──────────────────────────────────────────────────────────┐
│ ◆ Ward 11 · Soil Bond                         Rank #3   │
│   2.34 t CO₂e sequestered this month                     │
│   47 contributors                                         │
│                                                           │
│  Top contributors this month:                             │
│  🥇 Ward Executive  142 kg   🏛️ Steward                  │
│  🥈 Ram Bahadur      84.6 kg  🌾 Sapling                 │
│  🥉 Anisha Tamang     4.8 kg  👤 Sprout                  │
│                                                           │
│  Recent carbon events:                                    │
│  ♻️  Ram logged compost · +1.8 kg · 15m ago              │
│  🔥  Hari applied biochar · +2.4 kg · 2h ago             │
│                                                           │
│            View your Soil Bond certificate →              │
└──────────────────────────────────────────────────────────┘
```

### Component Structure

Inline function `WardCarbonStrip()` (no props — all data from imported constants):

1. **Header bar**: `◆ Ward {ward_id} · Soil Bond · Chaitra 2082` in bond-mono 8px gold | Rank badge right
2. **Big number**: `{(co2e_kg_today / 1000).toFixed(2)} t CO₂e` in `font-display font-black text-2xl #9c7320`
3. **Top contributors**: sorted by kg descending from `DEMO_CARBON_LEDGER_BY_ROLE`, 🥇🥈🥉 medals, name + amount + tier label
4. **Recent carbon events**: 2 hard-coded inline objects + filtered `DEMO_ACTIVITY_FEED`; local type `CarbonEventRow` to avoid type conflicts
5. **Link CTA**: `View your Soil Bond certificate →` full-width, `href="/rewards"`, border-top dotted gold

Container: `border-radius: 14px, padding: 16px, background: rgba(156,115,32,0.07), border: 1px solid rgba(156,115,32,0.25)`

### Where to Insert (community/page.tsx)

Inside `{activeTab === "wall" && (` block, after the `{isDemo && <ActivityFeed items={DEMO_ACTIVITY_FEED} />}` line, before `{showShareBtn && (`. Render only when `isDemo === true`.

### New imports needed

```tsx
// Add to demoData import:
DEMO_WARD_CARBON_TODAY

// Add to carbon.ts import:
CARBON_META, CARBON_TIERS
```

---

## 5. Demo Data Mapping

| UI Element | Data Key | File |
|---|---|---|
| Personal strip CO₂e, NPR, tier | `DEMO_CARBON_LEDGER_BY_ROLE[role]` | demoData.ts |
| Personal strip tier label/icon | `carbonTier(carbon.total_co2e_kg)` | carbon.ts |
| Ward strap | `DEMO_WARD_CARBON_TODAY` | demoData.ts |
| Journey arc milestones | `CARBON_TIERS` (first 4 of 5) | carbon.ts |
| "What generates" grid | `CARBON_META` (all 6 kinds) | carbon.ts |
| Community top contributors | `DEMO_CARBON_LEDGER_BY_ROLE` (all 3 roles) | demoData.ts |
| Community ward stat | `DEMO_WARD_CARBON_TODAY` | demoData.ts |
| Community carbon events | 2 hard-coded inline + filtered `DEMO_ACTIVITY_FEED` | community/page.tsx |

---

## 6. Aesthetic Consistency Rules

All new surfaces follow the brass/parchment visual language from the certificate:

- **Gold tints**: `#9c7320` (primary), `#c89530` (highlight), `#8a6a2c` (muted), `rgba(156,115,32,0.N)` for backgrounds/borders
- **No pure white or bright yellow** — use `#f2ede4` parchment only for maximum-contrast labels
- **Font family**: `var(--font-bond-mono)` for codes/amounts/labels, `var(--font-bond-display)` for large numbers, `var(--font-bond-text)` for prose
- **No box-shadows with color** except on the journey arc "you are here" dot
- **Bond mono via inline style**, not Tailwind `font-mono` (which resolves to system fonts)

> ⚠️ Pitfall: `var(--font-bond-mono)` is NOT defined in globals.css — only `--font-display` and `--font-body` are. It resolves because it's set inline in the certificate's style block. New components should confirm the variable resolves visually, or fall back to `font-mono` (Tailwind) for community strip where the distinction matters less.

---

## 7. Files to Modify

| File | Change |
|---|---|
| `src/app/(app)/dashboard/page.tsx` | Add `DEMO_CARBON_LEDGER_BY_ROLE` + `carbonTier` imports. Define `PersonalCarbonStrip`. Insert in mobile + desktop ward strap area. |
| `src/app/(app)/rewards/page.tsx` | Add `CARBON_TIERS` + `nextCarbonTier` to carbon import. Define `CarbonJourneyArc` + `CarbonExplainer`. Insert between certificate and silver PA card. |
| `src/app/(app)/community/page.tsx` | Add `DEMO_WARD_CARBON_TODAY`, `CARBON_META`, `CARBON_TIERS` imports. Define `WardCarbonStrip`. Insert in Wall tab after ActivityFeed. |

No new files. No new npm packages.

---

*Plan created: 2026-05-25 · ECOTHON PRAKRITI 2026 · Ward 11, Kathmandu*
