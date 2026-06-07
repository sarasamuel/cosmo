/* Cosmo data model + helpers (ported from the prototype's data.js).
   Identities no longer carry CSS-var color strings; instead each canonical one
   carries a `palette` key (resolved per-theme in theme.js) and runtime-added
   ones carry a numeric `hue`. Colors are resolved at render time via
   identityColors(idn, theme). */

export const USER = { name: 'Sara' };

export const IDENTITIES = [
  { id: 'writer', name: 'Writer', glyph: 'W', palette: 'writer', hue: 254, desired: 25, actual: 12, lastActiveDays: 1, streak: 3 },
  { id: 'reader', name: 'Reader', glyph: 'R', palette: 'reader', hue: 46, desired: 20, actual: 8, lastActiveDays: 2, streak: 0 },
  { id: 'engineer', name: 'Engineer', glyph: 'E', palette: 'engineer', hue: 168, desired: 20, actual: 28, lastActiveDays: 0, streak: 9 },
  { id: 'musician', name: 'Musician', glyph: 'M', palette: 'musician', hue: 326, desired: 20, actual: 5, lastActiveDays: 4, streak: 0 },
  { id: 'painter', name: 'Painter', glyph: 'P', palette: 'painter', hue: 80, desired: 15, actual: 3, lastActiveDays: 8, streak: 0 },
];

// ---- Drift: the unintended time sink, made of the apps a user opts to track ----
export const DRIFT_APPS = [
  { id: 'instagram', name: 'Instagram', glyph: 'I', pct: 13, mins: 184, tracked: true },
  { id: 'tiktok', name: 'TikTok', glyph: 'T', pct: 10, mins: 142, tracked: true },
  { id: 'games', name: 'Mobile games', glyph: 'G', pct: 9, mins: 121, tracked: true },
  { id: 'youtube', name: 'YouTube', glyph: 'Y', pct: 7, mins: 96, tracked: false },
  { id: 'x', name: 'X', glyph: 'X', pct: 5, mins: 64, tracked: false },
  { id: 'reddit', name: 'Reddit', glyph: 'R', pct: 4, mins: 58, tracked: false },
  { id: 'facebook', name: 'Facebook', glyph: 'F', pct: 3, mins: 41, tracked: false },
];

export const driftSum = (apps) => apps.filter((a) => a.tracked).reduce((s, a) => s + a.pct, 0);

export function fmtMins(m) {
  const h = Math.floor(m / 60);
  const mm = Math.round(m % 60);
  if (!h) return mm + 'm';
  if (!mm) return h + 'h';
  return h + 'h ' + mm + 'm';
}

// `actual` is NOT stored here — it is always derived as driftSum(apps) + spill
// (see driftActual). `spill` is the only non-app contribution: rest logged beyond
// the Relaxation allowance overflows into Drift.
export const DRIFT = {
  id: 'drift',
  name: 'Drift',
  glyph: '∞',
  palette: 'drift',
  hue: 280,
  desired: 0,
  spill: 0,
  apps: DRIFT_APPS,
};

// The single source of truth for Drift's lived %: tracked apps + relax overflow.
export const driftActual = (drift) => Math.min(100, driftSum(drift.apps) + (drift.spill || 0));

// Relaxation — an *intended* allowance of rest. Unlike Drift, the user plans for
// it: `desired` is the share of the week set aside to relax guilt-free. Time
// logged within that allowance fills Relaxation; anything beyond it spills into
// Drift. `tracked` mirrors whether "Relaxation Time" was kept in onboarding.
export const RELAX = {
  id: 'relax',
  name: 'Relaxation',
  glyph: '♾',
  palette: 'relax',
  hue: 210,
  desired: 15,
  actual: 9,
  lastActiveDays: 0,
  tracked: true,
  isRelax: true,
};

// Typical session length per identity — the pre-filled default in the end-of-day
// review so common days are one tap. Keyed by id so it survives persistence
// (persisted identities reload without extra fields); unknown/runtime-added
// identities fall back to 30m.
export const USUAL_MINS = { writer: 45, reader: 30, engineer: 60, musician: 40, painter: 35, relax: 30 };
export const usualMins = (idn) => (idn && idn.usualMins) || (idn && USUAL_MINS[idn.id]) || 30;

// Weekly free-hours model — the hours a typical week holds for the user. Single
// source of truth shared by onboarding's cadence slider and the weekly re-plan
// sheet, so the "% → real hours" math stays consistent across both.
export const FREE_HOURS_WEEK = { min: 5, max: 90, step: 1, def: 35 };

