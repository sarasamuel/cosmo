# Cosmo — Identity-Balance App

## Overview
**Cosmo** is a mobile app that reframes time management around **who you want to become** rather than a to-do list. The user defines a set of **identities** ("Writer", "Reader", "Engineer", "Musician", "Painter", …), declares how much of their time each one *deserves* (intention), logs sessions as they live, and the app visualizes the gap between intention and reality as an orbiting "cosmos" plus a set of balance metrics.

This handoff covers the full prototype, with particular depth on the two features built most recently:

1. **Onboarding cadence step** — the user chooses to budget their time **by day, week, or month**, and sets how many **free hours** they actually have in that window. Every identity's percentage is then scaled into real hours.
2. **"Free Time" persona + app-usage tracking** — a default-selected, deselectable "Free Time" identity that reserves guilt-free hours for rest/scrolling. Within it, the user opts to **track specific apps** (Instagram, TikTok, mobile games, etc.). Tracked-app time aggregates into a single **Drift** bucket shown across the portfolio and all metrics.

## About the Design Files
The files in `design_files/` are **design references created in HTML/React (via Babel-in-the-browser)** — a working prototype that demonstrates the intended look, layout, copy, and interactions. **They are not production code to copy directly.** They use CDN React + an in-browser Babel transform, inline styles, and plain-global data modules — appropriate for a fast prototype, not for shipping.

Your task is to **recreate these designs in the target codebase's environment** using its established patterns, component library, navigation, and state management. If there is no existing app yet, choose the most appropriate framework for the product (this is a phone-first app, so **React Native / Expo** or **SwiftUI** are natural choices) and implement the designs there.

## Fidelity
**High-fidelity (hifi).** Colors, typography, spacing, copy, and interactions are final and intended to be matched closely. Exact token values are listed below in *Design Tokens*. Recreate the UI faithfully using the target codebase's primitives; do not introduce a new visual language.

One caveat: the prototype renders inside a **fixed 868×1228 "device" frame** that is scaled to fit the browser. That scaler is a *prototype-only* concern — on a real device you render full-screen and drop the bezel/scaling logic entirely.

---

## Architecture of the Prototype (for reference)
All state lives in `app.jsx` (`App` component). Data and helpers are plain globals on `window.MOSAIC` defined in `data.js`. Screens are functions that receive state + callbacks as props. Load order (from `Cosmo.html`): React/ReactDOM/Babel → `data.js` → `viz.jsx`, `viz3d.jsx` (cosmos visualizations) → `components.jsx` (icons, segmented control, status bar, tab bar, starfield) → `screens.jsx` (Dashboard, Insights) → `screens2.jsx` (Reflect, Identities) → `logsheet.jsx` (log-session bottom sheet) → `onboarding.jsx` → `app.jsx`.

Key state in `App`:
- `theme` — `'dark'` (the hero/default) or `'light'`; persisted to `localStorage['cosmo-theme']`.
- `started` — whether onboarding is complete; persisted to `localStorage['cosmo-started']`.
- `tab` — active bottom-tab: `'home' | 'insights' | 'reflect' | 'identities'`.
- `identities` — array of identity objects (see data model).
- `drift` — the Drift object, including its `apps` array (see below).
- `sessions` — logged sessions, most-recent-first.
- `logOpen`, `logPreset`, `toast` — log-sheet + confirmation-toast UI state.

---

## Data Model

### Identity
```js
{ id, name, glyph,        // glyph = single uppercase initial shown in the colored disc
  hue,                    // base hue (deg) for palette generation
  color, soft, deep,      // CSS color refs (see tokens)
  desired,                // intended % of time (0–50, step 5)
  actual,                 // lived % this period
  lastActiveDays,         // days since last logged session
  streak }                // consecutive-day streak
```
Canonical seed identities: Writer (desired 25 / actual 12), Reader (20/8), Engineer (20/28), Musician (20/5), Painter (15/3).

