-- ─────────────────────────────────────────────────────────────
-- Anonymous feedback (overall event + per-session ratings).
-- Run this once in the Supabase SQL editor.
-- No attendee identity is stored — feedback is anonymous.
-- ─────────────────────────────────────────────────────────────
create table if not exists public.feedback (
  id         text primary key,
  kind       text not null,                 -- 'event' | 'session'
  session_id text,                           -- set when kind = 'session'
  rating     int,                            -- 1-5 star rating (session)
  data       jsonb not null default '{}'::jsonb,
  ts         timestamptz not null default now()
);
create index if not exists feedback_kind_idx on public.feedback (kind);
create index if not exists feedback_session_idx on public.feedback (session_id);

-- Same lockdown as the other tables: RLS on, no policies, so only the
-- server (service-role key) can read or write.
alter table public.feedback enable row level security;
