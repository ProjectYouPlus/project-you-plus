-- Behavior-based progression. Configuration and achievement definitions live in typed application code.
alter table public.user_progression
  add column if not exists current_level_number integer not null default 0 check (current_level_number between 0 and 99),
  add column if not exists progression_index numeric not null default 0 check (progression_index between 0 and 100),
  add column if not exists progression_status text not null default 'calibrating' check (progression_status in ('calibrating','active')),
  add column if not exists highest_level integer not null default 0 check (highest_level between 0 and 99),
  add column if not exists highest_milestone integer check (highest_milestone in (60,70,80,90,99)),
  add column if not exists next_milestone integer check (next_milestone in (60,70,80,90,99)),
  add column if not exists limiting_factors jsonb not null default '[]'::jsonb,
  add column if not exists integrity_flags jsonb not null default '[]'::jsonb,
  add column if not exists averages jsonb not null default '{}'::jsonb,
  add column if not exists consistency_pct integer not null default 0 check (consistency_pct between 0 and 100),
  add column if not exists domain_balance numeric check (domain_balance between 0 and 100),
  add column if not exists domain_floor numeric check (domain_floor between 0 and 100),
  add column if not exists activity_days_90 integer not null default 0 check (activity_days_90 between 0 and 90),
  add column if not exists calibration_days integer not null default 0 check (calibration_days between 0 and 100),
  add column if not exists one_percent_current boolean not null default false,
  add column if not exists calculated_at timestamptz not null default now();

create table if not exists public.progression_history (
  id uuid primary key default uuid_generate_v4(), user_id uuid not null references auth.users(id) on delete cascade,
  level integer not null check (level between 0 and 99), progression_index numeric not null check (progression_index between 0 and 100),
  stage text not null check (stage in ('Foundation','Momentum','Alignment','Elite','1%')), status text not null check (status in ('calibrating','active')),
  reasons jsonb not null default '[]'::jsonb, recorded_on date not null default current_date, created_at timestamptz not null default now(),
  unique(user_id, recorded_on)
);
create index if not exists progression_history_user_time_idx on public.progression_history(user_id, recorded_on desc);

create table if not exists public.progression_milestones (
  id uuid primary key default uuid_generate_v4(), user_id uuid not null references auth.users(id) on delete cascade,
  level integer not null check (level in (60,70,80,90,99)), stage text not null check (stage in ('Foundation','Momentum','Alignment','Elite','1%')),
  reached_at timestamptz not null, evidence jsonb not null default '{}'::jsonb, unique(user_id, level)
);
create index if not exists progression_milestones_user_time_idx on public.progression_milestones(user_id, reached_at desc);

alter table public.user_achievements drop constraint if exists user_achievements_category_check;
alter table public.user_achievements drop constraint if exists user_achievements_tier_check;
alter table public.user_achievements add column if not exists tier text not null default 'standard';
alter table public.user_achievements add column if not exists earned_evidence jsonb not null default '{}'::jsonb;
update public.user_achievements set category=case category when 'milestone' then 'progression' when 'behavior' then 'consistency' when 'elite' then 'special' else category end
where category in ('milestone','behavior','elite');
alter table public.user_achievements add constraint user_achievements_category_check check(category in ('score','consistency','health','finance','goals','planning','review','progression','special'));
alter table public.user_achievements add constraint user_achievements_tier_check check(tier in ('standard','major','elite'));

alter table public.behavior_events drop constraint if exists behavior_events_event_type_check;
alter table public.behavior_events add constraint behavior_events_event_type_check check(event_type in (
  'task.completed','task.missed','habit.completed','habit.missed','workout.completed','workout.missed','meal.logged','supplement.completed',
  'calendar.changed','spending.threshold','goal.progress_changed','score.changed','achievement.unlocked','milestone.unlocked','first_week.completed',
  'pattern.discovered','workout.plan_activated','workout.schedule_changed','finance.goal_created','finance.goal_completed','finance.account_synced',
  'finance.transaction_synced','finance.budget_changed','finance.bill_changed','progression.personal_best','progression.one_percent_earned'
));

alter table public.progression_history enable row level security;
alter table public.progression_milestones enable row level security;
drop policy if exists progression_history_isolation on public.progression_history;
create policy progression_history_isolation on public.progression_history for select to authenticated using ((select auth.uid())=user_id);
drop policy if exists progression_milestones_isolation on public.progression_milestones;
create policy progression_milestones_isolation on public.progression_milestones for select to authenticated using ((select auth.uid())=user_id);
revoke all on public.progression_history, public.progression_milestones from anon;
revoke insert, update, delete, truncate on public.progression_history, public.progression_milestones from authenticated;
grant select on public.progression_history, public.progression_milestones to authenticated;

comment on table public.progression_history is 'Meaningful daily progression changes; current score remains separate in score_snapshots.';
comment on table public.progression_milestones is 'Permanent first-reached milestone history, independent of current operating level.';
