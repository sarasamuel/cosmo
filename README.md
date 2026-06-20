# Cosmo — an identity-balance app

## Overview
**Cosmo** reframes time around **who you want to become** rather than a to-do list. You define a set of **identities** ("Writer", "Reader", "Engineer", "Musician", "Painter", …), declare how much of your week each one *deserves* (its **intention**), log sessions as you live, and the app shows the gap between intention and reality as an orbiting **cosmos** (or a **constellation**) plus a set of gentle, no-guilt balance metrics.

Two ideas anchor the product:

1. **A weekly rhythm.** Time is balanced **per week**. You set a plan for the week (how much of your free hours each identity gets), live it, and reflect. The week is a real rolling calendar window, so it resets on its own — last week's sessions simply fall out of "this week" once the date crosses the boundary.
2. **Rest is intentional, not a failure.** A **Relaxation** allowance reserves guilt-free hours for rest. Time logged within the allowance fills Relaxation; beyond it the allowance just caps. Rest is never something you "fail."

> **Heads-up for readers of older revisions:** earlier versions of this doc described a "Drift / Free Time" app-usage-tracking feature. That model was removed. The app now uses the simpler **Relaxation allowance** described here — there is no app tracking, no "Drift" bucket.

## Status & source of truth
Cosmo is implemented in **React Native / Expo (SDK 55)** under `src/` (root: `App.js`). The **code is the source of truth for behavior**; this README is the product/design overview. For setup, how to run it, and the full file map, see [`RUNNING.md`](RUNNING.md).

---

## Architecture
State lives in a single React context store ([`src/store/Store.js`](src/store/Store.js)); the data model + derivations are in [`src/data/data.js`](src/data/data.js) (**read this first**); screens under [`src/screens/`](src/screens/), visualizations under [`src/viz/`](src/viz/), the weekly UI under [`src/weekly/`](src/weekly/), onboarding under [`src/onboarding/`](src/onboarding/), and platform glue (color, storage, notifications, auth, sync, layout) under [`src/lib/`](src/lib/).

Key state in the store (persisted to AsyncStorage unless noted; the mutable domain state is stored as one atomic blob and also backed up to the cloud when signed in):
- `theme` — `'dark'` (the hero/default) or `'light'`.
- `form` — visualization style: `'orbit'` (cosmos) or `'constellation'`.
- `started` — whether onboarding is complete.
- `tab` — active bottom tab: `'home' | 'insights' | 'reflect' | 'identities'`.
- `identities` — array of identity objects (see data model). The editable fields are stored; `actual`, `lastActiveDays`, and `streak` are **derived live from `sessions`**.
- `retired` — retired identities, kept for history so their past sessions still resolve a name/color.
- `relax` — the Relaxation allowance (`desired` share + `tracked` flag).
- `sessions` — logged sessions, most-recent-first, each carrying a real epoch-ms `ts`.
- `planHistory` — `{ weekStartMs: { identityId: pct } }`; a snapshot of each committed weekly plan, so completed weeks are scored against the intention that was actually in force then.
- `freeHours` — the weekly free-hours pool the per-identity percentages scale into.
- `reminder` — daily local-notification prefs (`{ enabled, hour, minute }`).
- `weekPlanned`, `allMetWeek` — whether this week's plan is committed; the week-start the whole-week celebration last fired for.
- `session`, `userName` — Supabase auth session + display name (cloud backup; the app is fully usable offline / signed out).
- transient UI: log sheet, week-plan sheet, add-identity sheet, backup sheet, toast, cosmos focus, identity Detail screen, end-of-day review, celebration overlays.

---

## Data Model

### Identity
```js
{ id, name, glyph,        // glyph = single uppercase initial shown in the colored disc
  palette,                // canonical personas: a palette key (writer/reader/engineer/musician/painter/relax)
  hue,                    // runtime-added personas: a numeric base hue (deg)
  desired,                // intended % of the week (0–50, step 5)
  // derived live from sessions (NOT stored):
  actual,                 // points lived this week (≈ 12 min = 1 pt; capped at 60)
  lastActiveDays,         // whole days since the most recent session (99 = never)
  streak }                // consecutive-day streak ending today/yesterday
```
Colors are resolved at render time by `identityColors(idn, theme)` ([`src/theme/theme.js`](src/theme/theme.js)): canonical personas read their per-theme `palette` entry; runtime ones derive `color/soft/deep` from `hue`. The five canonical seed personas are Writer, Reader, Engineer, Musician, Painter.

### Relaxation
```js
RELAX = {
  id: 'relax', name: 'Relaxation', glyph: '♾', palette: 'relax',
  desired,            // the weekly share set aside for rest (0 = not reserved → not tracked)
  actual,             // = min(desired, points lived as 'relax' this week)
  isRelax: true,
  tracked }           // false when desired is 0
```
Relaxation fills up to its allowance; time beyond it caps (rest never "spills" or counts as a miss).