// catalog for onboarding
export const CATALOG = [
  'Writer', 'Reader', 'Engineer', 'Musician', 'Painter',
  'Athlete', 'Chef', 'Photographer', 'Gardener', 'Linguist',
  'Designer', 'Filmmaker', 'Dancer', 'Naturalist', 'Poet',
  'Relaxation Time',
];

// recent logged sessions (most recent first)
export const SESSIONS = [
  { id: 'engineer', label: 'Coding', mins: 90, when: 'Today · 9:10 AM' },
  { id: 'reader', label: 'Reading', mins: 25, when: 'Today · 7:40 AM' },
  { id: 'musician', label: 'Piano practice', mins: 30, when: 'Yesterday · 8:15 PM' },
  { id: 'engineer', label: 'Coding', mins: 75, when: 'Yesterday · 2:00 PM' },
  { id: 'writer', label: 'Morning pages', mins: 20, when: 'Yesterday · 6:55 AM' },
  { id: 'painter', label: 'Watercolor', mins: 60, when: 'May 30 · 4:30 PM' },
];

export const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

// rebalancing insights
export const INSIGHTS = [
  { kind: 'neglect', id: 'painter', title: 'Painter has been quiet for 8 days', body: 'Your longest gap this month. A short session would reawaken it.', action: 'Log 30m painting' },
  { kind: 'nudge', id: 'writer', title: 'A 30-minute writing session today', body: 'would bring Writer back within reach of your 25% intention.', action: 'Start writing' },
  { kind: 'trade', id: 'drift', title: '3 hours on Instagram this week', body: 'is roughly equal to 4 writing sessions, or 6 piano practices.', action: 'Set a gentle limit' },
  { kind: 'balance', id: 'engineer', title: 'Engineer is carrying the week', body: 'It is 8 points above your intention. Nothing wrong — just worth noticing.', action: null },
];

export const COACH = {
  date: 'Thursday, June 4',
  note: 'This week your hours leaned toward Engineer more than Writer. That isn’t failure — deadlines pull. But your happiest logged days this month each held both reading and music. A small evening for either might be worth more than it costs.',
  signoff: 'Cosmo',
};

export const REFLECTION = {
  week: 'May 29 – Jun 4',
  summary: 'A productive, head-down week. Engineering momentum was real, but three of your five identities went mostly untended. The good news: your mornings are working — every writing and reading session this week happened before noon.',
  wins: ['9-day Engineer streak', 'Every reading session before noon', 'Returned to morning pages twice'],
  focus: ['painter', 'musician'],
  aligned: 53,
  alignedLast: 47,
};

// ---- Weekly cadence: plan is now set per-week, not once forever ----
// The current week the user is living in. `weekPlanned` (in the store) flips
// true once this week's allocations are committed (persisted to AsyncStorage).
export const THIS_WEEK = { label: 'Jun 5 – Jun 11', short: 'This week', daysIn: 1, daysTotal: 7 };

