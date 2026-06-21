/* Journal — deterministic curation. Cosmo COUNTS and CURATES; it never reads or
   interprets the meaning of a note. Two layers:
   - user entries (notes / milestones) — authored, persisted (in the store)
   - auto-milestones — DERIVED from sessions/intentions on the fly (never stored,
     so they can't go stale), each keyed so it fires once.
   `resurface` juxtaposes a user's own verbatim entries with the time span +
   session count between them — framing is fixed templates, never generated. */
import { fmtWhen, weekStartMs, weekPoints } from '../data/data';

const DAY = 86400000;
const HOUR_THRESHOLDS = [10, 25, 50, 100];
const STREAK_THRESHOLDS = [7, 30, 100];
const ANNIVERSARIES = [30, 100, 365];

// real-identity sessions (exclude Relaxation), ascending by time
function ascSessions(sessions) {
  return (sessions || [])
    .filter((s) => s && s.id !== 'relax' && s.ts)
    .slice()
    .sort((a, b) => a.ts - b.ts);
}

/* Auto-milestones derived from existing data. Returns newest-first
   [{ key, identityId?, ts, date, title, sub, gold?, first? }]. Each `key` is
   stable so a milestone is emitted once. Pure: same inputs → same output. */
export function autoMilestones(identities, sessions, opts = {}) {
  const now = opts.now || Date.now();
  const list = identities || [];
  const byId = Object.fromEntries(list.map((i) => [i.id, i]));
  const asc = ascSessions(sessions);
  const out = [];
  if (!asc.length) return out;

  const first = asc[0];
  const firstName = (byId[first.id] && byId[first.id].name) || first.label || 'A session';
  out.push({
    key: 'first-session', identityId: first.id, ts: first.ts, date: fmtWhen(first.ts), first: true,
    title: 'First session logged', sub: `${first.label || firstName} · ${first.mins}m — where it began`,
  });

  // per-identity firsts + cumulative-hour thresholds (single ascending pass)
  const seenId = new Set();
  const cumMins = {};
  const hoursHit = {};
  for (const s of asc) {
    const idn = byId[s.id];
    if (!idn) continue; // retired/unknown — skip (can't resolve a clean name)
    if (!seenId.has(s.id)) {
      seenId.add(s.id);
      if (s !== first) {
        out.push({
          key: `first-${s.id}`, identityId: s.id, ts: s.ts, date: fmtWhen(s.ts),
          title: `First time tending ${idn.name}`, sub: 'Every becoming has a beginning.',
        });
      }
    }
    cumMins[s.id] = (cumMins[s.id] || 0) + (s.mins || 0);
    const hrs = cumMins[s.id] / 60;
    HOUR_THRESHOLDS.forEach((th) => {
      if (hrs >= th && !(hoursHit[s.id] && hoursHit[s.id].has(th))) {
        (hoursHit[s.id] || (hoursHit[s.id] = new Set())).add(th);
        out.push({
          key: `hours-${s.id}-${th}`, identityId: s.id, ts: s.ts, date: fmtWhen(s.ts),
          title: `${th} hours of ${idn.name}`, sub: th >= 50 ? 'A deep, sustained devotion.' : 'The hours are adding up.',
        });
      }
    });
  }

  // streaks — consecutive calendar days per identity
  list.forEach((idn) => {
    const days = [...new Set(asc.filter((s) => s.id === idn.id).map((s) => {
      const d = new Date(s.ts); d.setHours(0, 0, 0, 0); return d.getTime();
    }))].sort((a, b) => a - b);
    if (!days.length) return;
    let run = 1;
    const hit = new Set();
    for (let i = 0; i < days.length; i += 1) {
      if (i > 0) run = days[i] - days[i - 1] === DAY ? run + 1 : 1;
      STREAK_THRESHOLDS.forEach((th) => {
        if (run >= th && !hit.has(th)) {
          hit.add(th);
          const ts = days[i] + 12 * 3600000;
          out.push({
            key: `streak-${idn.id}-${th}`, identityId: idn.id, ts, date: fmtWhen(ts),
            title: `${th} days with ${idn.name}`, sub: th >= 30 ? 'A month of showing up.' : 'A full week, every day.',
          });
        }
      });
    }
  });

  // intention met this week (per identity, and the whole-week gold)
  const ws = weekStartMs(now);
  const tracked = list.filter((i) => i.desired > 0);
  tracked.forEach((idn) => {
    const lived = Math.min(60, weekPoints(sessions, idn.id, ws));
    if (lived >= idn.desired) {
      out.push({
        key: `intention-${ws}-${idn.id}`, identityId: idn.id, ts: now, date: 'This week',
        title: `${idn.name} reached its intention`, sub: `${idn.desired}% intended, ${lived}% lived this week.`,
      });
    }
  });
  if (tracked.length > 1 && tracked.every((idn) => Math.min(60, weekPoints(sessions, idn.id, ws)) >= idn.desired)) {
    out.push({ key: `allmet-${ws}`, gold: true, ts: now + 1, date: 'This week', title: 'Every intention, met', sub: 'A whole week in balance.' });
  }

  // anniversaries since joining (falls back to the earliest session)
  const joinedAt = opts.joinedAt || asc[0].ts;
  ANNIVERSARIES.forEach((d) => {
    const at = joinedAt + d * DAY;
    if (now >= at) {
      out.push({
        key: `anniv-${d}`, gold: d >= 365, ts: at, date: fmtWhen(at),
        title: d >= 365 ? 'One year with Cosmo' : `${d} days with Cosmo`, sub: 'Still becoming.',
      });
    }
  });

  const seen = new Set();
  return out
    .filter((m) => (seen.has(m.key) ? false : (seen.add(m.key), true)))
    .sort((a, b) => b.ts - a.ts);
}

