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

// Unique id for a newly-logged session. The random suffix avoids collisions even
// within the same millisecond or across devices. Two distinct log actions ARE
// distinct sessions (even with identical identity/mins/ts), so randomness — not
// content — is the right identity here.
export function newSessionId() {
  return `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

// Union two session lists into one de-duplicated, newest-first list. Sessions
// are append-only and carry a stable `sid`, so identity is the sid (legacy
// rows without one fall back to the content tuple). Critical for multi-device
// safety: restoring a cloud snapshot must MERGE sessions, never overwrite, or a
// session logged on one device is lost when another device syncs. (Incoming
// snapshots are migrated first, so both sides carry sids before this runs.)
export function mergeSessions(a, b) {
  const seen = new Set();
  const out = [];
  [...(a || []), ...(b || [])].forEach((s) => {
    if (!s || !s.ts) return;
    const key = s.sid != null ? `sid:${s.sid}` : `${s.id}|${s.ts}|${s.mins}|${s.label || ''}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(s);
  });
  return out.sort((x, y) => (y.ts || 0) - (x.ts || 0));
}

export function fmtMins(m) {
  const h = Math.floor(m / 60);
  const mm = Math.round(m % 60);
  if (!h) return mm + 'm';
  if (!mm) return h + 'h';
  return h + 'h ' + mm + 'm';
}

export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// Short relative time for status lines ("just now", "2m ago", "3h ago", "Jun 8").
// 0/undefined → '' so callers can omit the label entirely.
export function fmtAgo(ts, nowMs) {
  if (!ts) return '';
  const now = nowMs || Date.now();
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = new Date(ts);
  return `${MONTH_NAMES[d.getMonth()].slice(0, 3)} ${d.getDate()}`;
}

const DAY_MS = 86400000;
const sameYMD = (a, b) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

// Human "when" for a session, derived live from its epoch-ms `ts` so the label
// stays honest across reloads (a session logged Monday reads "Yesterday" on
// Tuesday, "Jun 8" later) instead of freezing at "Just now".
export function fmtWhen(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  if (sameYMD(d, now)) return 'Today';
  const yest = new Date(now.getTime() - DAY_MS);
  if (sameYMD(d, yest)) return 'Yesterday';
  return `${MONTH_NAMES[d.getMonth()].slice(0, 3)} ${d.getDate()}`;
}

// Relaxation — an *intended* allowance of rest: `desired` is the share of the
// week set aside to relax guilt-free. Time logged within that allowance fills
// Relaxation; beyond it the allowance simply caps (rest is never a failure).
// `tracked` is false when the allowance is 0 (rest not reserved).
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

// Per-hobby starter lines for the optional log note (one tap to fill, fully
// editable). Keyed by identity id — canonical personas + the rest of the
// onboarding catalog. Unknown/runtime identities fall back to GENERIC.
export const NOTE_SUGGESTIONS = {
  writer: ['Morning pages', 'Drafted a new scene', 'Edited a chapter', 'Finished short story'],
  reader: ['Read 4 chapters', 'Started Jane Eyre', 'Trying a new genre'],
  engineer: ['Developed a new feature', 'Cracked a hard bug', 'Refactored a mess'],
  musician: ['Practiced scales', 'Learned a new piece', 'The bridge finally clicked'],
  painter: ['Color study', 'Sketched from life', 'Finished a piece'],
  artist: ['Color study', 'Sketched from life', 'Finished a piece'],
  journaler: ['Cleared my head', 'A page before bed'],
  poet: ['A new poem', 'Found the right line'],
  athlete: ['Ran a mile', 'Hit a new PR', 'Tough but worth it'],
  chef: ['Made a perfect crepe', 'Tried a new recipe', 'Nailed the sauce'],
  photographer: ['Golden hour walk', 'Caught a good frame'],
  gardener: ['Pruned and weeded', 'New seedlings in', 'Harvested tomatoes'],
  linguist: ['Reviewed vocab', 'Held a real conversation'],
  designer: ['Explored layouts', 'Found the right type'],
  filmmaker: ['Edited a cut', 'Storyboarded a scene'],
  dancer: ['Practiced the combo', 'Looser today'],
  naturalist: ['A long trail', 'Spotted something new'],
  relax: ['Rested well', 'Fully unwound', 'Watched a comfort show'],
};
export const GENERIC_NOTE_SUGGESTIONS = ['Showed up today', 'Made real progress', 'A good session'];
export function noteSuggestions(idn) {
  if (!idn) return GENERIC_NOTE_SUGGESTIONS;
  return NOTE_SUGGESTIONS[idn.id] || GENERIC_NOTE_SUGGESTIONS;
}

