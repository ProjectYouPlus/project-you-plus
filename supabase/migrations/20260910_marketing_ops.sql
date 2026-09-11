create table if not exists public.marketing_agent_runs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  agent_id text not null,
  status text not null default 'completed' check (status in ('queued','running','completed','failed','review')),
  objective text,
  context text,
  output text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.marketing_content_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  format text not null check (format in ('reel','carousel','story','static','live','other')),
  pillar text,
  stage text not null default 'idea' check (stage in ('idea','production','approval','scheduled','published','learning','archived')),
  hook text,
  caption text,
  script text,
  creative_brief text,
  scheduled_for timestamptz,
  published_at timestamptz,
  instagram_media_id text,
  source_agent_id text,
  metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketing_trend_signals (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  source text,
  relevance_score numeric(5,2),
  velocity_score numeric(5,2),
  brand_fit_score numeric(5,2),
  opportunity text,
  expires_at timestamptz,
  status text not null default 'new' check (status in ('new','watching','used','rejected','expired')),
  created_at timestamptz not null default now()
);

create table if not exists public.marketing_daily_metrics (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  metric_date date not null,
  followers integer,
  reach integer,
  impressions integer,
  profile_visits integer,
  website_clicks integer,
  shares integer,
  saves integer,
  comments integer,
  likes integer,
  reels_watch_time_seconds numeric,
  signups integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(owner_id, metric_date)
);

create table if not exists public.marketing_community_actions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  channel text not null default 'instagram',
  action_type text not null,
  contact_handle text,
  context text,
  suggested_reply text,
  priority integer not null default 2 check (priority between 1 and 3),
  status text not null default 'open' check (status in ('open','done','dismissed')),
  created_at timestamptz not null default now()
);

create table if not exists public.marketing_partnerships (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  handle text,
  category text,
  fit_score numeric(5,2),
  audience_notes text,
  collaboration_idea text,
  outreach_angle text,
  status text not null default 'prospect' check (status in ('prospect','research','ready','contacted','replied','active','passed')),
  next_action_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.marketing_agent_runs enable row level security;
alter table public.marketing_content_items enable row level security;
alter table public.marketing_trend_signals enable row level security;
alter table public.marketing_daily_metrics enable row level security;
alter table public.marketing_community_actions enable row level security;
alter table public.marketing_partnerships enable row level security;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'marketing_agent_runs',
    'marketing_content_items',
    'marketing_trend_signals',
    'marketing_daily_metrics',
    'marketing_community_actions',
    'marketing_partnerships'
  ]
  loop
    execute format('drop policy if exists "owner manages %I" on public.%I', table_name, table_name);
    execute format(
      'create policy "owner manages %I" on public.%I for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id)',
      table_name,
      table_name
    );
  end loop;
end $$;

create index if not exists marketing_agent_runs_owner_created_idx on public.marketing_agent_runs(owner_id, created_at desc);
create index if not exists marketing_content_owner_stage_idx on public.marketing_content_items(owner_id, stage, created_at desc);
create index if not exists marketing_trends_owner_status_idx on public.marketing_trend_signals(owner_id, status, created_at desc);
create index if not exists marketing_metrics_owner_date_idx on public.marketing_daily_metrics(owner_id, metric_date desc);
create index if not exists marketing_community_owner_status_idx on public.marketing_community_actions(owner_id, status, created_at desc);
create index if not exists marketing_partnerships_owner_status_idx on public.marketing_partnerships(owner_id, status, updated_at desc);
