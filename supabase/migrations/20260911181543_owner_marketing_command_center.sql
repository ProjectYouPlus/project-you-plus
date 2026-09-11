alter table public.ai_department_budget
  add column if not exists growth_mode text not null default 'assisted'
  check (growth_mode in ('manual','assisted','autopilot'));

alter table public.marketing_content_items
  add column if not exists hypothesis text,
  add column if not exists cta text,
  add column if not exists filming_instructions jsonb not null default '{}'::jsonb;

alter table public.marketing_partnerships drop constraint if exists marketing_partnerships_status_check;
alter table public.marketing_partnerships add constraint marketing_partnerships_status_check
  check (status in ('prospect','research','ready','contacted','replied','collaboration','active','passed'));

create table if not exists public.marketing_daily_plans (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  campaign_id uuid references public.marketing_campaigns(id) on delete set null,
  plan_date date not null default current_date,
  objective text not null,
  summary text,
  tasks jsonb not null default '[]'::jsonb,
  status text not null default 'active' check (status in ('draft','active','complete','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id, plan_date)
);

create table if not exists public.marketing_experiments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  campaign_id uuid references public.marketing_campaigns(id) on delete set null,
  name text not null,
  hypothesis text not null,
  variant_a text,
  variant_b text,
  primary_metric text not null,
  target_sample integer,
  current_sample integer not null default 0,
  status text not null default 'proposed' check (status in ('proposed','active','collecting','complete','promoted','retired')),
  winner text,
  impact_percent numeric(7,2),
  evidence text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketing_weekly_reviews (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  executive_summary text,
  review jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(owner_id, week_start)
);

create table if not exists public.marketing_agent_settings (
  owner_id uuid not null references auth.users(id) on delete cascade,
  agent_id text not null,
  enabled boolean not null default true,
  state text not null default 'idle' check (state in ('idle','working','waiting_approval','paused','offline','error')),
  current_assignment text,
  monthly_estimated_cost_cents integer not null default 0 check (monthly_estimated_cost_cents >= 0),
  updated_at timestamptz not null default now(),
  primary key (owner_id, agent_id)
);

alter table public.marketing_daily_plans enable row level security;
alter table public.marketing_experiments enable row level security;
alter table public.marketing_weekly_reviews enable row level security;
alter table public.marketing_agent_settings enable row level security;

grant select, insert, update, delete on public.marketing_daily_plans,
  public.marketing_experiments, public.marketing_weekly_reviews,
  public.marketing_agent_settings to authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'marketing_agent_runs', 'marketing_content_items', 'marketing_trend_signals',
    'marketing_daily_metrics', 'marketing_community_actions', 'marketing_partnerships',
    'marketing_campaigns', 'marketing_learnings', 'marketing_daily_plans',
    'marketing_experiments', 'marketing_weekly_reviews', 'marketing_agent_settings'
  ]
  loop
    execute format('drop policy if exists "owner manages %I" on public.%I', table_name, table_name);
    execute format('drop policy if exists "admins manage %I" on public.%I', table_name, table_name);
    execute format(
      'create policy "admins manage %I" on public.%I for all to authenticated using ((select auth.uid()) = owner_id and (select private.is_app_admin())) with check ((select auth.uid()) = owner_id and (select private.is_app_admin()))',
      table_name, table_name
    );
  end loop;
end $$;

drop policy if exists "owner manages ai department budget" on public.ai_department_budget;
drop policy if exists "admins manage ai department budget" on public.ai_department_budget;
create policy "admins manage ai department budget" on public.ai_department_budget for all to authenticated
  using ((select auth.uid()) = owner_id and (select private.is_app_admin()))
  with check ((select auth.uid()) = owner_id and (select private.is_app_admin()));

drop policy if exists "owner manages ai spend ledger" on public.ai_department_spend_ledger;
drop policy if exists "admins manage ai spend ledger" on public.ai_department_spend_ledger;
create policy "admins manage ai spend ledger" on public.ai_department_spend_ledger for all to authenticated
  using ((select auth.uid()) = owner_id and (select private.is_app_admin()))
  with check ((select auth.uid()) = owner_id and (select private.is_app_admin()));

create index if not exists marketing_daily_plans_owner_date_idx on public.marketing_daily_plans(owner_id, plan_date desc);
create index if not exists marketing_experiments_owner_status_idx on public.marketing_experiments(owner_id, status, updated_at desc);
create index if not exists marketing_weekly_reviews_owner_week_idx on public.marketing_weekly_reviews(owner_id, week_start desc);
