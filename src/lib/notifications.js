/* Thin expo-notifications wrapper for a single daily local reminder. Mirrors
   lib/storage.js: every call is guarded so a missing native module (e.g. running
   in Expo Go, where expo-notifications isn't supported) or a permission failure
   degrades to a logged no-op instead of crashing. Local-only — no push tokens,
   no backend. */
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

const CHANNEL = 'daily';
const NIGHTLY_ID = 'cosmo-nightly'; // fixed id so the nightly reminder is cancellable on its own (not via cancelAll)
const TITLE = 'Before the day closes...';
const BODY = 'Your evening check-in. Log a session to tend to your constellation';

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

// (Re)schedule the single nightly reminder. Cancels any existing one first so the
// time can change without stacking duplicates. The DAILY trigger repeats on its
// own — scheduled once, it fires every day at hour:minute.
export async function scheduleDaily(hour, minute) {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL, {
        name: 'Nightly reminders',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    try { await Notifications.cancelScheduledNotificationAsync(NIGHTLY_ID); } catch (e) { /* none yet */ }
    await Notifications.scheduleNotificationAsync({
      identifier: NIGHTLY_ID, // so cancelDaily() removes only this, leaving session reminders intact
      content: { title: TITLE, body: BODY },
      // TEMPORARY — fires ~5s after you toggle the reminder on
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 5,
        repeats: false,
        channelId: CHANNEL,
      },
      // trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute, channelId: CHANNEL },
    });
    return true;
  } catch (e) {
    warn('schedule', e);
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
    await Notifications.cancelScheduledNotificationAsync(NIGHTLY_ID); // only the nightly; session reminders untouched
    return true;
  } catch (e) {
    warn('cancel', e);
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
