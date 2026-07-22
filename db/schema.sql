-- ─────────────────────────────────────────────────────────────
-- Flybridge Founders Week app — database schema
--
-- HOW TO USE: In your Supabase project, open the SQL Editor
-- (left sidebar) and paste this whole file in, then click "Run".
-- It creates the tables and locks them down. You only do this once.
--
-- The app seeds the agenda content automatically on first load, so
-- there is no data to paste here — just this structure.
-- ─────────────────────────────────────────────────────────────

-- Event-level config: a single row (id = 1) holding all event fields,
-- days, eats, slack/hotel settings, and the confirmation email template.
create table if not exists public.config (
  id   int primary key,
  data jsonb not null default '{}'::jsonb
);

-- Sessions: one row per agenda item. access_code is server-only and is
-- never sent to the browser (the API strips it).
create table if not exists public.sessions (
  id          text primary key,
  day         text not null,
  start_time  text not null,
  end_time    text not null,
  title       text not null,
  speaker     text default '',
  location    text default '',
  track       text default '',
  capacity    int  default 0,
  access_code text,
  cta         text,
  cta_done    text,
  description  text default '',
  sort_order  int default 0
);
create index if not exists sessions_day_idx on public.sessions (day, start_time);

-- Attendees: keyed by email. The full attendee object is stored as JSONB
-- so the app and CSV export see exactly the shape the prototype used.
create table if not exists public.attendees (
  email      text primary key,
  data       jsonb not null,
  created_at timestamptz not null default now()
);
-- Speeds up "who is registered for this session" capacity checks.
create index if not exists attendees_sessions_idx
  on public.attendees using gin ((data -> 'sessions'));

-- Announcements: the in-app Updates feed.
create table if not exists public.announcements (
  id     text primary key,
  text   text not null,
  author text default 'Flybridge team',
  ts     timestamptz not null default now()
);
create index if not exists announcements_ts_idx on public.announcements (ts desc);

-- ─────────────────────────────────────────────────────────────
-- Lock everything down. The app talks to the database only from the
-- server using the service-role key, which bypasses these rules. With
-- RLS enabled and NO policies, the public/anon key cannot read or write
-- any of these tables directly. This is what keeps registrant data and
-- access codes safe.
-- ─────────────────────────────────────────────────────────────
alter table public.config        enable row level security;
alter table public.sessions      enable row level security;
alter table public.attendees     enable row level security;
alter table public.announcements enable row level security;
