-- Run this once in your Supabase project's SQL Editor
-- (Dashboard -> SQL Editor -> New query -> paste -> Run)

create table if not exists app_kv (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- Row Level Security: locked down by default. The app talks to this table
-- using the service_role key from server-side API routes only (never
-- exposed to the browser), so no public policies are needed.
alter table app_kv enable row level security;
