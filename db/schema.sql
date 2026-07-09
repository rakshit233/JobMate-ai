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

