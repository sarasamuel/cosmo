/* Thin expo-notifications wrapper for a single daily local reminder. Mirrors
   lib/storage.js: every call is guarded so a missing native module (e.g. running
   in Expo Go, where expo-notifications isn't supported) or a permission failure
   degrades to a logged no-op instead of crashing. Local-only — no push tokens,
   no backend. */
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

const CHANNEL = 'daily';
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
    await Notifications.cancelAllScheduledNotificationsAsync();
    await Notifications.scheduleNotificationAsync({
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

export async function cancelDaily() {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    return true;
  } catch (e) {
    warn('cancel', e);
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