### Sessions & weekly derivations
A logged session is `{ id, label, mins, ts }`. Everything time-based derives from sessions against the current calendar week ([`src/data/data.js`](src/data/data.js)):
- `SESSION_POINTS(mins) = max(1, round(mins / 12))` — a session's contribution in the same "points" unit as `desired`.
- `weekPoints(sessions, id)` — points an identity earned this week (callers clamp: identities at 60, Relaxation at its allowance).
- `daysSinceLast`, `dayStreak` — last-active + streak, from real timestamps.
- `pastWeeks(sessions, identities, planHistory)` / `recentWeeksFor(…)` — real weekly history (one entry per completed week that had activity), each scored against `planForWeek(planHistory, weekStart, idn)` — the plan in force that week, falling back to the current `desired` only for weeks older than any recorded plan.
- `monthActivity(sessions)` — which days this month each identity got tended (the dot strips / activity tracker).

### Catalog (onboarding identity options)
`Writer, Reader, Engineer, Journaler, Musician, Painter, Athlete, Chef, Photographer, Gardener, Linguist, Designer, Filmmaker, Dancer, Naturalist, Poet` — plus anything the user types in.

### Color assignment
[`src/data/data.js`](src/data/data.js) provides a palette system so every persona gets a **distinct** hue:
- `PALETTE` — 18 well-separated OKLCH hues; the first five match the canonical identities.
- `paletteHue(index)` — hue by position (used in onboarding so the Nth chosen persona gets the Nth palette hue).
- `assignHue(existing)` — picks the next hue ≥22° away from every hue already in use; maximally-distant fallback when the palette is exhausted (used when adding an identity at runtime).

---

## Onboarding
A **6-step** flow (progress dots at the bottom, indices 0–5), rendered while `started === false` ([`src/onboarding/Onboarding.js`](src/onboarding/Onboarding.js)). On "Enter Cosmos" it builds the chosen identities (with their first-week allocations as `desired`) into the store, records that allocation as the first entry of the plan history, **starts with no logged sessions**, carries the free-hours + rest allowance in, and flips `started`.

- **Step 0 — Welcome.** Constellation mark, eyebrow "Cosmo", serif headline *"You are not your to-do list."*, "Begin".
- **Step 1 — Choose identities.** Multi-select chips from the catalog + an "Add your own…" field. Default selection: Writer, Reader, Engineer, Musician, Painter. Continue is enabled at ≥2 chosen.
- **Step 2 — Cadence + free time** ([`OnbCadence`](src/onboarding/OnbCadence.js)). Time is fixed to a **weekly** rhythm; a card + slider set the **free hours this week** (`FREE_HOURS_WEEK`: min 5h, max 90h, step 1, default **35h**) — the pool every percentage scales into real hours.
- **Step 3 — Rest allowance** ([`OnbRest`](src/onboarding/OnbRest.js)). Set the Relaxation share of the week (default 15%).
- **Step 4 — Allocate** ([`OnbAllocate`](src/onboarding/OnbAllocate.js)). A slider row per chosen persona (0–50, step 5) showing percent + the real-hours equivalent; a running total that turns green at 100%.
- **Step 5 — Reveal.** Pick the **Orbit / Constellation** view (becomes the default), preview your cosmos, "Enter Cosmos".

An optional **auth-entry** flow ([`AuthFlow`](src/onboarding/AuthFlow.js)) offers cloud backup sign-in; it can be skipped and won't reappear once seen.

---

## Screens

### 1. Portfolio — `home` tab ([`src/screens/Dashboard.js`](src/screens/Dashboard.js))
Date eyebrow, serif greeting, italic prompt. Then:
- **Cosmos / Constellation** hero — orbiting (or wired) identity nodes; `fill = your time`, `ring = intention`. Tapping a node opens the log sheet.
- **Week-plan banner** — prompts you to set this week's plan if you haven't.
- **This week's balance** — a gentle sentence naming the leading and lagging identity, with a "Tend to {lagging}" pill and a soft "vs last week" note. On a fresh week with nothing logged yet, it shows an inviting empty-state instead of a "leaning" claim.
- **Coach note** + **Recent sessions** (derived from real session timestamps, with live "Today / Yesterday / Jun 8" labels).

### 2. Insights — `insights` tab ([`src/screens/Insights.js`](src/screens/Insights.js))
Rebalancing observations generated from the live identities ([`buildInsights`](src/lib/coach.js)) — a neglected/never-begun identity, one furthest below its intention, one carrying the week — each as a card colored by its own identity, with an optional action pill. Empty-state when there's nothing honest to say yet. Ends with a full Coach note.

### 3. Reflect — `reflect` tab ([`src/screens/Reflect.js`](src/screens/Reflect.js))
Weekly reflection, all from real history. Hero: an **AlignmentRing** for the most recent completed week + delta vs. the week before. **Past weeks, plan vs. lived** ([`PastWeeks`](src/weekly/PastWeeks.js)) — expandable per-week breakdowns scored against the plan in force that week; empty until weeks accrue. **Monthly activity tracker**. **Portfolio balance** — Intended vs. Lived stacked bars. **In a sentence** recap with "win" pills. **Where to lean next week** — the identities furthest below intention.

