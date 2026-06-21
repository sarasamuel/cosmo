/* Supabase client. Reads the project URL + anon key from Expo public env vars
   (EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY — see .env.example).
   The anon key is safe to ship: Row-Level Security is what protects user data.

   Local-first principle: the app's source of truth stays the on-device store
   (lib/storage + Store.js). Supabase is a *backup/sync* target — never required
   to use the app. If the env vars aren't set, `supabase` is null and the auth
   helpers degrade to a logged no-op (like lib/notifications / lib/storage). */
import 'react-native-url-polyfill/auto';
import { AppState } from 'react-native';
import { createClient } from '@supabase/supabase-js';
import secureStorage from './secureStorage';

// Sanitize: a stray trailing slash or whitespace in the env value makes the
// client build paths like `…//auth/v1/otp` → "Invalid path specified in request
// URL". Strip trailing slashes + surrounding whitespace/quotes defensively.
const clean = (v) => (v ? v.trim().replace(/^['"]|['"]$/g, '').replace(/\/+$/, '') : undefined);
const url = clean(process.env.EXPO_PUBLIC_SUPABASE_URL);
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
  ? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY.trim().replace(/^['"]|['"]$/g, '')
  : undefined;

export const isConfigured = !!(url && anonKey);

// Auth tokens (incl. the long-lived refresh token) persist in the device
// Keychain/Keystore via expo-secure-store (see ./secureStorage), not plaintext
// AsyncStorage. The adapter chunks around SecureStore's size limit and migrates
// any token left over from the old AsyncStorage location on first read.
export const supabase = isConfigured
  ? createClient(url, anonKey, {
      auth: {
        storage: secureStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false, // no URL-based session (mobile, not web)
      },
    })
  : null;

// Refresh the session only while the app is foregrounded (Supabase guidance).
if (supabase) {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
