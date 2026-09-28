-- LEADATHON 2026 — database schema
-- Run in Supabase → SQL Editor, or apply with:
--   psql "postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres" -f supabase.sql

-- ── Registrations (one row per team) ──────────────────────────────────────────
create table if not exists public.registrations (
  id                 uuid primary key default gen_random_uuid(),
  team_name          text not null,
  participants_count int  not null,
  problem_category   text not null,
  problem_code       text,
  problem_title      text not null,
  problem_statement  text not null,
  project_stage      text not null,
  idea_summary       text,
  consent            boolean not null default false,
  primary_name       text not null,
  primary_phone      text not null,
  primary_email      text not null,
  created_at         timestamptz not null default now()
);

-- ── Participants (one row per member, each with a secure QR token) ─────────────
create table if not exists public.participants (
  id               uuid primary key default gen_random_uuid(),
  registration_id  uuid not null references public.registrations(id) on delete cascade,
  idx              int  not null,                       -- 1-based position in the team
  name             text not null,
  phone            text not null,
  email            text not null,
  profile          text not null,
  institution      text,
  qr_token         text not null unique,                -- cryptographically random, unguessable
  status           text not null default 'registered',  -- registered | checked_in | checked_out
  checked_in_at    timestamptz,
  checked_out_at   timestamptz,
  email_sent_at    timestamptz,
  created_at       timestamptz not null default now()
);

create index if not exists participants_reg_idx   on public.participants(registration_id);
create index if not exists participants_token_idx on public.participants(qr_token);
create index if not exists participants_status_idx on public.participants(status);

-- ── Security ──────────────────────────────────────────────────────────────────
-- RLS ON with no public policies: the anon/publishable key cannot read or write.
-- Only the server (using the secret key) touches these tables, bypassing RLS.
alter table public.registrations enable row level security;
alter table public.participants  enable row level security;