### 4. You / Identities — `identities` tab ([`src/screens/Identities.js`](src/screens/Identities.js))
- **This week's plan** — opens the weekly plan sheet.
- A slider row per identity (0–50, step 5) to adjust intentions, plus **Add an identity** (uses `assignHue`).
- **Appearance** — Theme toggle (Light "Celestial dawn" / Dark "Deep space").
- **Nightly reminder** — a daily local notification (toggle + time presets) that, when tapped, opens the end-of-day review.
- **Cloud backup** — passwordless email-code sign-in (opt-in, local-first); sign out.
- **Replay the intro** — clears `started` to re-run onboarding.

### 5. Identity Detail ([`src/screens/IdentityDetail.js`](src/screens/IdentityDetail.js))
Opened from a focused cosmos node: a hero glyph, **This week** (planned vs. lived), a **This month** dot strip, **Across the weeks** (real per-week plan-vs-lived history, empty-state until one accrues), **Recent moments**, and a Retire action.

### Global chrome ([`src/components/`](src/components/))
- **TabBar** — Portfolio / Insights / Reflect / You, with a center floating **"+"** that opens the log sheet.
- **LogSheet** — pick an identity (or Relaxation) + minutes; on commit it records a timestamped session (everything else re-derives) and shows a toast. Crossing an intention fires a single-identity celebration; completing the whole week fires the all-met triumph (once per week).
- **WeekPlanSheet** ([`src/weekly/WeekPlanSheet.js`](src/weekly/WeekPlanSheet.js)) — allocate this week's % per identity (with last week's lived value shown as reference), pause an identity for the week ("resting"), and adjust free hours. Committing snapshots the plan into `planHistory` and re-arms the all-met celebration.
- **BackupSheet**, **Starfield**, **Icon** (inline SVG set), **Toast**, celebration overlays.

---

## Weekly rhythm & key behaviors
- **Rolling week.** `weekStartMs` / `inWeek` define a real calendar window (weeks start Sunday). "This week's" numbers and the whole-week celebration stop seeing last week's sessions once the boundary is crossed — no reset bookkeeping.
- **Logging derives everything.** `commitLog(identity, mins, note)` just prepends a timestamped session. `actual`, `streak`, and `lastActiveDays` re-derive on the next render, so a new week starts fresh automatically. (≈12 min = 1 point; identities cap at 60, Relaxation at its allowance.)
- **Plans persist forward.** A committed plan applies until you re-plan; `planHistory` captures each commit so historical weeks keep their real intention.
- **End-of-day review** — tapping the nightly reminder opens a review that applies several logs at once (deduped per delivery so a stale launch doesn't reopen it).
- **Cloud sync** ([`src/lib/sync.js`](src/lib/sync.js), [`auth.js`](src/lib/auth.js), [`supabase.js`](src/lib/supabase.js)) — the whole domain snapshot is one JSON row, last-write-wins by an `updatedAt` ms stamp. Local stays the source of truth; it's a no-op when Supabase isn't configured.
- **Animations & motion** — subtle fade-ups and staggered viz nodes; respect reduced-motion.

---

## Design Tokens
Two themes (light "Celestial dawn" default, dark "Deep space" — the hero), defined as resolved color objects in [`src/theme/theme.js`](src/theme/theme.js) (OKLCH converted to rgb/rgba via [`src/lib/color.js`](src/lib/color.js)).

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
- **relax** (rest allowance, calm teal) `oklch(0.64 0.075 210)` / `oklch(0.76 0.085 210)`
- Each has a `-soft` variant (same hue, alpha ~0.13 light / 0.18 dark) for tints; objects also carry a `deep` hex.
- **good** (green) `oklch(0.60 0.085 168)` / `oklch(0.76 0.10 168)`; **warn** (amber) `oklch(0.66 0.13 50)` / `oklch(0.80 0.13 64)`.

**Radii:** `sm 12`, `md 18`, `lg 26`, `xl 34`. **Shadows:** three tiers (`sm/md/lg`) per theme (iOS shadow props; Android elevation).

**Typography**
- Serif (headlines, numeric readouts): **Newsreader** (300–600, italics used).
- Sans (UI, body): **Hanken Grotesk** (400/500/600/700). Body 14.5–18px; labels/captions 12–14px; eyebrows ~12px uppercase, tracked.
- Loaded via `@expo-google-fonts/*`.

**Spacing:** screen padding ~36px (most screens) / 44px (onboarding); card padding 18–30px; common gaps 9–14px (chips/rows) and 18–26px (sections).

## Assets
No raster images. All iconography is **inline SVG** ([`src/components/Icon.js`](src/components/Icon.js)). The cosmos and constellation visuals are drawn with `react-native-svg` ([`src/viz/`](src/viz/)). Persona "glyphs" are single letters in colored discs. Fonts come from Google Fonts via Expo.

## Implementation map
See [`RUNNING.md`](RUNNING.md) for prerequisites, run commands, and the full architecture/file-map table.