### Drift (the time-sink bucket)
```js
DRIFT = {
  id:'drift', name:'Drift', glyph:'∞', hue:280,
  color:'var(--c-drift)', soft:'var(--c-drift-soft)', deep:'#4a4757',
  desired: 0,                       // you never intend to drift
  actual: driftSum(apps),           // = sum of pct over tracked apps
  apps: DRIFT_APPS                   // breakdown, below
}
```

### Drift apps (tracked-usage breakdown)
```js
DRIFT_APPS = [
  { id:'instagram', name:'Instagram',    glyph:'I', pct:13, mins:184, tracked:true  },
  { id:'tiktok',    name:'TikTok',       glyph:'T', pct:10, mins:142, tracked:true  },
  { id:'games',     name:'Mobile games', glyph:'G', pct:9,  mins:121, tracked:true  },
  { id:'youtube',   name:'YouTube',      glyph:'Y', pct:7,  mins:96,  tracked:false },
  { id:'x',         name:'X',            glyph:'X', pct:5,  mins:64,  tracked:false },
  { id:'reddit',    name:'Reddit',       glyph:'R', pct:4,  mins:58,  tracked:false },
  { id:'facebook',  name:'Facebook',     glyph:'F', pct:3,  mins:41,  tracked:false },
]
```
- `pct` = the app's share of waking time; `mins` = minutes this week.
- `tracked` = whether the user has opted to count it. **Only tracked apps contribute to Drift.**
- `driftSum(apps)` = `apps.filter(tracked).reduce(sum of pct)`. Drift's `actual` is always kept equal to this.
- Default tracked set: Instagram, TikTok, Mobile games → Drift `actual` = 32%, 3 apps, 447 min (≈7h 27m) this week.

### Catalog (onboarding identity options)
`Writer, Reader, Engineer, Musician, Painter, Athlete, Chef, Photographer, Gardener, Linguist, Designer, Filmmaker, Dancer, Naturalist, Poet, Free Time`. **"Free Time"** is a special entry — see below.

### Color assignment
`data.js` exposes a palette system so every persona gets a **distinct** hue:
- `PALETTE` — 18 well-separated OKLCH hues; the first 5 match the canonical identities.
- `paletteColor(index)` — color by position (used in onboarding so the Nth chosen persona gets the Nth palette color).
- `assignColor(existing)` — picks the next hue ≥22° away from every hue already in use; golden-angle fallback when the palette is exhausted (used when adding a new identity at runtime).
- **"Free Time" is the exception** — it always wears the neutral Drift tone (`--c-drift`), never a jewel hue, to signal it is intentional slack, not an aspiration.

---

## Screens / Views

### 1. Onboarding (`onboarding.jsx`)
A 5-step flow (progress dots at the bottom, indices 0–4). Rendered when `started === false`.

**Step 0 — Welcome.** Centered. A small SVG constellation (5 colored nodes wired to a central ink dot, staggered fade-in). Eyebrow "Cosmo"; serif headline *"You are not your to-do list."* (second line italic); supporting paragraph; primary "Begin" button.

**Step 1 — Choose identities.** Eyebrow "Step one"; headline "Who do you want to be?". A wrap of **chips** from the catalog (multi-select). Selected chips fill with the persona's palette color + white text + a check icon. Below the chips: a text input ("Add your own…") + "Add" button to append custom personas. Footer shows "N chosen" and a primary "Continue" (disabled until ≥2 chosen).
- **Default selection:** Writer, Reader, Engineer, Musician, Painter, **and Free Time**.
- **Free Time sub-panel** (renders only when Free Time is selected):
  - A caption row: a small drift-colored dot + "**Free Time** reserves guilt-free hours for rest, scrolling, nothing in particular. Deselect it to give every hour to an identity."
  - A **card** titled "Track app usage" (with an "optional" label) and copy: "Choose which apps to count. Their time rolls up into your **Drift** — so you can see where Free Time really goes."
  - A wrap of app chips (from `DRIFT_APPS`). Tracked apps fill with `--c-drift` + white + check icon; untracked show a "+" icon. Tapping toggles `tracked`. Initial tracked state mirrors `DRIFT_APPS` defaults.

