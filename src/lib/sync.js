/* Document sync — the user's whole domain state is one JSON snapshot in their
   `profiles.state` row. Last-write-wins by a timestamp inside the snapshot.

   This is backup/restore, layered on top of the local-first store: the device
   stays the source of truth (AsyncStorage); we pull on sign-in and push on
   change. Every call is guarded — no Supabase / no session → logged no-op. */
import { supabase } from './supabase';

function warn(op, e) {
  // eslint-disable-next-line no-console
  console.warn(`[sync] ${op} failed:`, e && e.message ? e.message : e);
}

// Fetch the user's saved snapshot (or null if none / not signed in / offline).
export async function pullState(userId) {
  if (!supabase || !userId) return null;
  try {
    const { data, error } = await supabase.from('profiles').select('state').eq('id', userId).maybeSingle();
    if (error) throw error;
    return (data && data.state) || null;
  } catch (e) {
    warn('pull', e);
    return null;
  }
}

// Upsert the user's snapshot. The profiles row is auto-created on signup, but
// upsert covers the edge where it isn't yet.
export async function pushState(userId, snapshot) {
  if (!supabase || !userId) return false;
  try {
    const { error } = await supabase.from('profiles').upsert({ id: userId, state: snapshot }, { onConflict: 'id' });
    if (error) throw error;
    return true;
  } catch (e) {
    warn('push', e);
    return false;
  }
}
