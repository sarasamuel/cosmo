/* Export an arranged week to the device calendar (Apple Calendar on iOS, the
   chosen Google/local calendar on Android) via expo-calendar. Every call is
   guarded — a missing native module (e.g. a build without expo-calendar, or Expo
   Go) or a permission denial degrades to a returned {ok:false}, never a crash.
   One-off dated events for the given week (the plan is re-chosen weekly, so no
   recurrence rule).

   Idempotent: the ids of the events we create for a week are remembered, so
   pressing "Add to calendar" again (or after editing the plan) removes what we
   added last time and re-adds the current plan — never duplicates. */
import { Platform } from 'react-native';
import * as Calendar from 'expo-calendar';
import * as storage from './storage';

const DAY_MS = 86400000;
const KEY = 'cosmo-cal-events'; // { weekStart, ids: string[] } — what we last wrote

function warn(op, err) {
  // eslint-disable-next-line no-console
  console.warn(`[calendar] ${op} failed:`, err && err.message ? err.message : err);
}

async function loadRecord() {
  try { const raw = await storage.getItem(KEY); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
}
async function saveRecord(rec) {
  try { await storage.setItem(KEY, JSON.stringify(rec)); } catch (e) { warn('save-record', e); }
}

// Ask for write access, requesting once if not yet decided.
export async function ensureCalendarPermission() {
  try {
    const cur = await Calendar.getCalendarPermissionsAsync();
    if (cur.granted) return true;
    if (!cur.canAskAgain) return false; // previously denied → must enable in Settings
    const req = await Calendar.requestCalendarPermissionsAsync();
    return !!req.granted;
  } catch (e) {
    warn('permission', e);
    return false;
  }
}

// A writable calendar to drop events into: the system default on iOS, else the
// first owner-modifiable calendar on Android.
async function targetCalendarId() {
  try {
    if (Platform.OS === 'ios') {
      const def = await Calendar.getDefaultCalendarAsync();
      if (def && def.id) return def.id;
    }
    const cals = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    const owned = cals.find((c) => c.allowsModifications && c.accessLevel === Calendar.CalendarAccessLevel.OWNER);
    const writable = owned || cals.find((c) => c.allowsModifications);
    return writable ? writable.id : null;
  } catch (e) {
    warn('target-calendar', e);
    return null;
  }
}

// plan: scheduleWeek() output; weekStart: ms at local midnight of the week's first
// day. Returns { ok, count, replaced, error } — count = events written this time,
// replaced = stale events removed from a previous export of the same week.
export async function exportPlanToCalendar(plan, weekStart) {
  if (!await ensureCalendarPermission()) return { ok: false, error: 'permission' };
  const calId = await targetCalendarId();
  if (!calId) return { ok: false, error: 'no-calendar' };

  // remove what we added for THIS week before → re-export never duplicates
  const prior = await loadRecord();
  let replaced = 0;
  if (prior && prior.weekStart === weekStart && Array.isArray(prior.ids)) {
    for (const id of prior.ids) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await Calendar.deleteEventAsync(id);
        replaced += 1;
      } catch (e) { /* user may have already deleted it — fine */ }
    }
  }

  // one dated event per session (rest days contribute nothing)
  const events = [];
  (plan || []).forEach((d, dayIdx) => {
    if (d.rest) return;
    (d.sessions || []).forEach((s) => {
      const start = new Date(weekStart + dayIdx * DAY_MS);
      start.setHours(s.hour || 0, s.min || 0, 0, 0);
      const end = new Date(start.getTime() + (s.mins || 30) * 60000);
      events.push({
        title: s.label || 'Cosmo session',
        startDate: start,
        endDate: end,
        notes: `A Cosmo session · ${s.mins || 30} minutes`,
        alarms: [{ relativeOffset: -30 }], // a 30-min heads-up, mirroring the in-app reminder
      });
    });
  });
  if (!events.length) {
    await saveRecord({ weekStart, ids: [] });
    return { ok: true, count: 0, replaced };
  }

  const ids = [];
  for (const ev of events) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const id = await Calendar.createEventAsync(calId, ev);
      ids.push(id);
    } catch (e) {
      warn('create-event', e); // keep going — one bad event shouldn't sink the rest
    }
  }
  await saveRecord({ weekStart, ids });
  return { ok: ids.length > 0, count: ids.length, replaced, error: ids.length ? null : 'create-failed' };
}