**Step 2 — Cadence + free time** (`OnbCadence`). Eyebrow "Step two"; headline "How do you keep time?"; copy "Balance can be measured a day, a week, or a month at a time. Choose the rhythm that fits your life."
  - A centered **Segmented control** with three options: **By day / By week / By month**.
  - A **card** with: label "Free time {each day|each week|each month}" on the left, a large serif duration readout on the right (e.g. "7h"); helper copy "The hours that are truly yours to spend — after work, sleep, and obligations."; a **range slider**; min/max labels beneath.
  - Slider ranges per cadence (`CADENCE` config):
    - **day** — min 1h, max 16h, step 1, default **7h**
    - **week** — min 5h, max 90h, step 1, default **35h**
    - **month** — min 20h, max 360h, step 5, default **150h**
  - **Switching cadence reseeds the slider to that rhythm's default.**
  - **Day-only extra:** an "Your evening" block (moon icon) showing an illustrative window `clock(24 − freeHours) – 12:00 AM`, e.g. 7 free hours → "5:00 PM – 12:00 AM". This is purely illustrative of where the free block sits.
  - Footer caption: "Every identity's share is scaled to this — so a percentage always means real hours." Back + Continue buttons.

**Step 3 — Allocate** (`OnbAllocate`). Eyebrow "Step three"; headline "How much of you?"; copy "Divide your {duration} {each day/week/month} between them…". A running total line that turns green at exactly 100% ("· balanced") and amber otherwise. A card with one **slider row per selected persona** (min 0, max 50, step 5), each showing: a colored dot, the name, the **percent** (serif) **and the real-hours equivalent** beneath it (e.g. `freeHours × pct/100` formatted, with the cadence suffix `/day` `/wk` `/mo`). Back + Continue.

**Step 4 — Reveal.** Eyebrow "Your cosmos"; headline "Here is the shape of you."; the `CosmosViz` visualization (non-interactive here); primary "Enter Cosmos" → completes onboarding (`onDone` → sets `started`).

### 2. Dashboard / Portfolio — `home` tab (`screens.jsx` → `Dashboard`)
Scrolling view. Top: date eyebrow, serif greeting "Good morning, {name}", italic subtitle. Then:
- **Cosmos visualization** card ("YOUR COSMOS", "drag to rotate") — orbiting identity nodes; `filled = your time`, `ring = intention`.
- **This week's balance** card — an alignment ring (e.g. "54% aligned") + a sentence naming the leading and lagging identity, with a "Tend to {lagging}" pill.
- **Desired vs. actual** list ("past 7 days") — one **IdentityRow** per identity: colored glyph disc, name, `actual / desired %`, and a dual bar (actual fill over the intention track).
- **Drift row (aggregate + expandable)** — directly after the identities, separated by a top border:
  - Collapsed: ∞ glyph disc (drift color), "Drift" + a small amber "DRIFT" tag, `round(actual) / 0%` on the right with a chevron, the dual bar, and a sub-line "Tracking N apps · {total mins} this week" (or "No apps tracked").
  - Tapping toggles expansion (chevron rotates: 90° collapsed → −90° expanded).
  - Expanded (indented under the row): one line per **tracked** app — small drift-colored glyph, app name, weekly minutes, a thin bar (`pct` relative to the max tracked app), and a "**Stop**" pill to untrack it. Below, an "**Also track**" section listing **untracked** apps as "+ {name}" chips to add them.
  - Toggling any app **live-recomputes** Drift's `actual` (= `driftSum`) and the "Tracking N apps · … this week" summary.
- **Coach note** (compact) and **Recent sessions** list (last 4: glyph, label, when, minutes).

### 3. Insights — `insights` tab (`screens.jsx` → `Insights`)
Eyebrow "Rebalancing", headline "Insights", intro copy. A list of **insight cards**, each with a colored icon disc, a bold title, body copy, and an optional action **pill**. Insight kinds map to a color+icon: `neglect`→painter/clock, `nudge`→writer/arrow, `trade`→drift/bell, `balance`→engineer/flame. One insight ("3 hours on Instagram this week…") is a **Drift trade** — it references aggregated drift time. Ends with a full Coach note.

