-- Cosmo — Supabase schema + Row-Level Security
-- ---------------------------------------------------------------------------
-- Run this once in the Supabase SQL editor (Dashboard → SQL → New query).
-- The app is local-first: the device (AsyncStorage) is the source of truth, and
-- the whole domain snapshot is backed up as ONE json document in profiles.state
-- (see src/lib/sync.js). RLS locks every row to its owner; a profile row is
-- auto-created on signup.
--
-- ⚠️  EMAIL CODE (not magic link): to make sign-in send a 6-digit *code* instead
--     of a link, edit the email template in
--       Dashboard → Authentication → Email Templates → "Magic Link"
--     and replace the {{ .ConfirmationURL }} body with the token, e.g.:
--       <p>Your Cosmo code is <b>{{ .Token }}</b></p>
--     (The auth lib calls verifyOtp with that token.)
-- ---------------------------------------------------------------------------

-- ---- profiles: one row per user — the whole app snapshot in `state` ---------
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  state      jsonb default '{}'::jsonb,   -- entire domain snapshot (see buildSnapshot in Store.js)
  updated_at timestamptz default now()
);

-- Idempotent migration for databases created before `state` existed (e.g. an
-- earlier normalized schema). Safe to run repeatedly.
alter table public.profiles add column if not exists state jsonb default '{}'::jsonb;

-- ---- Row-Level Security: a user can only ever touch their own row ----------
alter table public.profiles enable row level security;

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- ---- keep updated_at current on edits --------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ---- auto-create a profile row when a new user signs up --------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- OPTIONAL CLEANUP — only if you previously ran the old normalized schema.
-- The app never reads/writes these tables or the per-column profile fields;
-- everything lives in profiles.state. They're empty dead weight. Uncomment to
-- drop them. (Destructive — confirm nothing else uses them first.)
-- ---------------------------------------------------------------------------
-- drop table if exists public.identities cascade;
-- drop table if exists public.sessions   cascade;
-- alter table public.profiles drop column if exists theme;
-- alter table public.profiles drop column if exists form;
-- alter table public.profiles drop column if exists free_hours;
-- alter table public.profiles drop column if exists relax_desired;
-- alter table public.profiles drop column if exists relax_tracked;
-- alter table public.profiles drop column if exists reminder;
-- alter table public.profiles drop column if exists week_planned;
-- alter table public.profiles drop column if exists extra;
