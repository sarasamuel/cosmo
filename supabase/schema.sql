-- Cosmo — Supabase schema + Row-Level Security
-- ---------------------------------------------------------------------------
-- Run this once in the Supabase SQL editor (Dashboard → SQL → New query).
-- It creates the three tables Cosmo syncs (profiles / identities / sessions),
-- locks each row to its owner via RLS, keeps updated_at fresh, and auto-creates
-- a profile row when a user signs up.
--
-- ⚠️  EMAIL CODE (not magic link): to make sign-in send a 6-digit *code* instead
--     of a link, edit the email template in
--       Dashboard → Authentication → Email Templates → "Magic Link"
--     and replace the {{ .ConfirmationURL }} body with the token, e.g.:
--       <p>Your Cosmo code is <b>{{ .Token }}</b></p>
--     (The auth lib calls verifyOtp with that token.)
-- ---------------------------------------------------------------------------

-- ---- profiles: one row per user — preferences + week state ----------------
create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  theme         text    default 'dark',
  form          text    default 'orbit',
  free_hours    int     default 35,
  relax_desired int     default 15,
  relax_tracked boolean default true,
  reminder      jsonb   default '{"enabled":false,"hour":9,"minute":0}'::jsonb,
  week_planned  boolean default false,
  -- escape hatch for misc prefs that don't warrant a column yet
  extra         jsonb   default '{}'::jsonb,
  updated_at    timestamptz default now()
);

-- ---- identities: progress lives here; `retired` keeps them in history ------
create table if not exists public.identities (
  user_id          uuid not null references auth.users (id) on delete cascade,
  id               text not null,            -- app-side identity id (e.g. 'writer')
  name             text not null,
  glyph            text,
  palette          text,                     -- canonical color key, or null
  hue              int,                      -- for runtime-added identities
  desired          int  default 0,
  actual           int  default 0,
  last_active_days int  default 99,
  streak           int  default 0,
  usual_mins       int,
  retired          boolean default false,
  updated_at       timestamptz default now(),
  primary key (user_id, id)
);

-- ---- sessions: the history. Real timestamps (no frozen "Just now"). --------
create table if not exists public.sessions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  identity_id text,                          -- identity id or 'relax'
  label       text,
  mins        int not null,
  created_at  timestamptz default now()
);

create index if not exists sessions_user_created_idx
  on public.sessions (user_id, created_at desc);

-- ---- Row-Level Security: a user can only ever touch their own rows --------
alter table public.profiles   enable row level security;
alter table public.identities enable row level security;
alter table public.sessions   enable row level security;

drop policy if exists "own profile"    on public.profiles;
drop policy if exists "own identities" on public.identities;
drop policy if exists "own sessions"   on public.sessions;

create policy "own profile" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "own identities" on public.identities
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own sessions" on public.sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---- keep updated_at current on edits (for last-write-wins sync) ----------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch   on public.profiles;
drop trigger if exists identities_touch on public.identities;

create trigger profiles_touch   before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger identities_touch before update on public.identities
  for each row execute function public.touch_updated_at();

-- ---- auto-create a profile row when a new user signs up -------------------
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
-- Document backup (slice 3). The app syncs its whole domain state as one JSON
-- snapshot per user (last-write-wins by a timestamp inside the blob). This reuses
-- the profiles row, so just add a `state` column. The identities/sessions tables
-- above stay for a possible future relational sync; they're unused for now.
-- (Safe to run again — `if not exists`.)
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists state jsonb;