### 4. Reflect — `reflect` tab (`screens2.jsx` → `Reflect`)
Weekly reflection. Hero card: an **AlignmentRing** + delta vs. last week (green/amber) + a sentence. **Portfolio balance** card: two **StackedBar**s — "Intended" (identities by `desired`) and "Lived" (identities **plus Drift** by `actual`); Drift appears as a neutral segment here, so its tracked-app total is represented in the lived balance. **Identity trends** grid: per-identity sparkline + up/down/flat arrow. **In a sentence** summary card with "win" pills. **Where to lean next week**: focus identity cards with "{n}pts below intention".

### 5. You / Identities — `identities` tab (`screens2.jsx` → `Identities`)
Eyebrow "Your identities", headline "The people you're becoming". A **balance meter** card (sum of `desired` %, "Balanced / Over-committed / Room to give"). A card with a **slider row per identity** (0–50, step 5) to re-set intentions. An **Appearance** section with a Theme segmented control (Light "Celestial dawn" / Dark "Deep space"). "Add an identity" (uses `assignColor`) and "Replay the intro" (clears `started`) buttons.

### Global chrome (`components.jsx`)
- **StatusBar** — faux iOS status bar (9:41, dots, battery).
- **TabBar** — 4 tabs (Portfolio / Insights / Reflect / You) with a center floating **"+"** button that opens the log sheet.
- **LogSheet** (`logsheet.jsx`) — bottom sheet to log a session (pick identity + minutes). On commit: bumps that identity's `actual`, **reduces Drift proportionally** (tracked apps scale down by the same ratio), prepends a session, and shows a confirmation **toast**.
- **Starfield** — decorative animated star dots.
- **Segmented**, **Icon** (inline SVG set: insights, reflect, plus, sun, moon, chevron, check, clock, flame, arrow, bell, sparkle, …).

---

## Interactions & Behavior
- **Onboarding cadence ↔ allocation link:** the chosen cadence and free-hours value flow into Step 3, where each persona's percentage is rendered as real hours (`freeHours × pct / 100`) with the cadence suffix. Changing cadence resets free hours to that cadence's default.
- **Free Time glate:** the app-tracking panel and the explanatory caption only appear while "Free Time" is selected. Deselecting Free Time hides them (and conceptually returns those hours to the identities).
- **Drift aggregation (must hold everywhere):** Drift's `actual` is *always* `sum of pct over tracked apps`. Tracking/untracking an app updates the number, the "N apps · mins" summary, the dual bar, the Reflect "Lived" stacked bar, and any insight that references drift. There is no independent Drift value to keep in sync — derive it.
- **Logging a session:** `commitLog(identity, mins)` → `actual += max(1, round(mins/12))` (capped at 60), `streak += 1`, `lastActiveDays = 0`; Drift `actual` drops by `round(bump/2)` and each tracked app's `pct`/`mins` scale by the new/old ratio; a session is prepended; a toast shows for ~2.6s.
- **Expansion chevron:** rotate 90° (collapsed) ↔ −90° (expanded), 0.25s transition.
- **Theme:** toggled from the You tab; persisted; dark is the hero default.
- **Animations:** chip/card fade-ups (`.fade-up`), insight cards stagger by `index × 90ms`, viz nodes stagger by `index × 120ms`, toast slide/scale in. Keep these subtle; respect reduced-motion in the real build.

## State Management
Recreate with the target stack's idioms (e.g. a store/context). Needed state: identities (with desired/actual/streak/lastActive), the drift object **including its apps array with per-app `tracked`/`pct`/`mins`**, logged sessions, active tab, theme, onboarding-complete flag, and transient log-sheet/toast state. Persist theme and onboarding-complete. Derive Drift `actual` from the apps array rather than storing it twice.

## Design Tokens
Defined as CSS custom properties in `styles.css` for both themes (light "Celestial dawn" default `:root`, dark "Deep space" under `[data-theme="dark"]`). Dark is the hero.

