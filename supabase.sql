-- Run once in Supabase: Dashboard > SQL Editor > New query > paste > Run.

create table if not exists settings (
  id int primary key default 1 check (id = 1),
  enabled boolean not null default false
);
insert into settings (id, enabled) values (1, false) on conflict (id) do nothing;

create table if not exists posts (
  id bigserial primary key,
  slot text not null unique,          -- "2026-11-24:morning" for cron, "manual:<uuid>" for manual
  text text,
  text_hash text unique,              -- normalized hash, blocks exact repeats
  status text not null default 'pending', -- pending | posted | failed
  tweet_id text,
  error text,
  created_at timestamptz not null default now()
);
create index if not exists posts_created_at_idx on posts (created_at desc);

-- Lock the tables down. The app uses the service_role key on the server only,
-- which bypasses RLS. Nobody can read or write with the public anon key.
alter table settings enable row level security;
alter table posts enable row level security;
