-- ─────────────────────────────────────────────────────────────
-- Speakers feature — run once in the Supabase SQL Editor (same place
-- you ran the first schema). Safe to run more than once.
-- ─────────────────────────────────────────────────────────────

-- One row per speaker. `published` controls whether they appear on the
-- public Speakers page / sessions (so you can add tentative speakers now
-- and reveal them once confirmed). Photos live in Supabase Storage;
-- photo_url is null until one is uploaded (a monogram shows meanwhile).
create table if not exists public.speakers (
  id         text primary key,
  name       text not null,
  title      text default '',
  company    text default '',
  bio        text default '',
  photo_url  text,
  link       text,
  email      text default '',
  published  boolean not null default false,
  sort_order int default 0,
  created_at timestamptz not null default now()
);
create index if not exists speakers_sort_idx on public.speakers (sort_order, created_at);
-- (if the table already existed without it)
alter table public.speakers add column if not exists email text default '';

-- Sessions can reference any number of speakers (panels). Array of speaker ids.
alter table public.sessions
  add column if not exists speaker_ids jsonb not null default '[]'::jsonb;

-- Lock the table down like the others — server-only access via service role.
alter table public.speakers enable row level security;
