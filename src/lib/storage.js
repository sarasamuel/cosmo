/* Thin AsyncStorage wrapper. Persistence failures shouldn't crash the app, but
   they also shouldn't vanish silently — each op logs with its key + operation so
   a failed/corrupt read or a full disk is observable (and easy to route to real
   telemetry later) instead of silently resetting the user's data. */
import AsyncStorage from '@react-native-async-storage/async-storage';

function warn(op, key, err) {
  // eslint-disable-next-line no-console
  console.warn(`[storage] ${op} "${key}" failed:`, err && err.message ? err.message : err);
}

export async function getItem(key) {
  try {
    return await AsyncStorage.getItem(key);
  } catch (e) {
    warn('read', key, e);
    return null;
  }
}

export async function setItem(key, value) {
  try {
    await AsyncStorage.setItem(key, value);
    return true;
  } catch (e) {
    warn('write', key, e);
    return false;
  }
}

export async function removeItem(key) {
  try {
    await AsyncStorage.removeItem(key);
    return true;
  } catch (e) {
    warn('remove', key, e);
    return false;
  }
}
