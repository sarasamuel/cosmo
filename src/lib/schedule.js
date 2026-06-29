/* Week scheduler — DETERMINISTIC, no AI. Given the user's committed plan (each
   identity's `desired %`) and a structured constraint object, it "arranges" /
   "lays out" concrete sessions across the week to help hit those percentages.
   It only reads numbers (intentions, logged-rhythm counts) — never free text —
   and the same inputs always produce the same plan, so the result is explainable.

   It is SUPPLEMENTAL: it never changes the intentions (the % sheet owns those);
   it just proposes when to do the work.

   constraints = {
     identities: string[],                          // ids to schedule
     fullness: 'light' | 'balanced' | 'ambitious',  // how much of the pool to place
     hoursPerWeek: number,                          // the time pool (defaults to free hours)
     windows: ('mornings'|'daytime'|'evenings'|'weekends')[],
     shape: 'short' | 'deep' | 'mix',
     protect: ('rest-day'|'calm-mornings'|'no-back-to-back'|'family-evenings')[],
   } */
import { MONTH_NAMES, weekStartMs, usualMins } from '../data/data';

const DAY_MS = 86400000;
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const TIME_WINDOWS = {
  mornings: { key: 'mornings', label: 'Morning', hour: 8 },
  daytime: { key: 'daytime', label: 'Daytime', hour: 13 },
  evenings: { key: 'evenings', label: 'Evening', hour: 19 },
};
const ORDER = ['mornings', 'daytime', 'evenings'];
const FULLNESS = { light: 0.7, balanced: 1.0, ambitious: 1.25 };
const SHAPE_MINS = { short: 30, deep: 75 };

// which clock hours belong to each window (late night 0–4 counts as evening).
const WINDOW_HOURS = {
  mornings: [5, 6, 7, 8, 9, 10],
  daytime: [11, 12, 13, 14, 15, 16],
  evenings: [17, 18, 19, 20, 21, 22, 23, 0, 1, 2, 3, 4],
};
const WIN_RANK = { mornings: 0, daytime: 1, evenings: 2 }; // for chronological sort, even with a personalized late hour

export function clockLabel(h) {
  const ap = h < 12 ? 'AM' : 'PM';
  let hr = h % 12;
  if (hr === 0) hr = 12;
  return `${hr}:00 ${ap}`;
}

// like clockLabel but with minutes ("7:30 AM"); used for hand-picked session times
export function clockLabelHM(h, m = 0) {
  const ap = h < 12 ? 'AM' : 'PM';
  let hr = h % 12;
  if (hr === 0) hr = 12;
  return `${hr}:${String(m).padStart(2, '0')} ${ap}`;
}

// which window a clock hour belongs to (so a hand-picked time keeps a window for
// sorting + protect logic). Mirrors WINDOW_HOURS; anything unlisted is evening.
function hourToWindow(h) {
  if (WINDOW_HOURS.mornings.includes(h)) return 'mornings';
  if (WINDOW_HOURS.daytime.includes(h)) return 'daytime';
  return 'evenings';
}

// minutes-into-the-day for a session, for chronological sorting (min may be absent)
const atMinute = (s) => s.hour * 60 + (s.min || 0);

// per-day-of-week counts of this identity's past sessions (the logged rhythm)
function dowCounts(sessions, id) {
  const c = [0, 0, 0, 0, 0, 0, 0];
  (sessions || []).forEach((s) => {
    if (s && s.id === id && s.ts) c[new Date(s.ts).getDay()] += 1;
  });
  return c;
}

// per-clock-hour counts of this identity's past sessions (the time-of-day rhythm)
function hourCounts(sessions, id) {
  const h = new Array(24).fill(0);
  (sessions || []).forEach((s) => {
    if (s && s.id === id && s.ts) h[new Date(s.ts).getHours()] += 1;
  });
  return h;
}

