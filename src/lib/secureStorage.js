/* SecureStore-backed storage adapter for the Supabase auth session.
   ---------------------------------------------------------------------------
   The Supabase auth session (access + refresh tokens) is sensitive — a refresh
   token grants long-lived account access — and must NOT sit in plaintext
   AsyncStorage. This adapter persists it in the device Keychain (iOS) /
   Keystore (Android) via expo-secure-store.

   Two production wrinkles handled here:
   1. SecureStore values are capped (~2048 bytes on Android); a Supabase session
      blob is larger. We chunk values across multiple secure keys transparently.
   2. Existing installs have a token already in AsyncStorage. On first read we
      fall back to it, migrate it into SecureStore, and clear the plaintext copy
      — so upgrading users don't get logged out.

   ⚠️ NOT WIRED IN YET. expo-secure-store is a native module → requires:
        npx expo install expo-secure-store
        # then a native rebuild (Xcode / expo run / EAS)
      and switching supabase.js to use this (see the note in that file).
      Until installed + rebuilt, keep using AsyncStorage. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

const CHUNK = 1800;             // stay under SecureStore's ~2KB per-value limit
const META = (k) => `${k}__n`;  // how many chunks a value was split into
const PART = (k, i) => `${k}__${i}`;

// SecureStore keys allow only [A-Za-z0-9._-]; Supabase keys (sb-<ref>-auth-token)
// already satisfy that. Guard anyway so an odd key degrades instead of throwing.
const safe = (k) => /^[A-Za-z0-9._-]+$/.test(k);

async function clearChunks(key) {
  const n = Number(await SecureStore.getItemAsync(META(key)));
  if (Number.isFinite(n) && n > 0) {
    for (let i = 0; i < n; i += 1) await SecureStore.deleteItemAsync(PART(key, i));
    await SecureStore.deleteItemAsync(META(key));
  }
  await SecureStore.deleteItemAsync(key);
}

export async function getItem(key) {
  if (!safe(key)) return AsyncStorage.getItem(key);
  // chunked value?
  const n = Number(await SecureStore.getItemAsync(META(key)));
  if (Number.isFinite(n) && n > 0) {
    let out = '';
    for (let i = 0; i < n; i += 1) out += (await SecureStore.getItemAsync(PART(key, i))) || '';
    return out;
  }
  const direct = await SecureStore.getItemAsync(key);
  if (direct != null) return direct;
  // legacy migration: token still in AsyncStorage from before this adapter
  const legacy = await AsyncStorage.getItem(key);
  if (legacy != null) {
    await setItem(key, legacy);
    await AsyncStorage.removeItem(key);
    return legacy;
  }
  return null;
}

export async function setItem(key, value) {
  if (!safe(key)) return AsyncStorage.setItem(key, value);
  await clearChunks(key); // replace any prior value/chunks atomically-ish
  if (value.length <= CHUNK) {
    await SecureStore.setItemAsync(key, value);
    return undefined;
  }
  const n = Math.ceil(value.length / CHUNK);
  for (let i = 0; i < n; i += 1) {
    await SecureStore.setItemAsync(PART(key, i), value.slice(i * CHUNK, (i + 1) * CHUNK));
  }
  await SecureStore.setItemAsync(META(key), String(n));
  return undefined;
}

export async function removeItem(key) {
  if (!safe(key)) return AsyncStorage.removeItem(key);
  await clearChunks(key);
  return undefined;
}

// The object shape Supabase's `auth.storage` option expects.
export default { getItem, setItem, removeItem };
