-- Project You+ production onboarding v2
-- Resumable draft state, canonical provenance, recurring commitments,
-- Weekly Review settings, and transactional/idempotent activation.

alter table public.profiles
  add column if not exists onboarding_status text not null default 'not_started',
  add column if not exists onboarding_version text,
  add column if not exists onboarding_completed_at timestamptz;

alter table public.goals add column if not exists source text not null default 'manual';
alter table public.goals add column if not exists source_key text;
alter table public.habits add column if not exists source text not null default 'manual';
alter table public.habits add column if not exists source_key text;
alter table public.tasks add column if not exists source text not null default 'manual';
alter table public.tasks add column if not exists source_key text;
alter table public.work_schedules add column if not exists source text not null default 'manual';
alter table public.work_schedules add column if not exists source_key text;
alter table public.reminders add column if not exists source text not null default 'manual';
alter table public.reminders add column if not exists source_key text;
alter table public.workout_plans add column if not exists source_key text;

create unique index if not exists goals_user_source_key_uq on public.goals(user_id, source_key) where source_key is not null;
create unique index if not exists habits_user_source_key_uq on public.habits(user_id, source_key) where source_key is not null;
create unique index if not exists tasks_user_source_key_uq on public.tasks(user_id, source_key) where source_key is not null;
create unique index if not exists work_schedules_user_source_key_uq on public.work_schedules(user_id, source_key) where source_key is not null;
create unique index if not exists reminders_user_source_key_uq on public.reminders(user_id, source_key) where source_key is not null;
create unique index if not exists workout_plans_user_source_key_uq on public.workout_plans(user_id, source_key) where source_key is not null;

create table if not exists public.onboarding_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  onboarding_version text not null default '2026-09-v2',
  mode text not null default 'initial' check (mode in ('initial','personalize')),
  status text not null default 'not_started' check (status in ('not_started','in_progress','generating','awaiting_confirmation','completed','failed')),
  current_stage text not null default 'intro',
  last_completed_stage text,
  answers jsonb not null default '{}'::jsonb,
  generated_plan jsonb,
  generation_state jsonb not null default '{"overall":"idle","modules":{}}'::jsonb,
  proposal_version integer not null default 0,
  proposal_status text not null default 'none' check (proposal_status in ('none','draft','edited','stale','confirmed')),
  activation_key uuid not null default gen_random_uuid(),
  activated_records jsonb not null default '{}'::jsonb,
  error_code text,
  error_message text,
  generation_attempts integer not null default 0,
  last_generation_at timestamptz,
  last_confirmation_at timestamptz,
  started_at timestamptz not null default now(),
  last_saved_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists onboarding_sessions_one_active_per_version
  on public.onboarding_sessions(user_id, onboarding_version)
  where status in ('not_started','in_progress','generating','awaiting_confirmation','failed');
create index if not exists onboarding_sessions_user_recent_idx on public.onboarding_sessions(user_id, updated_at desc);

alter table public.onboarding_sessions enable row level security;
drop policy if exists onboarding_sessions_isolation on public.onboarding_sessions;
create policy onboarding_sessions_isolation on public.onboarding_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update, delete on public.onboarding_sessions to authenticated;

create table if not exists public.recurring_commitments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  days_of_week smallint[] not null default '{}'::smallint[],
  start_time time not null,
  end_time time not null,
  frequency text not null default 'weekly' check (frequency in ('weekly','biweekly','monthly','custom')),
  active boolean not null default true,
  source text not null default 'manual',
  source_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (cardinality(days_of_week) <= 7)
);
create unique index if not exists recurring_commitments_user_source_key_uq on public.recurring_commitments(user_id, source_key) where source_key is not null;
create index if not exists recurring_commitments_user_active_idx on public.recurring_commitments(user_id, active);
alter table public.recurring_commitments enable row level security;
drop policy if exists recurring_commitments_isolation on public.recurring_commitments;
create policy recurring_commitments_isolation on public.recurring_commitments
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update, delete on public.recurring_commitments to authenticated;

create table if not exists public.weekly_review_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  time_of_day time not null,
  reminders_enabled boolean not null default false,
  active boolean not null default true,
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.weekly_review_settings enable row level security;
drop policy if exists weekly_review_settings_isolation on public.weekly_review_settings;
create policy weekly_review_settings_isolation on public.weekly_review_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update, delete on public.weekly_review_settings to authenticated;

