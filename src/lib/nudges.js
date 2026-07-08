/* Drill Sergeant nudge builders — pure functions that turn app state into
   notification payloads ([{ date, title, body, identityId }]). All scheduling
   side effects live in lib/notifications; all policy (who gets nudged, when,
   with what words) lives here so it can be unit-tested.

   Local notifications must be scheduled AHEAD of time (there is no server), so
   "notify when an identity goes quiet" means: compute each identity's crossing
   date (last session + threshold) now, schedule a one-shot for it, and re-arm
   whenever a log or an app open changes the picture. */

const DAY_MS = 86400000;
export const NEGLECT_DAYS = 3; // days untended before the drill sergeant speaks up
const FALLBACK_HOUR = 10; // civilized default when an identity has no preferred time

/* Clock label for copy ("It's usually your noon thing"), 24h hour in, "12 PM" out. */
const hourLabel = (h) => {
  const ap = h < 12 ? 'AM' : 'PM';
  let hr = h % 12;
  if (hr === 0) hr = 12;
  return `${hr} ${ap}`;
};

/* Neglect nudges — one per eligible identity, at its crossing date.
   Eligible: active (not retired — callers pass only active), has an intention
   this week (desired > 0; resting identities were promised "no pressure"), and
   has been logged at least once EVER (the lastActiveDays: 99 seed must never
   greet a brand-new identity with a scolding). Relaxation is excluded: rest is
   an allowance, not an obligation.

   The nudge fires at `lastSession + NEGLECT_DAYS`, at the identity's preferred
   hour when one is set (a nudge at "your usual time" lands better), else 10am.
   Already past the crossing → tomorrow at that hour (never instantly on open,
   never into the past). Capped to the `cap` most-neglected identities so a
   large cosmos can't flood the notification budget. */
export function buildNeglectItems(identities, sessions, now = Date.now(), cap = 5) {
  const lastTs = {};
  (sessions || []).forEach((s) => {
    if (s && s.id && s.ts && (!lastTs[s.id] || s.ts > lastTs[s.id])) lastTs[s.id] = s.ts;
  });

  const items = (identities || [])
    .filter((i) => !i.isRelax && i.id !== 'relax' && i.desired > 0 && lastTs[i.id])
    .map((i) => {
      const hour = typeof i.prefTime === 'number' ? Math.floor(i.prefTime / 60) : FALLBACK_HOUR;
      const crossing = new Date(lastTs[i.id] + NEGLECT_DAYS * DAY_MS);
      crossing.setHours(hour, typeof i.prefTime === 'number' ? i.prefTime % 60 : 0, 0, 0);
      let when = crossing.getTime();
      if (when <= now) {
        const tomorrow = new Date(now + DAY_MS);
        tomorrow.setHours(hour, 0, 0, 0);
        when = tomorrow.getTime();
      }
      const daysAt = Math.max(NEGLECT_DAYS, Math.round((when - lastTs[i.id]) / DAY_MS));
      const usual = typeof i.prefTime === 'number' ? ` It's ${hourLabel(hour)}, usually your ${i.name} time.` : '';
      return {
        date: new Date(when),
        identityId: i.id,
        sortTs: lastTs[i.id],
        title: `${i.name}: ${daysAt} days untended.`,
        body: `It doesn't tend itself.${usual} Even fifteen minutes counts.`,
      };
    })
    // most-neglected first, then cap — the loudest cases win the budget
    .sort((a, b) => a.sortTs - b.sortTs)
    .slice(0, cap)
    .map(({ sortTs, ...item }) => item);

  return items;
}

/* Session reminders for the arranged week, style-aware. Gentle: one item 30
   minutes before each session (the original behavior, original copy). Drill:
   that item with firmer copy PLUS a second one at session start. Same shape
   the store's scheduler already consumes. */
export function buildSessionItems(plan, weekStart, identities, style = 'gentle') {
  const nameOf = (id) => { const i = (identities || []).find((x) => x.id === id); return i ? i.name : 'your identity'; };
  const items = [];
  (plan || []).forEach((d, k) => {
    (d.sessions || []).forEach((s) => {
      const at = new Date(weekStart);
      at.setDate(at.getDate() + k);
      at.setHours(s.hour, s.min || 0, 0, 0);
      const before = new Date(at.getTime() - 30 * 60000);
      const name = nameOf(s.identityId);
      if (style === 'drill') {
        items.push({ date: before, identityId: s.identityId, title: `${name} in 30 minutes.`, body: 'You planned this. Be there.' });
        items.push({ date: at, identityId: s.identityId, title: `${name}: now.`, body: `Session's starting. ${s.mins} minutes, go.` });
      } else {
        items.push({ date: before, identityId: s.identityId, title: `${name} in 30 minutes`, body: `Time to tend to ${name}. Your ${s.mins}m session is coming up.` });
      }
    });
  });
  return items;
}