// Completed weeks, newest first. Each row carries the % PLANNED for that persona
// that week and the % actually LIVED. `aligned` is the week's overall score.
export const WEEKS = [
  { label: 'May 29 – Jun 4', aligned: 53, rows: [
    { id: 'writer', plan: 25, actual: 14 }, { id: 'reader', plan: 20, actual: 13 },
    { id: 'engineer', plan: 20, actual: 31 }, { id: 'musician', plan: 20, actual: 9 },
    { id: 'painter', plan: 15, actual: 4 }] },
  { label: 'May 22 – May 28', aligned: 47, rows: [
    { id: 'writer', plan: 20, actual: 10 }, { id: 'reader', plan: 15, actual: 9 },
    { id: 'engineer', plan: 25, actual: 38 }, { id: 'musician', plan: 25, actual: 12 },
    { id: 'painter', plan: 15, actual: 6 }] },
  { label: 'May 15 – May 21', aligned: 49, rows: [
    { id: 'writer', plan: 30, actual: 22 }, { id: 'reader', plan: 20, actual: 14 },
    { id: 'engineer', plan: 20, actual: 30 }, { id: 'musician', plan: 15, actual: 7 },
    { id: 'painter', plan: 15, actual: 9 }] },
  { label: 'May 8 – May 14', aligned: 41, rows: [
    { id: 'writer', plan: 25, actual: 11 }, { id: 'reader', plan: 25, actual: 12 },
    { id: 'engineer', plan: 20, actual: 41 }, { id: 'musician', plan: 15, actual: 5 },
    { id: 'painter', plan: 15, actual: 3 }] },
  { label: 'May 1 – May 7', aligned: 44, rows: [
    { id: 'writer', plan: 20, actual: 13 }, { id: 'reader', plan: 20, actual: 18 },
    { id: 'engineer', plan: 30, actual: 39 }, { id: 'musician', plan: 15, actual: 8 },
    { id: 'painter', plan: 15, actual: 5 }] },
  { label: 'Apr 24 – Apr 30', aligned: 38, rows: [
    { id: 'writer', plan: 25, actual: 9 }, { id: 'reader', plan: 20, actual: 11 },
    { id: 'engineer', plan: 25, actual: 44 }, { id: 'musician', plan: 15, actual: 6 },
    { id: 'painter', plan: 15, actual: 4 }] },
  { label: 'Apr 17 – Apr 23', aligned: 42, rows: [
    { id: 'writer', plan: 20, actual: 12 }, { id: 'reader', plan: 25, actual: 16 },
    { id: 'engineer', plan: 25, actual: 40 }, { id: 'musician', plan: 15, actual: 7 },
    { id: 'painter', plan: 15, actual: 3 }] },
  { label: 'Apr 10 – Apr 16', aligned: 35, rows: [
    { id: 'writer', plan: 30, actual: 10 }, { id: 'reader', plan: 20, actual: 9 },
    { id: 'engineer', plan: 20, actual: 47 }, { id: 'musician', plan: 15, actual: 4 },
    { id: 'painter', plan: 15, actual: 2 }] },
  { label: 'Apr 3 – Apr 9', aligned: 40, rows: [
    { id: 'writer', plan: 25, actual: 14 }, { id: 'reader', plan: 20, actual: 13 },
    { id: 'engineer', plan: 25, actual: 42 }, { id: 'musician', plan: 15, actual: 5 },
    { id: 'painter', plan: 15, actual: 6 }] },
  { label: 'Mar 27 – Apr 2', aligned: 33, rows: [
    { id: 'writer', plan: 20, actual: 8 }, { id: 'reader', plan: 20, actual: 7 },
    { id: 'engineer', plan: 30, actual: 51 }, { id: 'musician', plan: 15, actual: 3 },
    { id: 'painter', plan: 15, actual: 2 }] },
];

// ---- Activity Tracker: which personas got tended on each day this month ----
export const MONTH = {
  name: 'May',
  year: 2026,
  days: 31,
  todayDay: 4,
  done: {
    engineer: [1, 2, 3, 5, 6, 7, 8, 9, 10, 12, 13, 14, 15, 16, 18, 19, 20, 21, 22, 23, 25, 26, 27, 28, 29, 30, 31],
    writer: [1, 2, 4, 5, 7, 8, 11, 12, 14, 15, 18, 20, 21, 24, 27, 28, 30],
    reader: [1, 3, 5, 8, 10, 12, 14, 17, 19, 20, 23, 25, 27, 28, 31],
    musician: [2, 6, 11, 13, 16, 20, 24, 27, 30],
    painter: [3, 9, 14, 21, 29],
  },
};
export function monthDone(id, day) {
  const d = MONTH.done[id];
  return d ? d.includes(day) : false;
}

// 100 - half the total absolute drift, including the drift bucket
export function alignment(list, drift) {
  let diff = 0;
  list.forEach((i) => {
    diff += Math.abs(i.desired - i.actual);
  });
  diff += drift.actual; // drift desired is 0
  return Math.max(0, Math.round(100 - diff / 2));
}

/* ---- unique-color palette system ----
   Well-separated hues; the first five match the canonical identities. New
   personas draw the next hue far enough from every hue already in use
   (golden-angle fallback), so no two personas ever share a color. */
const PALETTE_HUES = [254, 46, 168, 326, 80, 22, 132, 292, 200, 104, 350, 230, 60, 150, 312, 8, 188, 270];
export const PALETTE = PALETTE_HUES.map((hue) => ({ hue: ((hue % 360) + 360) % 360 }));

function hueDist(a, b) {
  let d = Math.abs((((a - b) % 360) + 360) % 360);
  return d > 180 ? 360 - d : d;
}

/* Returns a hue for a new persona, far from every hue already in use. */
export function assignHue(existing) {
  const used = (existing || []).map((i) => i.hue).filter((h) => h != null);
  for (const p of PALETTE) {
    if (used.every((u) => hueDist(u, p.hue) > 22)) return p.hue;
  }
  // palette exhausted: choose the hue maximally far from every used hue
  let best = 0;
  let bestMin = -1;
  for (let c = 0; c < 360; c += 1) {
    const m = used.length ? Math.min(...used.map((u) => hueDist(u, c))) : 180;
    if (m > bestMin) {
      bestMin = m;
      best = c;
    }
  }
  return best;
}

export function paletteHue(index) {
  return PALETTE[((index % PALETTE.length) + PALETTE.length) % PALETTE.length].hue;
}