**Light / Dark core**
- bg `#ecebf6` / `#0a0a15`; bg-2 `#e3e2f1` / `#060610`
- surface `#ffffff` / `rgba(26,24,44,0.62)`; surface-2 `#f3f3fb` / `rgba(38,35,62,0.58)`; surface-3 `#e8e8f4` / `rgba(54,50,84,0.5)`
- ink `#1f1e2e` / `#eef0fb`; ink-soft `#5d5c72` / `#a9a8c6`; ink-faint `#9897b0` / `#6c6a8a`
- line `rgba(30,28,60,0.10)` / `rgba(160,160,230,0.13)`; line-2 `rgba(30,28,60,0.05)` / `rgba(160,160,230,0.06)`

**Identity colors (OKLCH; light / dark)**
- writer `oklch(0.60 0.10 252)` / `oklch(0.74 0.11 254)`
- reader `oklch(0.63 0.115 40)` / `oklch(0.76 0.125 46)`
- engineer `oklch(0.60 0.085 168)` / `oklch(0.76 0.10 168)`
- musician `oklch(0.585 0.105 322)` / `oklch(0.74 0.115 326)`
- painter `oklch(0.70 0.105 70)` / `oklch(0.82 0.11 80)`
- **drift (Free Time / time-sink, neutral)** `oklch(0.62 0.014 280)` / `oklch(0.66 0.018 280)`
- Each has a `-soft` variant (same hue, alpha ~0.13 light / 0.18 dark) used for tints/backgrounds; identity objects also carry a `deep` hex.
- **good** (green) `oklch(0.60 0.085 168)` / `oklch(0.76 0.10 168)`; **warn** (amber) `oklch(0.66 0.13 50)` / `oklch(0.80 0.13 64)`.

**Radii:** `--r-sm 12px`, `--r-md 18px`, `--r-lg 26px`, `--r-xl 34px`.

**Shadows:** three tiers `--shadow-sm / -md / -lg` per theme (see `styles.css`).

**Typography**
- Serif (headlines, numeric readouts): **Newsreader** (weights 300–600, italics used). Used at: onboarding hero 44px/500, step headlines 32–33px/500, large duration/percent readouts 20–34px/500.
- Sans (UI, body): **Hanken Grotesk** (400/500/600/700). Body 14.5–18px; labels/captions 12–14px; eyebrows ~12px uppercase with letter-spacing; weights 600–700 for emphasis.
- Both loaded from Google Fonts in `styles.css`.

**Spacing:** screen padding ~36px (dashboard/insights/you) / 44px (onboarding); card padding 18–30px; common gaps 9–14px (chips/rows) and 18–26px (sections).

## Assets
No raster images. All iconography is **inline SVG** in `components.jsx` (`Icon` component, 1.8–2.6 stroke). The cosmos and constellation visuals are **drawn with SVG/canvas** in `viz.jsx` / `viz3d.jsx`. Persona "glyphs" are just single letters in colored discs. Fonts come from Google Fonts. There are no brand assets to license.

## Files (in `design_files/`)
- `Cosmo.html` — entry point; shows script load order.
- `styles.css` — full design system (tokens, both themes, component styles).
- `data.js` — data model + palette/aggregation/format helpers on `window.MOSAIC` (**read this first** — it defines identities, `DRIFT`, `DRIFT_APPS`, `driftSum`, `fmtMins`, color helpers).
- `onboarding.jsx` — the 5-step flow incl. cadence (`OnbCadence`), allocation (`OnbAllocate`), and the Free Time app-tracking panel.
- `app.jsx` — root state, `commitLog`, `toggleDriftApp`, tab routing.
- `screens.jsx` — Dashboard (incl. the expandable Drift breakdown) + Insights.
- `screens2.jsx` — Reflect + Identities ("You").
- `logsheet.jsx` — log-session bottom sheet.
- `components.jsx` — Icon set, Segmented, StatusBar, TabBar, Starfield, shared bits.
- `viz.jsx`, `viz3d.jsx` — cosmos visualizations.

To run the prototype as-is: serve this folder over HTTP (e.g. `npx serve design_files`) and open `Cosmo.html` — it needs a server because the `.jsx` files are fetched. To reset onboarding, clear `localStorage` (`cosmo-started`, `cosmo-theme`).