// Weekly free-hours model — the hours a typical week holds for the user. Single
// source of truth shared by onboarding's cadence slider and the weekly re-plan
// sheet, so the "% → real hours" math stays consistent across both.
export const FREE_HOURS_WEEK = { min: 5, max: 90, step: 1, def: 35 };

// catalog for onboarding
export const CATALOG = [
  'Writer', 'Reader', 'Engineer', 'Journaler', 'Musician', 'Painter',
  'Athlete', 'Chef', 'Photographer', 'Gardener', 'Linguist',
  'Designer', 'Filmmaker', 'Dancer', 'Naturalist', 'Poet',
];

// Seed activity — days-ago offsets per identity, so a fresh install opens with a
// believable, populated month rather than an empty tracker. Each offset becomes
// one session carrying a real `ts`; the Activity Tracker, IdentityDetail's month
// strip, and the "when" labels are all derived from these timestamps.
const SEED_ACTIVITY = {
  engineer: [0, 0, 1, 2, 3, 5, 6, 8, 9, 11, 13, 15, 17, 20, 23],
  writer: [0, 1, 3, 4, 7, 10, 14, 18, 22],
  reader: [0, 2, 5, 8, 12, 16, 21, 25],
  musician: [1, 6, 11, 16, 24],
  painter: [4, 13, 26],
};
const SEED_LABELS = { engineer: 'Coding', writer: 'Morning pages', reader: 'Reading', musician: 'Piano practice', painter: 'Watercolor' };
const SEED_MINS = { engineer: 75, writer: 25, reader: 30, musician: 30, painter: 60 };

// recent logged sessions (most recent first), built from SEED_ACTIVITY
export const SESSIONS = (() => {
  const now = Date.now();
  const out = [];
  Object.keys(SEED_ACTIVITY).forEach((id) => {
    SEED_ACTIVITY[id].forEach((daysAgo, k) => {
      // stagger same-day repeats a few hours apart so ordering is stable
      const ts = now - daysAgo * DAY_MS - k * 3 * 3600000;
      out.push({ id, sid: `seed_${id}_${daysAgo}_${k}`, label: SEED_LABELS[id], mins: SEED_MINS[id], ts, when: fmtWhen(ts) });
    });
  });
  return out.sort((a, b) => b.ts - a.ts);
})();

export const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

// ---- Weekly cadence: plan is now set per-week, not once forever ----
// ---- Rolling week model -------------------------------------------------
// The week is a real calendar window derived from `new Date()`, so it "resets"
// on its own every WEEK_STARTS_ON without any reset bookkeeping: anything that
// reads the current week (this week's `actual`, the whole-week celebration)
// simply stops seeing last week's sessions once the date crosses the boundary.
// 0 = Sunday (US convention), 1 = Monday.
export const WEEK_STARTS_ON = 0;

const fmtDay = (d) => `${MONTH_NAMES[d.getMonth()].slice(0, 3)} ${d.getDate()}`;

// epoch-ms of local midnight at the start of the week containing `refMs` (now).
export function weekStartMs(refMs) {
  const d = refMs ? new Date(refMs) : new Date();
  d.setHours(0, 0, 0, 0);
  const back = (d.getDay() - WEEK_STARTS_ON + 7) % 7;
  d.setDate(d.getDate() - back);
  return d.getTime();
}

