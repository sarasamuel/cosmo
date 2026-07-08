/* Thin expo-notifications wrapper for a single daily local reminder. Mirrors
   lib/storage.js: every call is guarded so a missing native module (e.g. running
   in Expo Go, where expo-notifications isn't supported) or a permission failure
   degrades to a logged no-op instead of crashing. Local-only — no push tokens,
   no backend. */
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

const CHANNEL = 'daily';
const NIGHTLY_ID = 'cosmo-nightly'; // fixed id so the nightly reminder is cancellable on its own (not via cancelAll)

/* Copy per coaching style. Gentle is the original voice; drill is firmer but
   never abusive. Drill's nightly copy claims "nothing logged", which is only
   honest because drill mode truth-gates it: logging a session cancels today's
   nightly, so it fires only on genuinely empty days. */
const NIGHTLY_COPY = {
  gentle: { title: 'Before the day closes...', body: 'Your evening check-in. Log a session to tend to your constellation' },
  drill: { title: 'The day is closing.', body: 'Nothing logged yet. Log a session or own the empty day.' },
};
const NIGHTLY_WINDOW = 7; // drill schedules this many date-keyed one-shots ahead (re-armed on app open)
const DAY_MS = 86400000;
// deterministic per-day id, so "cancel today's nightly" needs no stored ids
const nightlyDayId = (d) => `cosmo-nightly-${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

function warn(op, err) {
  // eslint-disable-next-line no-console
  console.warn(`[notifications] ${op} failed:`, err && err.message ? err.message : err);
}

// Show reminders that fire while the app is foregrounded, too.
try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
} catch (e) {
  warn('handler-setup', e);
}

// Returns true only if the OS permission to post notifications is granted,
// requesting it once if it hasn't been asked yet.
export async function ensurePermission() {
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    const req = await Notifications.requestPermissionsAsync();
    return !!req.granted;
  } catch (e) {
    warn('permission', e);
    return false;
  }
}

// Cancel every form of the nightly: the repeating gentle one and the drill
// window's date-keyed one-shots (a few days back too, for stragglers).
async function cancelNightlyAll() {
  try { await Notifications.cancelScheduledNotificationAsync(NIGHTLY_ID); } catch (e) { /* none */ }
  for (let k = -1; k <= NIGHTLY_WINDOW; k += 1) {
    // eslint-disable-next-line no-await-in-loop
    try { await Notifications.cancelScheduledNotificationAsync(nightlyDayId(new Date(Date.now() + k * DAY_MS))); } catch (e) { /* none */ }
  }
}

// (Re)schedule the nightly reminder for the given coaching style. Cancels any
// existing form first so the time or style can change without stacking.
// Gentle: one repeating DAILY trigger, as always. Drill: NIGHTLY_WINDOW
// date-keyed one-shots so a single day's can be cancelled when the user logs
// (the truth gate) — re-armed on every app open, so the window never runs dry
// for anyone who still opens the app.
export async function scheduleDaily(hour, minute, style = 'gentle') {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL, {
        name: 'Nightly reminders',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    await cancelNightlyAll();
    const copy = NIGHTLY_COPY[style] || NIGHTLY_COPY.gentle;
    if (style === 'drill') {
      for (let k = 0; k < NIGHTLY_WINDOW; k += 1) {
        const when = new Date(Date.now() + k * DAY_MS);
        when.setHours(hour, minute, 0, 0);
        if (when.getTime() <= Date.now()) continue; // today's slot already passed
        // eslint-disable-next-line no-await-in-loop
        await Notifications.scheduleNotificationAsync({
          identifier: nightlyDayId(when),
          content: { title: copy.title, body: copy.body },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when, channelId: CHANNEL },
        });
      }
      return true;
    }
    await Notifications.scheduleNotificationAsync({
      identifier: NIGHTLY_ID, // so cancelDaily() removes only this, leaving session reminders intact
      content: { title: copy.title, body: copy.body },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute, channelId: CHANNEL },
    });
    return true;
  } catch (e) {
    warn('schedule', e);
    return false;
  }
}

// Drill's truth gate: the user logged something today, so tonight's "nothing
// logged" nightly would be a lie — cancel just today's one-shot. Harmless in
// gentle mode (the date-keyed id doesn't exist there).
export async function cancelNightlyToday() {
  try {
    await Notifications.cancelScheduledNotificationAsync(nightlyDayId(new Date()));
    return true;
  } catch (e) {
    warn('cancel-today', e);
    return false;
  }
}

const WEEKLY_CHANNEL = 'weekly';
const WEEKLY_ID = 'cosmo-weekly-plan'; // fixed id so the weekly planning nudge is cancellable on its own
const WEEKLY_COPY = {
  gentle: { title: 'A new week is almost here', body: 'Take a moment to plan how you want to spend it.' },
  drill: { title: 'New week starts tomorrow.', body: 'Plan it tonight, or drift through it. Your call.' },
};

// Non-prompting check: true only if notification permission is already granted.
// Used to (re)schedule on launch without surprising the user with a prompt.
export async function hasPermission() {
  try {
    const current = await Notifications.getPermissionsAsync();
    return !!current.granted;
  } catch (e) {
    warn('has-permission', e);
    return false;
  }
}

// (Re)schedule the single weekly "plan your week" reminder. weekday is 1–7 with
// 1 = Sunday (expo-notifications convention). Like the nightly one, the WEEKLY
// trigger repeats on its own once scheduled; we cancel-then-add so it can move
// without stacking duplicates. Tapping it carries data.kind = 'plan-week' so the
// app opens the plan sheet instead of the end-of-day review.
export async function scheduleWeekly(weekday, hour, minute, style = 'gentle') {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(WEEKLY_CHANNEL, {
        name: 'Weekly planning reminders',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    try { await Notifications.cancelScheduledNotificationAsync(WEEKLY_ID); } catch (e) { /* none yet */ }
    const copy = WEEKLY_COPY[style] || WEEKLY_COPY.gentle;
    await Notifications.scheduleNotificationAsync({
      identifier: WEEKLY_ID,
      content: { title: copy.title, body: copy.body, data: { kind: 'plan-week' } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday, hour, minute, channelId: WEEKLY_CHANNEL },
    });
    return true;
  } catch (e) {
    warn('schedule-weekly', e);
    return false;
  }
}

export async function cancelWeekly() {
  try {
    await Notifications.cancelScheduledNotificationAsync(WEEKLY_ID); // only the weekly nudge
    return true;
  } catch (e) {
    warn('cancel-weekly', e);
    return false;
  }
}

const SESSION_CHANNEL = 'sessions';

// Schedule a one-shot local notification at each item's Date (used for the
// "30 minutes before a scheduled session" reminders). Each carries
// data.kind = 'schedule' so taps aren't mistaken for the nightly review. Returns
// the created notification ids so the caller can cancel them on re-plan — we do
// NOT cancelAll here, so the nightly reminder is left intact.
export async function scheduleSessionReminders(items) {
  const ids = [];
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(SESSION_CHANNEL, {
        name: 'Session reminders',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    for (const it of (items || [])) {
      const when = it.date instanceof Date ? it.date : new Date(it.date);
      if (!(when.getTime() > Date.now())) continue; // never schedule into the past
      // eslint-disable-next-line no-await-in-loop
      const id = await Notifications.scheduleNotificationAsync({
        content: { title: it.title, body: it.body, data: { kind: 'schedule', identityId: it.identityId } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when, channelId: SESSION_CHANNEL },
      });
      ids.push(id);
    }
    return ids;
  } catch (e) {
    warn('schedule-sessions', e);
    return ids;
  }
}

// Cancel specific scheduled notifications by id (the session reminders), leaving
// everything else (e.g. the nightly reminder) untouched.
export async function cancelReminders(ids) {
  try {
    for (const id of (ids || [])) {
      // eslint-disable-next-line no-await-in-loop
      try { await Notifications.cancelScheduledNotificationAsync(id); } catch (e) { /* already gone */ }
    }
    return true;
  } catch (e) {
    warn('cancel-reminders', e);
    return false;
  }
}

export async function cancelDaily() {
  try {
    await cancelNightlyAll(); // both nightly forms; session reminders untouched
    return true;
  } catch (e) {
    warn('cancel', e);
    return false;
  }
}

const NEGLECT_CHANNEL = 'neglect';
const neglectId = (identityId) => `cosmo-neglect-${identityId}`; // deterministic per identity

// Drill Sergeant neglect nudges — one one-shot per identity at its "gone quiet"
// crossing date (items built by lib/nudges). Deterministic ids mean re-arming an
// identity replaces its pending nudge with no stored-id bookkeeping. Taps carry
// data.kind = 'neglect' + identityId so the app can open the log sheet on it.
export async function scheduleNeglectNudges(items) {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(NEGLECT_CHANNEL, {
        name: 'Untended identity nudges',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    for (const it of (items || [])) {
      const when = it.date instanceof Date ? it.date : new Date(it.date);
      // eslint-disable-next-line no-await-in-loop
      try { await Notifications.cancelScheduledNotificationAsync(neglectId(it.identityId)); } catch (e) { /* none */ }
      if (!(when.getTime() > Date.now())) continue;
      // eslint-disable-next-line no-await-in-loop
      await Notifications.scheduleNotificationAsync({
        identifier: neglectId(it.identityId),
        content: { title: it.title, body: it.body, data: { kind: 'neglect', identityId: it.identityId } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when, channelId: NEGLECT_CHANNEL },
      });
    }
    return true;
  } catch (e) {
    warn('schedule-neglect', e);
    return false;
  }
}

// Cancel the pending neglect nudges for the given identity ids (e.g. switching
// back to Gentle, or an identity was retired/rested).
export async function cancelNeglectNudges(identityIds) {
  try {
    for (const id of (identityIds || [])) {
      // eslint-disable-next-line no-await-in-loop
      try { await Notifications.cancelScheduledNotificationAsync(neglectId(id)); } catch (e) { /* none */ }
    }
    return true;
  } catch (e) {
    warn('cancel-neglect', e);
    return false;
  }
}

// Cancel EVERYTHING Cosmo has scheduled (nightly + all session reminders). Used
// when the master Reminders switch is turned off.
export async function cancelAll() {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    return true;
  } catch (e) {
    warn('cancel-all', e);
    return false;
  }
}

// Fires when the user taps the reminder banner while the app is running (warm
// start). Returns an unsubscribe fn.
export function addResponseListener(handler) {
  try {
    const sub = Notifications.addNotificationResponseReceivedListener(handler);
    return () => {
      try {
        sub.remove();
      } catch (e) {
        /* already torn down */
      }
    };
  } catch (e) {
    warn('listen', e);
    return () => {};
  }
}

// The notification response that launched the app from cold, if any (tap while
// the app was killed). Null otherwise.
export async function getInitialResponse() {
  try {
    return await Notifications.getLastNotificationResponseAsync();
  } catch (e) {
    warn('initial-response', e);
    return null;
  }
}