// From an hour histogram, the identity's TIME-OF-DAY profile: per window, the
// share of its sessions that fall in that window (0..1), and a personalized hour
// — the modal (most common) hour it's actually logged within that window. With
// no evidence, hour falls back to the window's canonical time and share is null.
// Deterministic: ties on the modal hour resolve to the earlier hour in the window.
function timeProfile(hist) {
  const total = hist.reduce((a, b) => a + b, 0);
  const share = {};
  const hour = {};
  ORDER.forEach((wk) => {
    let sum = 0;
    let bestH = TIME_WINDOWS[wk].hour;
    let bestC = 0;
    WINDOW_HOURS[wk].forEach((h) => {
      sum += hist[h];
      if (hist[h] > bestC) { bestC = hist[h]; bestH = h; }
    });
    share[wk] = total ? sum / total : null;
    hour[wk] = bestH; // canonical when bestC stayed 0 (no sessions in this window)
  });
  return { total, share, hour };
}

/* The engine. Returns PLAN: 7 day rows
   [{ day, date, dowIndex, rest, sessions: [{ identityId, label, window, hour, time, mins }] }].
   No "today" — renderers derive it live (the plan is persisted, so a stored flag would go stale). */
export function scheduleWeek(constraints, ctx = {}) {
  const c = constraints || {};
  const all = ctx.identities || [];
  const sessions = ctx.sessions || [];
  const weekStart = ctx.weekStart || weekStartMs(ctx.now);
  const now = ctx.now || Date.now();
  // per-identity preferred clock time (minutes from midnight). A SOFT nudge:
  // it biases which window a session lands in, never overrides a protect rule.
  const prefs = ctx.prefs || {};

  // 1. which identities (default: those chosen, else all with an intention)
  const chosenIds = (c.identities && c.identities.length) ? c.identities : all.filter((i) => i.desired > 0).map((i) => i.id);
  const targets = chosenIds.map((id) => all.find((i) => i.id === id)).filter(Boolean);

  // build the empty week first so we always return 7 days. We deliberately DON'T
  // stamp a "today" flag — the plan is persisted, so a frozen flag would go stale
  // as days pass. Renderers derive "today" live from the system clock via dowIndex.
  const days = Array.from({ length: 7 }, (_, k) => {
    const d = new Date(weekStart + k * DAY_MS);
    return {
      day: DOW[d.getDay()],
      dowIndex: d.getDay(),
      date: `${MONTH_NAMES[d.getMonth()].slice(0, 3)} ${d.getDate()}`,
      rest: false,
      sessions: [],
    };
  });
  if (!targets.length) return days;

  // 2. per-identity minute budget, weighted by desired %, scaled by fullness
  const protect = new Set(c.protect || []);
  const pool = (c.hoursPerWeek || ctx.freeHours || 35) * 60 * (FULLNESS[c.fullness] || 1);
  const sumDesired = targets.reduce((s, i) => s + Math.max(1, i.desired), 0);
  const perId = {};
  targets.forEach((i) => { perId[i.id] = Math.round((pool * Math.max(1, i.desired)) / sumDesired); });

  // 3. session size from shape → a flat, round-robin-ordered list of sessions to place
  const queues = targets.map((idn) => {
    const size = c.shape === 'mix' ? usualMins(idn) : (SHAPE_MINS[c.shape] || 45);
    const count = Math.max(1, Math.round(perId[idn.id] / size));
    // the scheduled session is labeled by its identity (notes/labels in this app
    // are reflective lines, not activity names — they'd read oddly as titles).
    const dow = dowCounts(sessions, idn.id); // NB: idn.id (the count keys on session.id)
    const dowTotal = dow.reduce((a, b) => a + b, 0);
    // preferred time → (hour, minute, window) for the soft nudge below
    const prefMin = typeof prefs[idn.id] === 'number' ? prefs[idn.id] : null;
    const prefHour = prefMin != null ? Math.floor(prefMin / 60) : null;
    const prefWin = prefMin != null ? hourToWindow(prefHour) : null;
    return { idn, size, count, label: idn.name, dow, dowTotal, tp: timeProfile(hourCounts(sessions, idn.id)), prefMin, prefHour, prefWin };
  });
  const toPlace = [];
  let remaining = queues.reduce((s, q) => s + q.count, 0);
  let r = 0;
  while (remaining > 0) {
    const q = queues[r % queues.length];
    if (q.count > 0) { toPlace.push(q); q.count -= 1; remaining -= 1; }
    r += 1;
    if (r > 5000) break; // safety
  }

  // 4. eligible (day, window) slots, after protect filters
  let timeKeys = ORDER.filter((k) => (c.windows || []).includes(k));
  if (protect.has('calm-mornings')) timeKeys = timeKeys.filter((k) => k !== 'mornings');
  if (protect.has('family-evenings')) timeKeys = timeKeys.filter((k) => k !== 'evenings');
  if (!timeKeys.length) timeKeys = ['daytime']; // a window is always required by the flow; fall back safely

  const weekendsOk = (c.windows || []).includes('weekends');
  let eligibleDays = days
    .map((d, idx) => ({ d, idx }))
    .filter(({ d }) => weekendsOk || (d.dowIndex !== 0 && d.dowIndex !== 6));
  if (!eligibleDays.length) eligibleDays = days.map((d, idx) => ({ d, idx })); // never schedule into nothing

  // a protected rest day: the eligible day with the least logged rhythm (ties → latest)
  if (protect.has('rest-day') && eligibleDays.length > 1) {
    const dayLoad = (di) => queues.reduce((s, q) => s + q.dow[days[di].dowIndex], 0);
    let restIdx = eligibleDays[0].idx; let restLoad = Infinity;
    eligibleDays.forEach(({ idx }) => { const l = dayLoad(idx); if (l <= restLoad) { restLoad = l; restIdx = idx; } });
    days[restIdx].rest = true;
    eligibleDays = eligibleDays.filter(({ idx }) => idx !== restIdx);
  }

  // 5. place greedily: for each session pick the open slot that best matches the
  //    identity's logged rhythm — BOTH which weekday and which time of day it
  //    usually does this, spreading across days (one per day before doubling).
  const W_DOW = 10; // weight on the day-of-week habit (share of its sessions on this weekday)
  const W_WIN = 8; //  weight on the time-of-day habit (share of its sessions in this window)
  const W_SPREAD = 6; // penalty per session already on a day, to spread the week out
  const W_PREF = 100; // a preferred time outweighs habit — but only across OPEN slots, so a
  //                     taken slot or a protected window (never in timeKeys) still wins.
  const taken = new Set(); // `${dayIdx}|${windowKey}`
  const perDayCount = days.map(() => 0);
  // a protected window can never host a session (binds even a preferred time)
  const winProtected = (win) => (win === 'mornings' && protect.has('calm-mornings')) || (win === 'evenings' && protect.has('family-evenings'));
  toPlace.forEach((q) => {
    let best = null; let bestScore = -Infinity;
    // A pinned time makes its window eligible for THIS identity even if the user
    // didn't choose it as an open window — preferences bias, only protect binds.
    const qWins = q.prefWin && !timeKeys.includes(q.prefWin) && !winProtected(q.prefWin) ? [...timeKeys, q.prefWin] : timeKeys;
    // normalized to shares (0..1) so day and time signals are comparable; both are
    // 0 with no history, so a cold start falls back to pure spread + earliest slot.
    const dowShare = (di) => (q.dowTotal ? q.dow[days[di].dowIndex] / q.dowTotal : 0);
    eligibleDays.forEach(({ idx }) => {
      qWins.forEach((wk, wi) => {
        const slot = `${idx}|${wk}`;
        if (taken.has(slot)) return;
        // prefer the identity's historical weekday AND its usual time of day, then
        // emptier days, then earlier in the week / earlier window — all deterministic.
        // A preferred time adds a strong bias toward its window (only reachable when
        // that window is allowed, since timeKeys already excludes protected ones).
        const winShare = q.tp.share[wk] || 0;
        const prefBonus = q.prefWin && wk === q.prefWin ? W_PREF : 0;
        const score = dowShare(idx) * W_DOW + winShare * W_WIN + prefBonus - perDayCount[idx] * W_SPREAD - idx * 0.5 - wi * 0.3;
        if (score > bestScore) { bestScore = score; best = { idx, wk }; }
      });
    });
    if (!best) return; // out of slots → drop (we log this cap to the caller via summary)
    taken.add(`${best.idx}|${best.wk}`);
    perDayCount[best.idx] += 1;
    // honored = the session actually landed in its preferred window → sit it at the
    // exact preferred time and tag it pinned. Otherwise (pref window full/protected)
    // fall back to the identity's personalized hour — placed, not dropped, not pinned.
    const honored = q.prefMin != null && best.wk === q.prefWin;
    const hour = honored ? q.prefHour : q.tp.hour[best.wk];
    const min = honored ? q.prefMin % 60 : 0;
    const sess = { identityId: q.idn.id, label: q.label, window: best.wk, hour, min, time: honored ? clockLabelHM(hour, min) : clockLabel(hour), mins: q.size };
    if (honored) sess.pinned = true;
    days[best.idx].sessions.push(sess);
  });

  // chronological within a day: by window first (so a personalized late-night
  // "evening" hour still sorts after the morning), then by the hour itself.
  days.forEach((d) => d.sessions.sort((a, b) => (WIN_RANK[a.window] - WIN_RANK[b.window]) || (atMinute(a) - atMinute(b))));
  return days;
}