-- Existing users with real product data are considered established and are not forced through onboarding v2.
update public.profiles p
set onboarding_completed = true,
    onboarding_status = 'completed',
    onboarding_version = coalesce(p.onboarding_version, 'legacy'),
    onboarding_completed_at = coalesce(p.onboarding_completed_at, p.created_at, now())
where coalesce(p.onboarding_completed, false)
   or exists (select 1 from public.goals g where g.user_id = p.id)
   or exists (select 1 from public.habits h where h.user_id = p.id)
   or exists (select 1 from public.tasks t where t.user_id = p.id)
   or exists (select 1 from public.work_schedules w where w.user_id = p.id)
   or exists (select 1 from public.workout_plans wp where wp.user_id = p.id);

create or replace function public.activate_onboarding_system(p_session_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_session public.onboarding_sessions%rowtype;
  v_plan jsonb;
  v_answers jsonb;
  v_item jsonb;
  v_goal_id uuid;
  v_goal_map jsonb := '{}'::jsonb;
  v_goal_ids jsonb := '[]'::jsonb;
  v_habit_ids jsonb := '[]'::jsonb;
  v_task_ids jsonb := '[]'::jsonb;
  v_work_schedule_ids jsonb := '[]'::jsonb;
  v_commitment_ids jsonb := '[]'::jsonb;
  v_workout_plan_id uuid;
  v_weekly_review_saved boolean := false;
  v_days int[];
  v_days_small smallint[];
  v_title text;
  v_client_id text;
  v_goal_client_id text;
  v_existing uuid;
  v_work jsonb;
  v_health jsonb;
  v_finance jsonb;
  v_coaching jsonb;
  v_review jsonb;
  v_tz text;
  v_due_today timestamptz;
  v_result jsonb;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;

  select * into v_session from public.onboarding_sessions
   where id = p_session_id and user_id = v_user_id
   for update;
  if not found then raise exception 'Onboarding session not found'; end if;

  if v_session.status = 'completed' then
    return v_session.activated_records;
  end if;
  if v_session.status <> 'awaiting_confirmation' or v_session.proposal_status not in ('draft','edited') then
    raise exception 'Onboarding proposal is not ready for confirmation';
  end if;

  v_plan := coalesce(v_session.generated_plan, '{}'::jsonb);
  v_answers := coalesce(v_session.answers, '{}'::jsonb);
  if jsonb_typeof(v_plan->'goals') <> 'array' or jsonb_array_length(v_plan->'goals') < 1 then
    raise exception 'At least one confirmed goal is required';
  end if;
  if coalesce(v_answers#>>'{direction,primaryDomain}','') = '' then raise exception 'Primary direction is required'; end if;
  if coalesce(v_answers#>>'{coaching,style}','') = '' then raise exception 'Coaching style is required'; end if;
  if coalesce(v_plan#>>'{weeklyReview,time}','') = '' then raise exception 'Weekly Review preference is required'; end if;

  insert into public.profiles(id, onboarding_completed, onboarding_status)
  values(v_user_id, false, 'in_progress') on conflict (id) do nothing;

  select coalesce(timezone,'UTC') into v_tz from public.profiles where id=v_user_id;
  begin
    v_due_today := timezone(coalesce(v_tz,'UTC'), ((timezone(coalesce(v_tz,'UTC'), now()))::date + time '23:00'));
  exception when others then
    v_due_today := now() + interval '8 hours';
  end;

  for v_item in select value from jsonb_array_elements(v_plan->'goals') loop
    v_title := left(trim(coalesce(v_item->>'title','')), 180);
    if v_title = '' then continue; end if;
    v_client_id := coalesce(v_item->>'clientId', md5(lower(v_title)));
    select id into v_existing from public.goals
      where user_id=v_user_id and status='active' and lower(trim(title))=lower(v_title)
      order by created_at asc limit 1;
    if v_existing is null then
      insert into public.goals(user_id,title,category,target,deadline,progress,objective_90day,status,source,source_key)
      values(
        v_user_id,
        v_title,
        case lower(coalesce(v_item->>'domain','custom')) when 'health' then 'health' when 'money' then 'finance' when 'finance' then 'finance' when 'career' then 'career' when 'business' then 'custom' else 'custom' end,
        nullif(left(trim(coalesce(v_item->>'measurableTarget','')),250),''),
        case when coalesce(v_item->>'targetDate','') ~ '^\d{4}-\d{2}-\d{2}$' then (v_item->>'targetDate')::date else null end,
        0,
        nullif(left(trim(coalesce(v_item->>'desiredOutcome','')),500),''),
        'active','onboarding','onboarding:goal:'||md5(lower(v_title))
      )
      on conflict (user_id, source_key) where source_key is not null
      do update set title=excluded.title,category=excluded.category,target=excluded.target,deadline=excluded.deadline,objective_90day=excluded.objective_90day,updated_at=now()
      returning id into v_goal_id;
    else
      v_goal_id := v_existing;
    end if;
    v_goal_map := v_goal_map || jsonb_build_object(v_client_id, v_goal_id::text);
    v_goal_ids := v_goal_ids || jsonb_build_array(v_goal_id);
    v_existing := null;
  end loop;

  for v_item in select value from jsonb_array_elements(coalesce(v_plan->'habits','[]'::jsonb)) loop
    v_title := left(trim(coalesce(v_item->>'title','')),180);
    if v_title='' then continue; end if;
    v_goal_client_id := coalesce(v_item->>'goalClientId','');
    v_goal_id := null;
    if v_goal_client_id<>'' and v_goal_map ? v_goal_client_id then v_goal_id := (v_goal_map->>v_goal_client_id)::uuid; end if;
    select id into v_existing from public.habits where user_id=v_user_id and lower(trim(title))=lower(v_title) order by created_at asc limit 1;
    if v_existing is null then
      insert into public.habits(user_id,title,target_frequency,goal_id,source,source_key)
      values(v_user_id,v_title,
        case lower(coalesce(v_item->>'frequency','daily')) when 'weekly' then 'weekly' when 'n_per_week' then 'n_per_week' else 'daily' end,
        v_goal_id,'onboarding','onboarding:habit:'||md5(lower(v_title)))
      on conflict (user_id, source_key) where source_key is not null
      do update set goal_id=coalesce(excluded.goal_id,public.habits.goal_id),target_frequency=excluded.target_frequency
      returning id into v_existing;
    end if;
    v_habit_ids := v_habit_ids || jsonb_build_array(v_existing);
    v_existing := null;
  end loop;

  for v_item in select value from jsonb_array_elements(coalesce(v_plan->'priorities','[]'::jsonb)) loop
    v_title := left(trim(coalesce(v_item->>'title','')),220);
    if v_title='' then continue; end if;
    v_goal_client_id := coalesce(v_item->>'goalClientId','');
    v_goal_id := null;
    if v_goal_client_id<>'' and v_goal_map ? v_goal_client_id then v_goal_id := (v_goal_map->>v_goal_client_id)::uuid; end if;
    select id into v_existing from public.tasks where user_id=v_user_id and completed_at is null and lower(trim(title))=lower(v_title) order by created_at asc limit 1;
    if v_existing is null then
      insert into public.tasks(user_id,goal_id,title,tier,due_at,ai_prioritized,source,source_key)
      values(v_user_id,v_goal_id,v_title,'important',case when coalesce(v_item->>'dueWindow','today')='today' then v_due_today else null end,true,'onboarding','onboarding:task:'||md5(lower(v_title)))
      on conflict (user_id, source_key) where source_key is not null
      do update set goal_id=coalesce(excluded.goal_id,public.tasks.goal_id),tier='important',ai_prioritized=true
      returning id into v_existing;
    end if;
    v_task_ids := v_task_ids || jsonb_build_array(v_existing);
    v_existing := null;
  end loop;

  v_work := v_answers#>'{life,work}';
  if coalesce(v_work->>'type','')='fixed' then
    select coalesce(array_agg(value::int),'{}'::int[]) into v_days from jsonb_array_elements_text(coalesce(v_work->'days','[]'::jsonb));
    insert into public.work_schedules(user_id,label,days_of_week,start_time,end_time,active,source,source_key)
    values(v_user_id,'Work',v_days,(v_work->>'startTime')::time,(v_work->>'endTime')::time,true,'onboarding','onboarding:work')
    on conflict (user_id, source_key) where source_key is not null
    do update set days_of_week=excluded.days_of_week,start_time=excluded.start_time,end_time=excluded.end_time,active=true,updated_at=now()
    returning id into v_existing;
    v_work_schedule_ids := jsonb_build_array(v_existing);
  end if;

  for v_item in select value from jsonb_array_elements(coalesce(v_answers#>'{life,commitments}','[]'::jsonb)) loop
    v_title := left(trim(coalesce(v_item->>'label','')),160);
    if v_title='' then continue; end if;
    select coalesce(array_agg(value::smallint),'{}'::smallint[]) into v_days_small from jsonb_array_elements_text(coalesce(v_item->'days','[]'::jsonb));
    insert into public.recurring_commitments(user_id,label,days_of_week,start_time,end_time,frequency,active,source,source_key)
    values(v_user_id,v_title,v_days_small,(v_item->>'startTime')::time,(v_item->>'endTime')::time,
      case when coalesce(v_item->>'frequency','weekly') in ('weekly','biweekly','monthly','custom') then v_item->>'frequency' else 'weekly' end,
      true,'onboarding','onboarding:commitment:'||md5(lower(v_title)))
    on conflict (user_id, source_key) where source_key is not null
    do update set days_of_week=excluded.days_of_week,start_time=excluded.start_time,end_time=excluded.end_time,frequency=excluded.frequency,active=true,updated_at=now()
    returning id into v_existing;
    v_commitment_ids := v_commitment_ids || jsonb_build_array(v_existing);
  end loop;

  v_health := v_answers->'health';
  if coalesce((v_health->>'included')::boolean,false) and v_plan->'healthPlan' is not null and jsonb_typeof(v_plan->'healthPlan')='object' then
    v_item := v_plan->'healthPlan';
    insert into public.workout_plans(user_id,title,goal,days_per_week,session_minutes,experience,schedule,active,source,source_key)
    values(v_user_id,left(coalesce(v_item->>'title','Project You+ starting plan'),180),left(coalesce(v_item->>'goal','General health'),180),
      greatest(1,least(7,coalesce((v_item->>'daysPerWeek')::int,3))),greatest(10,least(180,coalesce((v_item->>'sessionMinutes')::int,45))),
      case when lower(coalesce(v_item->>'experience','beginner')) in ('beginner','intermediate','advanced','returning') then lower(v_item->>'experience') else 'beginner' end,
      coalesce(v_item->'schedule','[]'::jsonb),true,'project_you','onboarding:health-plan')
    on conflict (user_id, source_key) where source_key is not null
    do update set title=excluded.title,goal=excluded.goal,days_per_week=excluded.days_per_week,session_minutes=excluded.session_minutes,experience=excluded.experience,schedule=excluded.schedule,active=true,schedule_history=coalesce(public.workout_plans.schedule_history,'[]'::jsonb)||jsonb_build_array(jsonb_build_object('changed_at',now(),'schedule',public.workout_plans.schedule))
    returning id into v_workout_plan_id;
  end if;

  v_finance := v_plan->'financialFocus';
  if v_finance is not null and jsonb_typeof(v_finance)='object' and coalesce(trim(v_finance->>'action'),'')<>'' then
    v_title := left(trim(v_finance->>'action'),220);
    select id into v_existing from public.tasks where user_id=v_user_id and completed_at is null and lower(trim(title))=lower(v_title) order by created_at asc limit 1;
    if v_existing is null then
      insert into public.tasks(user_id,title,tier,due_at,ai_prioritized,source,source_key)
      values(v_user_id,v_title,'important',v_due_today,true,'onboarding','onboarding:finance:'||md5(lower(v_title)))
      on conflict (user_id, source_key) where source_key is not null do update set tier='important',ai_prioritized=true
      returning id into v_existing;
      v_task_ids := v_task_ids || jsonb_build_array(v_existing);
    end if;
    v_existing := null;
  end if;

  v_review := v_plan->'weeklyReview';
  insert into public.weekly_review_settings(user_id,day_of_week,time_of_day,reminders_enabled,active,source,updated_at)
  values(v_user_id,(v_review->>'day')::smallint,(v_review->>'time')::time,coalesce((v_review->>'reminderIntent')::boolean,false),true,'onboarding',now())
  on conflict (user_id) do update set day_of_week=excluded.day_of_week,time_of_day=excluded.time_of_day,reminders_enabled=excluded.reminders_enabled,active=true,source='onboarding',updated_at=now();
  v_weekly_review_saved := true;

  if coalesce((v_review->>'reminderIntent')::boolean,false) then
    insert into public.reminders(user_id,target_type,title,time_of_day,days_of_week,recurrence,channel,enabled,source,source_key)
    values(v_user_id,'weekly_review','Weekly Review',(v_review->>'time')::time,array[(v_review->>'day')::smallint],'weekly','in_app',true,'onboarding','onboarding:weekly-review')
    on conflict (user_id, source_key) where source_key is not null
    do update set time_of_day=excluded.time_of_day,days_of_week=excluded.days_of_week,recurrence='weekly',enabled=true,updated_at=now();
  else
    update public.reminders set enabled=false,updated_at=now() where user_id=v_user_id and source_key='onboarding:weekly-review';
  end if;

  v_coaching := v_answers->'coaching';
  update public.profiles
  set onboarding_completed=true,
      onboarding_status='completed',
      onboarding_version=v_session.onboarding_version,
      onboarding_completed_at=now(),
      blueprint=coalesce(blueprint,'{}'::jsonb) || jsonb_build_object(
        'priorities', coalesce(v_answers#>'{direction,domains}','[]'::jsonb),
        'goals', coalesce((select jsonb_agg(value->>'title') from jsonb_array_elements(v_plan->'goals')),'[]'::jsonb),
        'coachingStyle', jsonb_build_array(v_coaching->>'style'),
        'onboarding', jsonb_build_object(
          'version',v_session.onboarding_version,
          'selectedDomains',coalesce(v_answers#>'{direction,domains}','[]'::jsonb),
          'primaryDomain',v_answers#>>'{direction,primaryDomain}',
          'frictionCategories',coalesce(v_answers#>'{friction,categories}','[]'::jsonb),
          'frictionNote',nullif(v_answers#>>'{friction,note}',''),
          'lifeStructure',coalesce(v_answers->'life','{}'::jsonb),
          'healthPreferences',coalesce(v_answers->'health','{}'::jsonb),
          'financePreferences',coalesce(v_answers->'finance','{}'::jsonb),
          'coachingPreferences',coalesce(v_answers->'coaching','{}'::jsonb),
          'weeklyReview',v_review,
          'confidence','provisional',
          'completeness','onboarding_confirmed',
          'activatedAt',now()
        )
      )
  where id=v_user_id;

  v_result := jsonb_build_object(
    'goals',v_goal_ids,
    'habits',v_habit_ids,
    'tasks',v_task_ids,
    'workSchedules',v_work_schedule_ids,
    'recurringCommitments',v_commitment_ids,
    'workoutPlan',case when v_workout_plan_id is null then null else to_jsonb(v_workout_plan_id) end,
    'weeklyReviewSaved',v_weekly_review_saved
  );

  update public.onboarding_sessions
  set status='completed',proposal_status='confirmed',activated_records=v_result,last_confirmation_at=now(),completed_at=now(),error_code=null,error_message=null,updated_at=now(),last_saved_at=now()
  where id=p_session_id;

  perform public.append_behavior_event(
    v_user_id,
    'onboarding.completed',
    'onboarding.completed:'||p_session_id::text,
    'onboarding_sessions',
    p_session_id::text,
    now(),
    jsonb_build_object(
      'onboarding_version',v_session.onboarding_version,
      'primary_domain',v_answers#>>'{direction,primaryDomain}',
      'selected_domain_count',jsonb_array_length(coalesce(v_answers#>'{direction,domains}','[]'::jsonb)),
      'goal_count',jsonb_array_length(v_plan->'goals'),
      'health_included',coalesce((v_answers#>>'{health,included}')::boolean,false),
      'finance_deferred',coalesce((v_answers#>>'{finance,deferred}')::boolean,false),
      'coaching_style',v_answers#>>'{coaching,style}',
      'weekly_review_day',v_review->>'day'
    )
  );

  return v_result;
end;
$$;

grant execute on function public.activate_onboarding_system(uuid) to authenticated;
