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
    return { idn, size, count, label: idn.name, dow, dowTotal, tp: timeProfile(hourCounts(sessions, idn.id)) };
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
  const taken = new Set(); // `${dayIdx}|${windowKey}`
  const perDayCount = days.map(() => 0);
  toPlace.forEach((q) => {
    let best = null; let bestScore = -Infinity;
    // normalized to shares (0..1) so day and time signals are comparable; both are
    // 0 with no history, so a cold start falls back to pure spread + earliest slot.
    const dowShare = (di) => (q.dowTotal ? q.dow[days[di].dowIndex] / q.dowTotal : 0);
    eligibleDays.forEach(({ idx }) => {
      timeKeys.forEach((wk, wi) => {
        const slot = `${idx}|${wk}`;
        if (taken.has(slot)) return;
        // prefer the identity's historical weekday AND its usual time of day, then
        // emptier days, then earlier in the week / earlier window — all deterministic.
        const winShare = q.tp.share[wk] || 0;
        const score = dowShare(idx) * W_DOW + winShare * W_WIN - perDayCount[idx] * W_SPREAD - idx * 0.5 - wi * 0.3;
        if (score > bestScore) { bestScore = score; best = { idx, wk }; }
      });
    });
    if (!best) return; // out of slots → drop (we log this cap to the caller via summary)
    taken.add(`${best.idx}|${best.wk}`);
    perDayCount[best.idx] += 1;
    // use the identity's personalized hour for this window (its modal logged hour),
    // falling back to the window's canonical time when there's no history.
    const hour = q.tp.hour[best.wk];
    days[best.idx].sessions.push({ identityId: q.idn.id, label: q.label, window: best.wk, hour, time: clockLabel(hour), mins: q.size });
  });

  // chronological within a day: by window first (so a personalized late-night
  // "evening" hour still sorts after the morning), then by the hour itself.
  days.forEach((d) => d.sessions.sort((a, b) => (WIN_RANK[a.window] - WIN_RANK[b.window]) || (a.hour - b.hour)));
  return days;
}

/* Move ONE session to a different time window, deterministically, honoring the
   same protect constraints. Returns a new plan (or the same one if it can't). */
export function retimeSession(plan, dayIdx, sessIdx, windowKey, constraints) {
  const protect = new Set((constraints && constraints.protect) || []);
  if (windowKey === 'mornings' && protect.has('calm-mornings')) return plan;
  if (windowKey === 'evenings' && protect.has('family-evenings')) return plan;
  const win = TIME_WINDOWS[windowKey];
  if (!win) return plan;
  const next = plan.map((d) => ({ ...d, sessions: d.sessions.map((s) => ({ ...s })) }));
  const day = next[dayIdx];
  if (!day || !day.sessions[sessIdx]) return plan;
  // don't stack two sessions in the same window on the same day
  if (day.sessions.some((s, i) => i !== sessIdx && s.window === windowKey)) return plan;
  day.sessions[sessIdx] = { ...day.sessions[sessIdx], window: windowKey, hour: win.hour, time: clockLabel(win.hour) };
  day.sessions.sort((a, b) => a.hour - b.hour);
  return next;
}

const windowAllowed = (key, protect) => {
  if (key === 'mornings' && protect.has('calm-mornings')) return false;
  if (key === 'evenings' && protect.has('family-evenings')) return false;
  return true;
};

/* Move ONE session to a different DAY (the tap-to-move equivalent of dragging).
   Picks a sensible window on the destination — keeps the current time if it's
   allowed and free, else the first allowed/free window — honoring protect and
   never landing on a rest day. Returns a new plan (or the same if it can't). */
export function moveSessionToDay(plan, fromDay, sessIdx, toDay, constraints) {
  if (fromDay === toDay) return plan;
  const protect = new Set((constraints && constraints.protect) || []);
  const next = plan.map((d) => ({ ...d, sessions: d.sessions.map((s) => ({ ...s })) }));
  const src = next[fromDay];
  const dst = next[toDay];
  if (!src || !dst || dst.rest || !src.sessions[sessIdx]) return plan;
  const sess = src.sessions[sessIdx];
  const taken = new Set(dst.sessions.map((s) => s.window));
  let win = sess.window;
  if (!windowAllowed(win, protect) || taken.has(win)) {
    win = ORDER.find((w) => windowAllowed(w, protect) && !taken.has(w))
      || (windowAllowed(sess.window, protect) ? sess.window : ORDER.find((w) => windowAllowed(w, protect)));
  }
  if (!win) return plan;
  const w = TIME_WINDOWS[win];
  src.sessions.splice(sessIdx, 1);
  dst.sessions.push({ ...sess, window: win, hour: w.hour, time: clockLabel(w.hour) });
  dst.sessions.sort((a, b) => a.hour - b.hour);
  return next;
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