/* Apply a day + exact-time edit in ONE step (the "Enter" commit of the retiming
   panel): move the session to `toDay` if it changed and set its hand-picked time,
   keeping that time across the move (unlike moveSessionToDay, which re-windows).
   Window is derived from the hour for protect + ordering; a protected window or a
   rest destination is refused (returns the same plan). */
export function placeSession(plan, fromDay, sessIdx, toDay, hour, minute, constraints) {
  const protect = new Set((constraints && constraints.protect) || []);
  const windowKey = hourToWindow(hour);
  if (windowKey === 'mornings' && protect.has('calm-mornings')) return plan;
  if (windowKey === 'evenings' && protect.has('family-evenings')) return plan;
  const next = plan.map((d) => ({ ...d, sessions: d.sessions.map((s) => ({ ...s })) }));
  const src = next[fromDay];
  const me = src && src.sessions[sessIdx];
  const dst = next[toDay];
  if (!me || !dst || dst.rest) return plan;
  const m = Math.max(0, Math.min(59, minute || 0));
  const updated = { ...me, window: windowKey, hour, min: m, time: clockLabelHM(hour, m) };
  if (toDay !== fromDay) {
    src.sessions.splice(sessIdx, 1);
    dst.sessions.push(updated);
  } else {
    dst.sessions[sessIdx] = updated;
  }
  dst.sessions.sort((a, b) => (WIN_RANK[a.window] - WIN_RANK[b.window]) || (atMinute(a) - atMinute(b)));
  return next;
}

