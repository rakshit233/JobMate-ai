-- Run this once in Supabase: Project -> SQL Editor -> New query -> paste -> Run

create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  name text not null,
  data jsonb not null default '{}'::jsonb,
  is_active boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table profiles enable row level security;

create policy "users manage own profiles"
  on profiles
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── Billing / paywall ──────────────────────────────────────────────
-- One row per user. plan is the source of truth the app checks; the Stripe
-- webhook keeps it in sync with the actual subscription state.
create table if not exists subscriptions (
  user_id uuid primary key references auth.users not null,
  stripe_customer_id text,
  stripe_subscription_id text,
  plan text not null default 'free',        -- 'free' | 'pro'
  status text not null default 'none',       -- 'none' | 'active' | 'trialing' | 'past_due' | 'canceled'
  current_period_end timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table subscriptions enable row level security;

-- Users may only ever READ their own row. All writes happen server-side
-- with the service-role key (usage-consume and the Stripe webhook), so a
-- user can never grant themselves "pro" via the browser console.
create policy "users read own subscription"
  on subscriptions
  for select
  using (auth.uid() = user_id);

-- Monthly usage counter for the free tier. One row per user per calendar
-- month ('YYYY-MM'). Same write restriction as above — read-only to users.
create table if not exists usage_counters (
  user_id uuid references auth.users not null,
  month text not null,
  count int not null default 0,
  updated_at timestamptz default now(),
  primary key (user_id, month)
);

alter table usage_counters enable row level security;

create policy "users read own usage"
  on usage_counters
  for select
  using (auth.uid() = user_id);

create table if not exists resume_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  name text not null,
  data jsonb not null,
  last_tailored_role text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table resume_versions enable row level security;

create policy "users manage own resume versions"
  on resume_versions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists job_tracker_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  role text not null,
  company text not null,
  location text,
  date date,
  status text not null default 'Saved',
  notes text,
  resume_version_id uuid references resume_versions(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table job_tracker_entries enable row level security;

create policy "users manage own tracker entries"
  on job_tracker_entries
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

