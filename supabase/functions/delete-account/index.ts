// Supabase Edge Function — delete-account
// ---------------------------------------------------------------------------
// Permanently deletes the CALLING user's auth account. The `profiles` row (and
// any future per-user rows) cascade away via the `on delete cascade` FK in
// schema.sql. Deleting an auth user requires the service-role key, which must
// never ship in the app — hence this server-side function.
//
// Deploy:
//   supabase functions deploy delete-account
// (SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY are injected by
//  the platform — you don't set them manually.)
//
// The app calls it authenticated via supabase.functions.invoke('delete-account'),
// which attaches the user's JWT; we verify that JWT, then delete that user.
import { createClient } from 'jsr:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader) {
      return json({ error: 'missing authorization' }, 401);
    }

    const url = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Identify the caller from their JWT (anon client scoped to their token).
    const caller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userErr } = await caller.auth.getUser();
    if (userErr || !user) {
      return json({ error: 'unauthorized' }, 401);
    }

    // Delete with the service role (cascades to the user's data rows).
    const admin = createClient(url, serviceKey);
    const { error: delErr } = await admin.auth.admin.deleteUser(user.id);
    if (delErr) {
      return json({ error: delErr.message }, 500);
    }

    return json({ ok: true }, 200);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