/* The merged feed, newest-first: user entries + auto-milestones + Cosmo's weekly
   note + any occasional rebalancing observations. Each row carries a `kind`:
   'note' | 'milestone' | 'auto' | 'cosmo'. `insights` are surfaced as gentle
   "Cosmo" rows WITHOUT a call-to-action (the actionable nudge lives on Home), so
   a light-engagement feed (few or no written notes) still carries something. */
export function buildFeed({ entries, autoMs, coachNote, insights, now }) {
  const t = now || Date.now();
  const user = (entries || []).map((e) => ({ ...e, kind: e.type === 'milestone' ? 'milestone' : 'note' }));
  const auto = (autoMs || []).map((m) => ({ ...m, kind: 'auto' }));
  const cosmo = [];
  if (coachNote) cosmo.push({ kind: 'cosmo', ts: t - 100, text: coachNote });
  (insights || []).forEach((ins, i) => {
    cosmo.push({ kind: 'cosmo', identityId: ins.id, ts: t - 200 - i, text: ins.body ? `${ins.title}. ${ins.body}` : ins.title });
  });
  return [...user, ...auto, ...cosmo].sort((a, b) => (b.ts || 0) - (a.ts || 0));
}

/* A "look back": pair an identity's milestone with its EARLIEST earlier note,
   plus the real span (weeks) and session count between. Returns the most recent
   such pair, or null. No interpretation — the caller quotes both verbatim. */
export function resurface(entries, sessions) {
  const list = (entries || []).filter((e) => e && e.identityId && e.ts).slice().sort((a, b) => a.ts - b.ts);
  const byId = {};
  list.forEach((e) => { (byId[e.identityId] || (byId[e.identityId] = [])).push(e); });
  let best = null;
  Object.keys(byId).forEach((id) => {
    const arr = byId[id];
    const milestone = [...arr].reverse().find((e) => e.type === 'milestone');
    if (!milestone) return;
    const earlierNote = arr.find((e) => e.type === 'note' && e.ts < milestone.ts);
    if (!earlierNote) return;
    const spanWeeks = Math.max(1, Math.round((milestone.ts - earlierNote.ts) / (7 * DAY)));
    const sessionCount = (sessions || []).filter((s) => s && s.id === id && s.ts >= earlierNote.ts && s.ts <= milestone.ts).length;
    if (!best || milestone.ts > best.now.ts) best = { identityId: id, then: earlierNote, now: milestone, spanWeeks, sessionCount };
  });
  return best;
}

/* Which of the three Journal states to show, from content alone. */
export function journalState(entries, autoMs) {
  const hasNotes = (entries || []).length > 0;
  const hasAuto = (autoMs || []).length > 0;
  if (!hasNotes && !hasAuto) return 'cold';
  if (!hasNotes) return 'seeded';
  return 'full';
}