/* A blank, well-formed 7-day week (same shape scheduleWeek returns) — the
   starting point for the manual "build it myself" builder. */
export function blankWeek(weekStart) {
  const ws = weekStart || weekStartMs();
  return Array.from({ length: 7 }, (_, k) => {
    const d = new Date(ws + k * DAY_MS);
    return {
      day: DOW[d.getDay()],
      dowIndex: d.getDay(),
      date: `${MONTH_NAMES[d.getMonth()].slice(0, 3)} ${d.getDate()}`,
      rest: false,
      sessions: [],
    };
  });
}

/* Build one session in the canonical shape from an identity, a clock time
   (minutes from midnight) and a length — for the manual builder, so window/label/
   time formatting stays in one place. */
export function makeSession(identity, minutesOfDay, mins) {
  const hour = Math.floor(minutesOfDay / 60);
  const min = minutesOfDay % 60;
  return { identityId: identity.id, label: identity.name, window: hourToWindow(hour), hour, min, time: clockLabelHM(hour, min), mins };
}

/* Chronological day sort shared by builders/editors (window first, then clock). */
export function sortDay(sessions) {
  return [...sessions].sort((a, b) => (WIN_RANK[a.window] - WIN_RANK[b.window]) || (atMinute(a) - atMinute(b)));
}

/* Drop a session from the week entirely. Returns a new plan. */
export function removeSession(plan, dayIdx, sessIdx) {
  return (plan || []).map((d, i) => (i === dayIdx ? { ...d, sessions: d.sessions.filter((_, k) => k !== sessIdx) } : d));
}

/* Computed summary of a plan — every number, no interpretation. */
export function scheduleSummary(plan) {
  const flat = (plan || []).flatMap((d) => d.sessions);
  const totalMins = flat.reduce((s, x) => s + x.mins, 0);
  const restDay = (plan || []).find((d) => d.rest);
  const perIdentity = {};
  flat.forEach((s) => { perIdentity[s.identityId] = (perIdentity[s.identityId] || 0) + s.mins; });
  const activeDays = (plan || []).filter((d) => d.sessions.length > 0).length;
  return { sessionCount: flat.length, totalMins, restDay: restDay ? restDay.day : null, perIdentity, activeDays };
}