// is a session timestamp inside the week containing `refMs`? Uses calendar
// arithmetic for the end bound so it stays correct across DST.
export function inWeek(ts, refMs) {
  if (!ts) return false;
  const start = new Date(weekStartMs(refMs));
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return ts >= start.getTime() && ts < end.getTime();
}

// "Jun 15 – Jun 21" label for the week containing `refMs`.
export function weekLabel(refMs) {
  const start = new Date(weekStartMs(refMs));
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return `${fmtDay(start)} – ${fmtDay(end)}`;
}

// 1-based day index within the current week (1 = the WEEK_STARTS_ON day).
export function weekDayIndex(refMs) {
  const d = refMs ? new Date(refMs) : new Date();
  return ((d.getDay() - WEEK_STARTS_ON + 7) % 7) + 1;
}

// ---- Activity derivations (a single source of truth: logged sessions) ----
// A session's contribution in the same %-ish "points" unit as `desired`. Kept
// identical to the prototype's bump so visuals/tuning are unchanged: ~12 min = 1.
export const SESSION_POINTS = (mins) => Math.max(1, Math.round((mins || 0) / 12));

// Points an identity has earned *this week* (uncapped — callers clamp: identities
// at 60, Relaxation at its allowance). This is what makes `actual` a real weekly
// window rather than an ever-accumulating counter.
export function weekPoints(sessions, id, refMs) {
  let sum = 0;
  (sessions || []).forEach((s) => {
    if (s && s.id === id && inWeek(s.ts, refMs)) sum += SESSION_POINTS(s.mins);
  });
  return sum;
}

// Whole days since this identity's most recent session (0 = today). `fallback`
// (default 99) when it has never been logged — the new-identity sentinel.
export function daysSinceLast(sessions, id, fallback = 99) {
  let latest = 0;
  (sessions || []).forEach((s) => {
    if (s && s.id === id && s.ts && s.ts > latest) latest = s.ts;
  });
  if (!latest) return fallback;
  const a = new Date(latest);
  a.setHours(0, 0, 0, 0);
  const b = new Date();
  b.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / DAY_MS));
}

// Consecutive calendar days (ending today, or yesterday if today isn't logged
// yet) on which this identity got at least one session.
export function dayStreak(sessions, id) {
  const days = new Set();
  (sessions || []).forEach((s) => {
    if (s && s.id === id && s.ts) {
      const d = new Date(s.ts);
      d.setHours(0, 0, 0, 0);
      days.add(d.getTime());
    }
  });
  if (!days.size) return 0;
  const cur = new Date();
  cur.setHours(0, 0, 0, 0);
  if (!days.has(cur.getTime())) {
    cur.setDate(cur.getDate() - 1);
    if (!days.has(cur.getTime())) return 0;
  }
  let n = 0;
  while (days.has(cur.getTime())) {
    n += 1;
    cur.setDate(cur.getDate() - 1);
  }
  return n;
}

// The intention in force for `idn` during the week starting `ws`: the most
// recently committed plan at or before that week (plans persist forward until
// re-planned). `planHistory` is { weekStartMs: { identityId: pct } }, recorded at
// each commit. Falls back to the current `desired` only for weeks earlier than
// any recorded plan (legacy data with no captured history).
export function planForWeek(planHistory, ws, idn) {
  let bestKey = -Infinity;
  if (planHistory) {
    Object.keys(planHistory).forEach((k) => {
      const n = Number(k);
      if (n <= ws && n > bestKey) bestKey = n;
    });
  }
  if (bestKey > -Infinity) {
    const entry = planHistory[bestKey];
    return entry && entry[idn.id] != null ? entry[idn.id] : 0; // in the plan, or not yet planned that week
  }
  return idn.desired;
}

