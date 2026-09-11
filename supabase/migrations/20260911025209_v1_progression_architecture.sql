create table if not exists public.score_snapshots (
  id uuid primary key default uuid_generate_v4(), user_id uuid not null references auth.users(id) on delete cascade,
  score integer not null check(score between 0 and 100), coverage_pct integer not null default 0 check(coverage_pct between 0 and 100),
  breakdown jsonb not null default '{}'::jsonb, captured_on date not null default current_date, created_at timestamptz not null default now(), unique(user_id,captured_on)
);
create table if not exists public.user_progression (
  user_id uuid primary key references auth.users(id) on delete cascade, current_level text not null default 'Foundation', highest_score integer not null default 0,
  current_score integer not null default 0, coverage_pct integer not null default 0, sustained_high_days integer not null default 0,
  one_percent_unlocked boolean not null default false, one_percent_unlocked_at timestamptz, updated_at timestamptz not null default now()
);
create table if not exists public.user_achievements (
  id uuid primary key default uuid_generate_v4(), user_id uuid not null references auth.users(id) on delete cascade,
  achievement_key text not null, title text not null, category text not null check(category in ('score','milestone','behavior','elite')),
  threshold integer, metadata jsonb not null default '{}'::jsonb, unlocked_at timestamptz not null default now(), unique(user_id,achievement_key)
);
create index if not exists score_snapshots_user_date_idx on public.score_snapshots(user_id,captured_on desc);
create index if not exists user_achievements_user_time_idx on public.user_achievements(user_id,unlocked_at desc);
alter table public.score_snapshots enable row level security; alter table public.user_progression enable row level security; alter table public.user_achievements enable row level security;
drop policy if exists score_snapshots_isolation on public.score_snapshots; create policy score_snapshots_isolation on public.score_snapshots for select to authenticated using((select auth.uid())=user_id);
drop policy if exists user_progression_isolation on public.user_progression; create policy user_progression_isolation on public.user_progression for select to authenticated using((select auth.uid())=user_id);
drop policy if exists user_achievements_isolation on public.user_achievements; create policy user_achievements_isolation on public.user_achievements for select to authenticated using((select auth.uid())=user_id);
revoke all on public.score_snapshots,public.user_progression,public.user_achievements from anon;
revoke insert,update,delete,truncate on public.score_snapshots,public.user_progression,public.user_achievements from authenticated;
grant select on public.score_snapshots,public.user_progression,public.user_achievements to authenticated;
