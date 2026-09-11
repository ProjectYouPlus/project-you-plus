-- Project You+ user intelligence core: longitudinal events, recommendations, score history, and progression.

create table if not exists public.user_intelligence_events (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_name text not null,
  domain text not null default 'general',
  entity_type text,
  entity_id text,
  occurred_at timestamptz not null default now(),
  value numeric,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists user_intelligence_events_user_time_idx on public.user_intelligence_events(user_id, occurred_at desc);
create index if not exists user_intelligence_events_user_event_idx on public.user_intelligence_events(user_id, event_name, occurred_at desc);
alter table public.user_intelligence_events enable row level security;
drop policy if exists user_intelligence_events_isolation on public.user_intelligence_events;
create policy user_intelligence_events_isolation on public.user_intelligence_events for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.ai_recommendations (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  domain text not null check (domain in ('planner','health','finance','progress','general')),
  observation text not null,
  evidence jsonb not null default '[]'::jsonb,
  reason text not null,
  suggested_action text not null,
  expected_impact text,
  confidence text not null default 'medium' check (confidence in ('low','medium','high')),
  status text not null default 'pending' check (status in ('pending','accepted','dismissed','completed','expired')),
  action_type text,
  action_payload jsonb not null default '{}'::jsonb,
  requires_confirmation boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz
);
create index if not exists ai_recommendations_user_status_idx on public.ai_recommendations(user_id, status, created_at desc);
alter table public.ai_recommendations enable row level security;
drop policy if exists ai_recommendations_isolation on public.ai_recommendations;
create policy ai_recommendations_isolation on public.ai_recommendations for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.score_snapshots (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  score integer not null check (score between 0 and 100),
  coverage_pct integer not null default 0 check (coverage_pct between 0 and 100),
  breakdown jsonb not null default '{}'::jsonb,
  captured_on date not null default current_date,
  created_at timestamptz not null default now(),
  unique(user_id, captured_on)
);
create index if not exists score_snapshots_user_date_idx on public.score_snapshots(user_id, captured_on desc);
alter table public.score_snapshots enable row level security;
drop policy if exists score_snapshots_isolation on public.score_snapshots;
create policy score_snapshots_isolation on public.score_snapshots for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.user_achievements (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  achievement_key text not null,
  title text not null,
  category text not null check (category in ('score','milestone','behavior','elite')),
  threshold integer,
  metadata jsonb not null default '{}'::jsonb,
  unlocked_at timestamptz not null default now(),
  unique(user_id, achievement_key)
);
create index if not exists user_achievements_user_time_idx on public.user_achievements(user_id, unlocked_at desc);
alter table public.user_achievements enable row level security;
drop policy if exists user_achievements_isolation on public.user_achievements;
create policy user_achievements_isolation on public.user_achievements for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.user_progression (
  user_id uuid primary key references auth.users(id) on delete cascade,
  current_level text not null default 'starting',
  highest_score integer not null default 0 check (highest_score between 0 and 100),
  current_score integer not null default 0 check (current_score between 0 and 100),
  coverage_pct integer not null default 0 check (coverage_pct between 0 and 100),
  sustained_high_days integer not null default 0,
  one_percent_unlocked boolean not null default false,
  one_percent_unlocked_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.user_progression enable row level security;
drop policy if exists user_progression_isolation on public.user_progression;
create policy user_progression_isolation on public.user_progression for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
