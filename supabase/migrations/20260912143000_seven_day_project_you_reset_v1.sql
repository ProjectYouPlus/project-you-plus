-- 7-Day Project You+ Reset v1
-- Orchestrates the canonical Project You+ system without duplicating goals, tasks, habits, scores, or reviews.

create table if not exists public.reset_enrollments (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reset_version text not null default '2026-09-reset-v1',
  source_onboarding_session_id uuid references public.onboarding_sessions(id) on delete set null,
  start_date date,
  timezone text not null default 'UTC',
  current_day smallint not null default 1 check (current_day between 1 and 7),
  status text not null default 'pending' check (status in ('pending','active','paused','awaiting_weekly_review','completed')),
  preparation_evening boolean not null default false,
  starting_score integer check (starting_score between 0 and 100),
  starting_score_coverage integer check (starting_score_coverage between 0 and 100),
  starting_score_version text not null default 'progression-v1',
  starting_context_version text,
  completed_day_count integer not null default 0 check (completed_day_count between 0 and 7),
  closed_day_count integer not null default 0 check (closed_day_count between 0 and 7),
  recovery_count integer not null default 0 check (recovery_count >= 0),
  weekly_review_id uuid references public.weekly_reviews(id) on delete set null,
  review_opened_at timestamptz,
  next_week_resolution text check (next_week_resolution in ('approved','edited_approved','keep_current','deferred')),
  auto_enrolled boolean not null default false,
  error_state jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  paused_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists reset_enrollments_source_onboarding_uq
  on public.reset_enrollments(source_onboarding_session_id)
  where source_onboarding_session_id is not null;
create unique index if not exists reset_enrollments_one_open_uq
  on public.reset_enrollments(user_id)
  where status in ('pending','active','paused','awaiting_weekly_review');
create index if not exists reset_enrollments_user_created_idx on public.reset_enrollments(user_id, created_at desc);

create table if not exists public.reset_daily_snapshots (
  id uuid primary key default uuid_generate_v4(),
  enrollment_id uuid not null references public.reset_enrollments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  local_date date not null,
  timezone text not null,
  reset_day smallint not null check (reset_day between 1 and 7),
  context_version text,
  score_version text not null default 'progression-v1',
  planned_actions jsonb not null default '[]'::jsonb,
  priority_action_keys text[] not null default '{}'::text[],
  minimum_day_action_keys text[] not null default '{}'::text[],
  estimated_minutes integer not null default 0 check (estimated_minutes >= 0),
  morning_summary jsonb not null default '{}'::jsonb,
  day_status text not null default 'available' check (day_status in ('upcoming','available','in_progress','closed','partially_closed','missed','recovered')),
  created_at timestamptz not null default now(),
  last_rebuilt_at timestamptz
);

create unique index if not exists reset_daily_snapshots_enrollment_date_uq on public.reset_daily_snapshots(enrollment_id, local_date);
create index if not exists reset_daily_snapshots_user_date_idx on public.reset_daily_snapshots(user_id, local_date desc);

create table if not exists public.reset_daily_closures (
  id uuid primary key default uuid_generate_v4(),
  enrollment_id uuid not null references public.reset_enrollments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  local_date date not null,
  eligible_actions jsonb not null default '[]'::jsonb,
  eligible_count integer not null default 0 check (eligible_count >= 0),
  completed_count integer not null default 0 check (completed_count >= 0),
  partial_count integer not null default 0 check (partial_count >= 0),
  skipped_count integer not null default 0 check (skipped_count >= 0),
  blocked_count integer not null default 0 check (blocked_count >= 0),
  rescheduled_count integer not null default 0 check (rescheduled_count >= 0),
  completion_percentage numeric(5,2) check (completion_percentage between 0 and 100),
  data_quality text not null default 'complete' check (data_quality in ('complete','partial','no_eligible_actions')),
  main_blocker text,
  user_reflection jsonb not null default '{}'::jsonb,
  coach_summary text,
  tomorrow_preview jsonb not null default '{}'::jsonb,
  evening_summary jsonb not null default '{}'::jsonb,
  starting_score integer check (starting_score between 0 and 100),
  closing_score integer check (closing_score between 0 and 100),
  closed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists reset_daily_closures_enrollment_date_uq on public.reset_daily_closures(enrollment_id, local_date);
create index if not exists reset_daily_closures_user_date_idx on public.reset_daily_closures(user_id, local_date desc);

create table if not exists public.reset_patterns (
  id uuid primary key default uuid_generate_v4(),
  enrollment_id uuid not null references public.reset_enrollments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  pattern_key text not null,
  pattern_type text not null,
  domain text,
  summary text not null,
  supporting_evidence jsonb not null default '{}'::jsonb,
  observation_count integer not null default 0 check (observation_count >= 0),
  confidence numeric(4,3) not null default 0 check (confidence between 0 and 1),
  first_detected_date date not null,
  last_observed_date date not null,
  user_feedback text check (user_feedback in ('yes','partly','no','need_more_time')),
  status text not null default 'candidate' check (status in ('candidate','surfaced','confirmed','rejected','expired')),
  source_context_version text,
  why_it_matters text,
  proposed_adjustment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists reset_patterns_enrollment_key_uq on public.reset_patterns(enrollment_id, pattern_key);
create index if not exists reset_patterns_user_status_idx on public.reset_patterns(user_id, status, last_observed_date desc);

alter table public.weekly_reviews add column if not exists source text not null default 'coach';
alter table public.weekly_reviews add column if not exists source_key text;
alter table public.weekly_reviews add column if not exists details jsonb not null default '{}'::jsonb;
alter table public.weekly_reviews add column if not exists opened_at timestamptz;
alter table public.weekly_reviews add column if not exists next_week_resolution text;
alter table public.weekly_reviews add column if not exists user_reflection jsonb not null default '{}'::jsonb;
create unique index if not exists weekly_reviews_user_source_key_uq on public.weekly_reviews(user_id, source_key) where source_key is not null;

alter table public.reset_enrollments enable row level security;
alter table public.reset_daily_snapshots enable row level security;
alter table public.reset_daily_closures enable row level security;
alter table public.reset_patterns enable row level security;

drop policy if exists "users read own reset enrollments" on public.reset_enrollments;
create policy "users read own reset enrollments" on public.reset_enrollments for select using (auth.uid() = user_id);
drop policy if exists "users insert own reset enrollments" on public.reset_enrollments;
create policy "users insert own reset enrollments" on public.reset_enrollments for insert with check (auth.uid() = user_id);
drop policy if exists "users update own reset enrollments" on public.reset_enrollments;
create policy "users update own reset enrollments" on public.reset_enrollments for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "users read own reset snapshots" on public.reset_daily_snapshots;
create policy "users read own reset snapshots" on public.reset_daily_snapshots for select using (auth.uid() = user_id);
drop policy if exists "users insert own reset snapshots" on public.reset_daily_snapshots;
create policy "users insert own reset snapshots" on public.reset_daily_snapshots for insert with check (auth.uid() = user_id);
drop policy if exists "users update own reset snapshots" on public.reset_daily_snapshots;
create policy "users update own reset snapshots" on public.reset_daily_snapshots for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "users read own reset closures" on public.reset_daily_closures;
create policy "users read own reset closures" on public.reset_daily_closures for select using (auth.uid() = user_id);
drop policy if exists "users insert own reset closures" on public.reset_daily_closures;
create policy "users insert own reset closures" on public.reset_daily_closures for insert with check (auth.uid() = user_id);
drop policy if exists "users update own reset closures" on public.reset_daily_closures;
create policy "users update own reset closures" on public.reset_daily_closures for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "users read own reset patterns" on public.reset_patterns;
create policy "users read own reset patterns" on public.reset_patterns for select using (auth.uid() = user_id);
drop policy if exists "users insert own reset patterns" on public.reset_patterns;
create policy "users insert own reset patterns" on public.reset_patterns for insert with check (auth.uid() = user_id);
drop policy if exists "users update own reset patterns" on public.reset_patterns;
create policy "users update own reset patterns" on public.reset_patterns for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Safe, narrow Reset AI Operations visibility. User-facing agent always remains Coach.
drop policy if exists "users insert own reset ai runs" on public.ai_agent_runs;
create policy "users insert own reset ai runs" on public.ai_agent_runs for insert with check (
  requested_by = auth.uid() and run_type = 'reset_retention' and agent_key = 'orchestrator'
  and coalesce(metadata->>'surface','') = 'reset'
  and coalesce(metadata->>'user_facing_agent','') = 'coach'
);
drop policy if exists "users read own reset ai runs" on public.ai_agent_runs;
create policy "users read own reset ai runs" on public.ai_agent_runs for select using (
  requested_by = auth.uid() and run_type = 'reset_retention' and agent_key = 'orchestrator'
);
drop policy if exists "users update own reset ai runs" on public.ai_agent_runs;
create policy "users update own reset ai runs" on public.ai_agent_runs for update using (
  requested_by = auth.uid() and run_type = 'reset_retention' and agent_key = 'orchestrator'
) with check (
  requested_by = auth.uid() and run_type = 'reset_retention' and agent_key = 'orchestrator'
);

create or replace function public.begin_reset_ai_operation(p_title text, p_operation text, p_metadata jsonb default '{}'::jsonb)
returns bigint
language plpgsql
set search_path to 'public','pg_temp'
as $$
declare v_user uuid := auth.uid(); v_id bigint;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  insert into public.ai_agent_runs(agent_key,requested_by,run_type,title,status,metadata,started_at)
  values(
    'orchestrator', v_user, 'reset_retention', left(coalesce(p_title,'Project You+ Reset'),180), 'running',
    jsonb_build_object('surface','reset','user_facing_agent','coach','operation',left(coalesce(p_operation,'unknown'),80)) || coalesce(p_metadata,'{}'::jsonb), now()
  ) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.finish_reset_ai_operation(p_run_id bigint, p_status text, p_summary text, p_metadata jsonb default '{}'::jsonb)
returns void
language plpgsql
set search_path to 'public','pg_temp'
as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_status not in ('passed','failed','blocked') then raise exception 'Invalid status'; end if;
  update public.ai_agent_runs
  set status=p_status, summary=left(coalesce(p_summary,''),1000), metadata=coalesce(metadata,'{}'::jsonb)||coalesce(p_metadata,'{}'::jsonb), finished_at=now()
  where id=p_run_id and requested_by=v_user and run_type='reset_retention' and agent_key='orchestrator';
end;
$$;

revoke all on function public.begin_reset_ai_operation(text,text,jsonb) from public, anon;
revoke all on function public.finish_reset_ai_operation(bigint,text,text,jsonb) from public, anon;
grant execute on function public.begin_reset_ai_operation(text,text,jsonb) to authenticated;
grant execute on function public.finish_reset_ai_operation(bigint,text,text,jsonb) to authenticated;

-- Extend meaningful event types with Reset lifecycle events while preserving existing values.
alter table public.behavior_events drop constraint if exists behavior_events_event_type_check;
alter table public.behavior_events add constraint behavior_events_event_type_check check (event_type = any (array[
  'task.completed','task.missed','habit.completed','habit.missed','workout.completed','workout.missed','meal.logged','supplement.completed','calendar.changed','spending.threshold','goal.progress_changed','score.changed','achievement.unlocked','milestone.unlocked','first_week.completed','pattern.discovered','workout.plan_activated','workout.schedule_changed','finance.goal_created','finance.goal_completed','finance.account_synced','finance.transaction_synced','finance.budget_changed','finance.bill_changed','progression.personal_best','progression.one_percent_earned','onboarding.completed',
  'reset.started','reset.day_closed','reset.minimum_day_used','reset.returned','reset.pattern_detected','reset.pattern_confirmed','reset.pattern_rejected','reset.adjustment_proposed','reset.adjustment_approved','reset.weekly_review_completed','reset.completed'
]::text[]));

create or replace function public.append_reset_behavior_event(p_enrollment_id uuid, p_event_type text, p_payload jsonb default '{}'::jsonb, p_dedupe_key text default null)
returns uuid
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $$
declare v_user uuid := auth.uid(); v_id uuid;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_event_type not in ('reset.started','reset.day_closed','reset.minimum_day_used','reset.returned','reset.pattern_detected','reset.pattern_confirmed','reset.pattern_rejected','reset.adjustment_proposed','reset.adjustment_approved','reset.weekly_review_completed','reset.completed') then
    raise exception 'Invalid Reset event type';
  end if;
  if not exists(select 1 from public.reset_enrollments where id=p_enrollment_id and user_id=v_user) then
    raise exception 'Reset enrollment not found';
  end if;
  insert into public.behavior_events(user_id,event_type,occurred_at,source_table,source_id,payload,dedupe_key)
  values(v_user,p_event_type,now(),'reset_enrollments',p_enrollment_id,coalesce(p_payload,'{}'::jsonb),p_dedupe_key)
  on conflict (user_id,dedupe_key) do nothing
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.append_reset_behavior_event(uuid,text,jsonb,text) from public, anon;
grant execute on function public.append_reset_behavior_event(uuid,text,jsonb,text) to authenticated;

-- Auto-queue only true first-time onboarding completions. Re-personalization never forces a Reset.
create or replace function private.queue_reset_after_onboarding()
returns trigger
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $$
begin
  if new.mode = 'initial'
     and new.status = 'completed'
     and new.activated_at is not null
     and (old.status is distinct from new.status or old.activated_at is distinct from new.activated_at)
     and exists(select 1 from public.tasks t where t.user_id=new.user_id and t.completed_at is null)
  then
    insert into public.reset_enrollments(user_id,reset_version,source_onboarding_session_id,timezone,status,auto_enrolled)
    select new.user_id,'2026-09-reset-v1',new.id,coalesce(p.timezone,'UTC'),'pending',true
    from public.profiles p where p.id=new.user_id
    on conflict (source_onboarding_session_id) where source_onboarding_session_id is not null do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists onboarding_queue_seven_day_reset on public.onboarding_sessions;
create trigger onboarding_queue_seven_day_reset
after update of status, activated_at on public.onboarding_sessions
for each row execute function private.queue_reset_after_onboarding();

-- Privacy-safe product analytics use the existing activity_events table.
create or replace function public.track_reset_activity(p_event_name text, p_metadata jsonb default '{}'::jsonb)
returns uuid
language plpgsql
set search_path to 'public','pg_temp'
as $$
declare v_user uuid := auth.uid(); v_id uuid; v_safe jsonb;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_event_name not in ('reset_started','reset_day_viewed','reset_day_closed','reset_recovery_viewed','reset_pattern_reviewed','reset_adjustment_reviewed','reset_weekly_review_opened','reset_completed') then
    raise exception 'Invalid Reset analytics event';
  end if;
  v_safe := jsonb_strip_nulls(jsonb_build_object(
    'reset_day', p_metadata->'reset_day',
    'status', p_metadata->'status',
    'completion_bucket', p_metadata->'completion_bucket',
    'action_count', p_metadata->'action_count',
    'device_class', p_metadata->'device_class',
    'reset_version', coalesce(p_metadata->'reset_version', to_jsonb('2026-09-reset-v1'::text))
  ));
  insert into public.activity_events(user_id,event_name,path,metadata,occurred_at)
  values(v_user,p_event_name,'/reset',v_safe,now()) returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.track_reset_activity(text,jsonb) from public, anon;
grant execute on function public.track_reset_activity(text,jsonb) to authenticated;
