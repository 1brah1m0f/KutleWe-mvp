-- Supabase SQL Editor ucun minimal schema

create table if not exists public.users (
  id bigserial primary key,
  email text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.logs (
  id bigserial primary key,
  user_id bigint references public.users(id) on delete set null,
  level text not null,
  message text not null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_logs_created_at on public.logs (created_at desc);
