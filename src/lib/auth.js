/* Passwordless email-code auth, wrapping Supabase Auth. The flow is two steps:
   sendCode(email) → Supabase emails a 6-digit code → verifyCode(email, code).

   IMPORTANT (project config, not code): Supabase's default email template sends a
   magic *link*. To get a 6-digit *code*, edit the "Magic Link" / "OTP" template in
   the Supabase dashboard to include {{ .Token }} (see supabase/schema.sql notes).

   Every call is guarded: if Supabase isn't configured (no env keys), helpers
   return { ok: false, error: 'not-configured' } instead of throwing, so the app
   stays usable offline-only. */
import { supabase, isConfigured } from './supabase';
import { reportError } from './telemetry';

export { isConfigured };

function warn(op, e) {
  reportError('auth', e, { op });
}

// Step 1 — email the user a login code (creates the account if new).
export async function sendCode(email) {
  if (!supabase) return { ok: false, error: 'not-configured' };
  try {
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { shouldCreateUser: true },
    });
    if (error) throw error;
    return { ok: true };
  } catch (e) {
    warn('sendCode', e);
    return { ok: false, error: e.message || 'Could not send the code.' };
  }
}

// Step 2 — verify the code; on success the session is persisted + listeners fire.
export async function verifyCode(email, token) {
  if (!supabase) return { ok: false, error: 'not-configured' };
  try {
    const { data, error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: token.trim(),
      type: 'email',
    });
    if (error) throw error;
    return { ok: true, session: data.session };
  } catch (e) {
    warn('verifyCode', e);
    return { ok: false, error: e.message || 'That code didn’t work.' };
  }
}

export async function signOut() {
  if (!supabase) return;
  try {
    await supabase.auth.signOut();
  } catch (e) {
    warn('signOut', e);
  }
}

export async function getSession() {
  if (!supabase) return null;
  try {
    const { data } = await supabase.auth.getSession();
    return data.session || null;
  } catch (e) {
    warn('getSession', e);
    return null;
  }
}

// Subscribe to sign-in / sign-out. Returns an unsubscribe fn.
export function onAuthChange(handler) {
  if (!supabase) return () => {};
  try {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => handler(session));
    return () => {
      try {
        data.subscription.unsubscribe();
      } catch (e) {
        /* already torn down */
      }
    };
  } catch (e) {
    warn('onAuthChange', e);
    return () => {};
  }
}