// Recent COMPLETED weeks (before this one) in which `identity` actually logged at
// least one session — newest first, capped to `count`. Lived points come
// straight from the sessions; `plan` is the intention that was in force that week
// (from `planHistory`). Steps week-by-week and re-snaps each ref to its week
// start, so it stays correct across DST. Returns [] for a fresh identity.
export function recentWeeksFor(sessions, identity, planHistory, count = 4, lookback = 26) {
  const out = [];
  let ref = weekStartMs() - DAY_MS; // a moment inside last week
  for (let i = 0; i < lookback && out.length < count; i += 1) {
    const ws = weekStartMs(ref);
    const lived = weekPoints(sessions, identity.id, ws);
    if (lived > 0) out.push({ label: weekLabel(ws).split(' – ')[0], plan: planForWeek(planHistory, ws, identity), actual: lived });
    ref = ws - DAY_MS; // jump into the previous week
  }
  return out;
}

// epoch-ms of the start of the week immediately before the one containing now.
export function lastWeekStartMs() {
  return weekStartMs(weekStartMs() - 1); // 1ms before this week's start lands in last week
}

// Real weekly history, newest first — one entry per COMPLETED week (before this
// one) in which *any* active identity logged a session. Each entry matches the
// shape the weekly UI expects: { label, aligned, rows: [{ id, plan, actual }] }.
// `actual` is the lived points that week (from real sessions); `plan` is the
// intention that was in force that week (from `planHistory`). Empty weeks are
// skipped, so a fresh user gets [] and the UI falls back to its honest
// empty-states rather than fabricated history.
export function pastWeeks(sessions, identities, planHistory, count = 8, lookback = 30) {
  const list = identities || [];
  if (!list.length) return [];
  const out = [];
  let ref = weekStartMs() - DAY_MS; // a moment inside last week
  for (let i = 0; i < lookback && out.length < count; i += 1) {
    const ws = weekStartMs(ref);
    const rows = list.map((idn) => ({
      id: idn.id,
      plan: planForWeek(planHistory, ws, idn),
      actual: Math.min(60, weekPoints(sessions, idn.id, ws)),
    }));
    if (rows.some((r) => r.actual > 0)) {
      out.push({ label: weekLabel(ws), aligned: alignment(rows.map((r) => ({ desired: r.plan, actual: r.actual }))), rows });
    }
    ref = ws - DAY_MS; // jump into the previous week
  }
  return out;
}

// ---- Activity Tracker: which personas got tended on each day this month ----
// Derived live from logged sessions' real `ts`. Returns the month containing
// `refMs` (defaults to now): its name/year/length, today's day-of-month (0 when
// `refMs` isn't the current month), the set of weekend day-numbers, and a
// `done` map of identity-id → sorted array of day-numbers that hold a session.
export function monthActivity(sessions, refMs) {
  const ref = refMs ? new Date(refMs) : new Date();
  const year = ref.getFullYear();
  const mon = ref.getMonth();
  const days = new Date(year, mon + 1, 0).getDate();

  const now = new Date();
  const todayDay = now.getFullYear() === year && now.getMonth() === mon ? now.getDate() : 0;

  const weekend = new Set();
  for (let d = 1; d <= days; d += 1) {
    const wd = new Date(year, mon, d).getDay();
    if (wd === 0 || wd === 6) weekend.add(d);
  }

  const sets = {};
  (sessions || []).forEach((s) => {
    if (!s || !s.ts) return;
    const sd = new Date(s.ts);
    if (sd.getFullYear() !== year || sd.getMonth() !== mon) return;
    (sets[s.id] || (sets[s.id] = new Set())).add(sd.getDate());
  });
  const done = {};
  Object.keys(sets).forEach((id) => {
    done[id] = [...sets[id]].sort((a, b) => a - b);
  });

  return { name: MONTH_NAMES[mon], year, days, todayDay, weekend, done };
}

// 100 - half the total absolute gap between intended and lived, across identities
export function alignment(list) {
  let diff = 0;
  list.forEach((i) => {
    diff += Math.abs(i.desired - i.actual);
  });
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
