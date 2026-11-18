-- Run this once in the Supabase SQL editor (Project → SQL Editor → New query).
-- The app talks to these tables from the server with the service-role key only,
-- so Row Level Security is enabled with NO public policies (anon/browser access is denied).

create table if not exists public.tutor_profiles (
  user_id    text primary key,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.tutor_sessions (
  id         text primary key,
  user_id    text not null,
  data       jsonb not null,
  started_at timestamptz not null,
  updated_at timestamptz not null default now()
);
create index if not exists tutor_sessions_user_started on public.tutor_sessions (user_id, started_at desc);

create table if not exists public.tutor_vocab (
  id       text primary key,
  user_id  text not null,
  data     jsonb not null,
  added_at timestamptz not null
);
create index if not exists tutor_vocab_user_added on public.tutor_vocab (user_id, added_at desc);

alter table public.tutor_profiles enable row level security;
alter table public.tutor_sessions enable row level security;
alter table public.tutor_vocab    enable row level security;

-- Newer Supabase projects no longer grant table access to the API roles automatically.
-- The app uses only the server-side service_role, so grant it (and nothing to anon/authenticated).
grant usage on schema public to service_role;
grant all on table public.tutor_profiles, public.tutor_sessions, public.tutor_vocab to service_role;
