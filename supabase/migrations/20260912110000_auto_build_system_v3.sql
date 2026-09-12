-- Project You+ Auto-Build My System v3
-- Extends production onboarding v2 without creating a parallel onboarding/AI data model.

alter table public.onboarding_sessions
  add column if not exists source_context_version text,
  add column if not exists generator_version text,
  add column if not exists proposal_confidence text,
  add column if not exists missing_information jsonb not null default '[]'::jsonb,
  add column if not exists validation_results jsonb not null default '{}'::jsonb,
  add column if not exists activation_state jsonb not null default '{"overall":"idle","steps":{}}'::jsonb,
  add column if not exists original_generated_plan jsonb,
  add column if not exists approved_at timestamptz,
  add column if not exists activated_at timestamptz;

alter table public.onboarding_sessions drop constraint if exists onboarding_sessions_proposal_status_check;
alter table public.onboarding_sessions add constraint onboarding_sessions_proposal_status_check
  check (proposal_status in ('none','draft','edited','stale','confirmed','approved','activating','active','superseded','failed'));

alter table public.habits
  add column if not exists domain text,
  add column if not exists preferred_days smallint[] not null default '{}'::smallint[],
  add column if not exists preferred_time time,
  add column if not exists duration_minutes integer,
  add column if not exists trigger_text text,
  add column if not exists minimum_version text,
  add column if not exists recovery_rule text,
  add column if not exists evidence_type text,
  add column if not exists starting_difficulty text,
  add column if not exists target_per_week integer;

alter table public.tasks
  add column if not exists domain text,
  add column if not exists action_kind text,
  add column if not exists preferred_days smallint[] not null default '{}'::smallint[],
  add column if not exists preferred_time time,
  add column if not exists duration_minutes integer,
  add column if not exists trigger_text text,
  add column if not exists minimum_version text,
  add column if not exists recovery_rule text,
  add column if not exists evidence_type text,
  add column if not exists schedule_flexibility text;

create table if not exists public.goal_milestones (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid not null references public.goals(id) on delete cascade, title text not null, target_value numeric, unit text, target_date date,
  sort_order integer not null default 1, status text not null default 'pending' check (status in ('pending','completed','skipped')),
  source text not null default 'manual', source_key text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index if not exists goal_milestones_user_source_key_uq on public.goal_milestones(user_id,source_key) where source_key is not null;
create index if not exists goal_milestones_goal_idx on public.goal_milestones(goal_id,sort_order);
alter table public.goal_milestones enable row level security;
drop policy if exists goal_milestones_isolation on public.goal_milestones;
create policy goal_milestones_isolation on public.goal_milestones for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
grant select,insert,update,delete on public.goal_milestones to authenticated;

create table if not exists public.goal_metrics (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid not null references public.goals(id) on delete cascade, name text not null, unit text not null,
  direction text not null check (direction in ('increase','decrease','maintain','complete')),
  metric_type text not null check (metric_type in ('outcome','leading')),
  entry_frequency text not null check (entry_frequency in ('daily','weekly','monthly','event')), data_source text not null,
  baseline numeric, target_value numeric, target_label text, needs_confirmation boolean not null default false,
  active boolean not null default true, source text not null default 'manual', source_key text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index if not exists goal_metrics_user_source_key_uq on public.goal_metrics(user_id,source_key) where source_key is not null;
create index if not exists goal_metrics_goal_idx on public.goal_metrics(goal_id,active);
alter table public.goal_metrics enable row level security;
drop policy if exists goal_metrics_isolation on public.goal_metrics;
create policy goal_metrics_isolation on public.goal_metrics for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
grant select,insert,update,delete on public.goal_metrics to authenticated;

create unique index if not exists activity_events_first_today_action_completed_once_uq on public.activity_events(user_id,event_name) where event_name='first_today_action_completed';
create or replace function public.capture_first_today_onboarding_action() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_user_id uuid;
begin
  if tg_table_name='tasks' then if new.completed_at is null or old.completed_at is not null then return new; end if; v_user_id:=new.user_id;
  elsif tg_table_name='habit_logs' then v_user_id:=new.user_id;
  elsif tg_table_name='workouts' then v_user_id:=new.user_id; else return new; end if;
  if not exists(select 1 from public.profiles p where p.id=v_user_id and p.onboarding_completed=true) then return new; end if;
  insert into public.activity_events(user_id,event_name,path,metadata) values(v_user_id,'first_today_action_completed','/today',jsonb_build_object('stage','today','completion_status','completed','source','onboarding_system'))
  on conflict (user_id,event_name) where event_name='first_today_action_completed' do nothing;
  return new;
end;$$;
revoke all on function public.capture_first_today_onboarding_action() from public,anon,authenticated;
drop trigger if exists onboarding_first_today_task_completed on public.tasks;
create trigger onboarding_first_today_task_completed after update of completed_at on public.tasks for each row execute function public.capture_first_today_onboarding_action();
drop trigger if exists onboarding_first_today_habit_completed on public.habit_logs;
create trigger onboarding_first_today_habit_completed after insert on public.habit_logs for each row execute function public.capture_first_today_onboarding_action();
drop trigger if exists onboarding_first_today_workout_completed on public.workouts;
create trigger onboarding_first_today_workout_completed after insert on public.workouts for each row execute function public.capture_first_today_onboarding_action();

create or replace function public.activate_onboarding_system_v3(p_session_id uuid)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare
  v_user_id uuid:=auth.uid(); v_session public.onboarding_sessions%rowtype; v_plan jsonb; v_answers jsonb; v_result jsonb;
  v_item jsonb; v_metric jsonb; v_milestone jsonb; v_block jsonb; v_goal_id uuid; v_existing uuid; v_goal_client text;
  v_goal_map jsonb:='{}'::jsonb; v_action_ids jsonb:='[]'::jsonb; v_metric_ids jsonb:='[]'::jsonb; v_milestone_ids jsonb:='[]'::jsonb; v_calendar_ids jsonb:='[]'::jsonb;
  v_steps jsonb; v_title text; v_kind text; v_days smallint[]; v_tz text; v_local_today date; v_local_now time; v_day int; v_offset int;
  v_start_local timestamp; v_end_local timestamp; v_start_at timestamptz; v_end_at timestamptz; v_first_action jsonb; v_first_goal_id uuid; v_source_key text;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  select * into v_session from public.onboarding_sessions where id=p_session_id and user_id=v_user_id for update;
  if not found then raise exception 'Onboarding session not found'; end if;
  if v_session.status='completed' and v_session.proposal_status='active' then return v_session.activated_records; end if;
  if v_session.status<>'awaiting_confirmation' or v_session.proposal_status<>'approved' then raise exception 'Proposal is not approved for activation'; end if;
  v_plan:=coalesce(v_session.generated_plan,'{}'::jsonb); v_answers:=coalesce(v_session.answers,'{}'::jsonb);
  if jsonb_typeof(v_plan->'metadata')<>'object' or coalesce(v_plan#>>'{metadata,sourceContextVersion}','')='' then raise exception 'Source context version is required'; end if;
  if jsonb_typeof(v_plan->'goals')<>'array' or jsonb_array_length(v_plan->'goals')<1 then raise exception 'At least one goal is required'; end if;
  if (select count(*) from jsonb_array_elements(v_plan->'goals') g where coalesce((g->>'deferred')::boolean,false)=false)>3 then raise exception 'Starting system exceeds three active goals'; end if;
  if exists(select 1 from jsonb_array_elements(coalesce(v_plan->'schedule','[]'::jsonb)) s where coalesce(s->>'conflictStatus','')='conflict') then raise exception 'Resolve schedule conflicts before activation'; end if;
  if exists(select 1 from jsonb_array_elements(coalesce(v_plan#>'{metadata,missingInformation}','[]'::jsonb)) m where coalesce((m->>'blocksActivation')::boolean,false)) then raise exception 'Required information is still missing'; end if;
  if (select count(*) from jsonb_array_elements(coalesce(v_plan->'actions','[]'::jsonb)) a where coalesce((a->>'deferred')::boolean,false)=false and coalesce(a->>'kind','')='habit' and coalesce(a->>'frequency','') in ('daily','weekdays'))>3 then raise exception 'Starting system exceeds the daily habit limit'; end if;
  if exists(select 1 from jsonb_array_elements(v_plan->'goals') g where coalesce((g->>'deferred')::boolean,false)=false and not exists(select 1 from jsonb_array_elements(coalesce(v_plan->'actions','[]'::jsonb)) a where a->>'linkedGoalClientId'=g->>'clientId' and coalesce((a->>'deferred')::boolean,false)=false)) then raise exception 'Every active goal requires at least one controllable action'; end if;

  update public.onboarding_sessions set proposal_status='edited',activation_state=jsonb_build_object('overall','activating','steps',jsonb_build_object('goals','working','habits','pending','schedule','pending','metrics','pending','weeklyReview','pending','today','pending')),updated_at=now() where id=p_session_id;
  v_result:=public.activate_onboarding_system(p_session_id);

  for v_item in select value from jsonb_array_elements(v_plan->'goals') loop
    if coalesce((v_item->>'deferred')::boolean,false) then continue; end if;
    v_title:=left(trim(coalesce(v_item->>'title','')),180);
    select id into v_goal_id from public.goals where user_id=v_user_id and status='active' and lower(trim(title))=lower(v_title) order by created_at limit 1;
    if v_goal_id is null then raise exception 'Activated goal could not be resolved'; end if;
    v_goal_client:=v_item->>'clientId'; v_goal_map:=v_goal_map||jsonb_build_object(v_goal_client,v_goal_id::text);
    if coalesce(v_item->>'domain','')='money' then
      update public.goals set financial_goal_type=case when lower(v_title) like '%emergency%' then 'emergency_fund' when lower(v_title) like '%debt%' then 'debt_payoff' when lower(v_title) like '%purchase%' then 'purchase' else 'savings' end,
        current_amount=case when jsonb_typeof(v_item->'currentValue')='number' then (v_item->>'currentValue')::numeric else current_amount end,
        target_amount=case when jsonb_typeof(v_item->'targetValue')='number' and (v_item->>'targetValue')::numeric>0 then (v_item->>'targetValue')::numeric else target_amount end,
        target_monthly_contribution=case when jsonb_typeof(v_plan#>'{financialFocus,monthlyTarget}')='number' then (v_plan#>>'{financialFocus,monthlyTarget}')::numeric else target_monthly_contribution end, updated_at=now() where id=v_goal_id;
    end if;
    for v_milestone in select value from jsonb_array_elements(coalesce(v_item->'milestones','[]'::jsonb)) loop
      v_source_key:='onboarding:'||p_session_id::text||':milestone:'||coalesce(v_item->>'clientId','goal')||':'||coalesce(v_milestone->>'id',md5(coalesce(v_milestone->>'title','')));
      insert into public.goal_milestones(user_id,goal_id,title,target_value,unit,target_date,sort_order,status,source,source_key)
      values(v_user_id,v_goal_id,left(coalesce(v_milestone->>'title','Milestone'),180),case when jsonb_typeof(v_milestone->'targetValue')='number' then (v_milestone->>'targetValue')::numeric else null end,nullif(left(coalesce(v_milestone->>'unit',''),40),''),case when coalesce(v_milestone->>'targetDate','')~'^\d{4}-\d{2}-\d{2}$' then (v_milestone->>'targetDate')::date else null end,greatest(1,coalesce((v_milestone->>'order')::int,1)),'pending','onboarding',v_source_key)
      on conflict(user_id,source_key) where source_key is not null do update set goal_id=excluded.goal_id,title=excluded.title,target_value=excluded.target_value,unit=excluded.unit,target_date=excluded.target_date,sort_order=excluded.sort_order,updated_at=now() returning id into v_existing;
      v_milestone_ids:=v_milestone_ids||jsonb_build_array(v_existing);
    end loop;
  end loop;

  for v_metric in select value from jsonb_array_elements(coalesce(v_plan->'metrics','[]'::jsonb)) loop
    v_goal_client:=v_metric->>'linkedGoalClientId'; if not (v_goal_map ? v_goal_client) then continue; end if; v_goal_id:=(v_goal_map->>v_goal_client)::uuid;
    v_source_key:='onboarding:'||p_session_id::text||':metric:'||coalesce(v_metric->>'id',md5(coalesce(v_metric->>'name','')));
    insert into public.goal_metrics(user_id,goal_id,name,unit,direction,metric_type,entry_frequency,data_source,baseline,target_value,target_label,needs_confirmation,active,source,source_key)
    values(v_user_id,v_goal_id,left(coalesce(v_metric->>'name','Progress metric'),180),left(coalesce(v_metric->>'unit','unit'),40),case when coalesce(v_metric->>'direction','increase') in ('increase','decrease','maintain','complete') then v_metric->>'direction' else 'increase' end,case when coalesce(v_metric->>'type','leading') in ('outcome','leading') then v_metric->>'type' else 'leading' end,case when coalesce(v_metric->>'entryFrequency','weekly') in ('daily','weekly','monthly','event') then v_metric->>'entryFrequency' else 'weekly' end,left(coalesce(v_metric->>'dataSource','manual'),60),case when jsonb_typeof(v_metric->'baseline')='number' then (v_metric->>'baseline')::numeric else null end,case when jsonb_typeof(v_metric->'targetValue')='number' then (v_metric->>'targetValue')::numeric else null end,nullif(left(coalesce(v_metric->>'targetLabel',''),220),''),coalesce((v_metric->>'needsConfirmation')::boolean,false),true,'onboarding',v_source_key)
    on conflict(user_id,source_key) where source_key is not null do update set goal_id=excluded.goal_id,name=excluded.name,unit=excluded.unit,direction=excluded.direction,metric_type=excluded.metric_type,entry_frequency=excluded.entry_frequency,data_source=excluded.data_source,baseline=excluded.baseline,target_value=excluded.target_value,target_label=excluded.target_label,needs_confirmation=excluded.needs_confirmation,active=true,updated_at=now() returning id into v_existing;
    v_metric_ids:=v_metric_ids||jsonb_build_array(v_existing);
  end loop;

  for v_item in select value from jsonb_array_elements(coalesce(v_plan->'actions','[]'::jsonb)) loop
    if coalesce((v_item->>'deferred')::boolean,false) then continue; end if; v_goal_client:=v_item->>'linkedGoalClientId'; if not (v_goal_map ? v_goal_client) then continue; end if;
    v_goal_id:=(v_goal_map->>v_goal_client)::uuid; v_title:=left(trim(coalesce(v_item->>'title','')),220); v_kind:=coalesce(v_item->>'kind','task');
    select coalesce(array_agg(value::smallint),'{}'::smallint[]) into v_days from jsonb_array_elements_text(coalesce(v_item->'preferredDays','[]'::jsonb));
    if v_kind='habit' then
      select id into v_existing from public.habits where user_id=v_user_id and lower(trim(title))=lower(v_title) order by created_at limit 1;
      if v_existing is null then insert into public.habits(user_id,title,target_frequency,goal_id,source,source_key) values(v_user_id,v_title,case when coalesce(v_item->>'frequency','daily')='weekly' then 'weekly' when coalesce(v_item->>'frequency','daily') in ('n_per_week','weekdays') then 'n_per_week' else 'daily' end,v_goal_id,'onboarding','onboarding:'||p_session_id::text||':action:'||coalesce(v_item->>'clientId',md5(lower(v_title)))) returning id into v_existing; end if;
      update public.habits set goal_id=v_goal_id,domain=v_item->>'domain',preferred_days=v_days,preferred_time=case when coalesce(v_item->>'preferredTime','')~'^([01][0-9]|2[0-3]):[0-5][0-9]$' then (v_item->>'preferredTime')::time else null end,duration_minutes=greatest(0,least(240,coalesce((v_item->>'durationMinutes')::int,0))),trigger_text=nullif(left(coalesce(v_item->>'trigger',''),300),''),minimum_version=nullif(left(coalesce(v_item->>'minimumVersion',''),300),''),recovery_rule=nullif(left(coalesce(v_item->>'recoveryRule',''),400),''),evidence_type=nullif(left(coalesce(v_item->>'evidenceType',''),60),''),starting_difficulty=nullif(left(coalesce(v_item->>'startingDifficulty',''),40),''),target_per_week=case when jsonb_typeof(v_item->'targetPerWeek')='number' then (v_item->>'targetPerWeek')::int else null end where id=v_existing;
      v_action_ids:=v_action_ids||jsonb_build_array(v_existing);
    elsif v_kind in ('task','recurring_action','review') then
      select id into v_existing from public.tasks where user_id=v_user_id and completed_at is null and lower(trim(title))=lower(v_title) order by created_at limit 1;
      if v_existing is null then insert into public.tasks(user_id,goal_id,title,tier,due_at,ai_prioritized,source,source_key) values(v_user_id,v_goal_id,v_title,'important',case when coalesce(v_item->>'firstDueDate','')~'^\d{4}-\d{2}-\d{2}$' then ((v_item->>'firstDueDate')::date+time '23:00') at time zone coalesce((select timezone from public.profiles where id=v_user_id),'UTC') else null end,true,'onboarding','onboarding:'||p_session_id::text||':action:'||coalesce(v_item->>'clientId',md5(lower(v_title)))) returning id into v_existing; end if;
      update public.tasks set goal_id=v_goal_id,domain=v_item->>'domain',action_kind=v_kind,preferred_days=v_days,preferred_time=case when coalesce(v_item->>'preferredTime','')~'^([01][0-9]|2[0-3]):[0-5][0-9]$' then (v_item->>'preferredTime')::time else null end,duration_minutes=greatest(0,least(240,coalesce((v_item->>'durationMinutes')::int,0))),trigger_text=nullif(left(coalesce(v_item->>'trigger',''),300),''),minimum_version=nullif(left(coalesce(v_item->>'minimumVersion',''),300),''),recovery_rule=nullif(left(coalesce(v_item->>'recoveryRule',''),400),''),evidence_type=nullif(left(coalesce(v_item->>'evidenceType',''),60),''),schedule_flexibility=case when coalesce(v_item->>'preferredTime','')='' then 'flexible' else 'fixed' end,ai_prioritized=true where id=v_existing;
      v_action_ids:=v_action_ids||jsonb_build_array(v_existing);
    end if; v_existing:=null;
  end loop;

  select coalesce(timezone,'UTC') into v_tz from public.profiles where id=v_user_id; v_local_today:=(timezone(v_tz,now()))::date; v_local_now:=(timezone(v_tz,now()))::time;
  for v_block in select value from jsonb_array_elements(coalesce(v_plan->'schedule','[]'::jsonb)) loop
    if coalesce(v_block->>'conflictStatus','')<>'clear' or coalesce(v_block->>'startTime','')='' or jsonb_array_length(coalesce(v_block->'days','[]'::jsonb))=0 then continue; end if;
    v_goal_client:=v_block->>'linkedGoalClientId'; v_title:=coalesce((select a->>'title' from jsonb_array_elements(coalesce(v_plan->'actions','[]'::jsonb)) a where a->>'clientId'=v_block->>'actionClientId' limit 1),'Project You+ action');
    for v_day in select value::int from jsonb_array_elements_text(v_block->'days') loop
      v_offset:=(v_day-extract(dow from v_local_today)::int+7)%7; if v_offset=0 and (v_block->>'startTime')::time<=v_local_now then v_offset:=7; end if;
      v_start_local:=(v_local_today+v_offset)+(v_block->>'startTime')::time; v_end_local:=(v_local_today+v_offset)+(v_block->>'endTime')::time; if v_end_local<=v_start_local then v_end_local:=v_end_local+interval '1 day'; end if;
      v_start_at:=timezone(v_tz,v_start_local); v_end_at:=timezone(v_tz,v_end_local);
      insert into public.calendar_events(user_id,source,external_id,title,start_at,end_at,location,synced_at) values(v_user_id,'project_you','onboarding:'||p_session_id::text||':schedule:'||coalesce(v_block->>'clientId','block')||':'||v_day::text,left(v_title,220),v_start_at,v_end_at,null,now())
      on conflict(user_id,source,external_id) where external_id is not null do update set title=excluded.title,start_at=excluded.start_at,end_at=excluded.end_at,synced_at=now() returning id into v_existing;
      v_calendar_ids:=v_calendar_ids||jsonb_build_array(v_existing);
    end loop;
  end loop;

  if not exists(select 1 from public.tasks where user_id=v_user_id and completed_at is null) then
    select value into v_first_action from jsonb_array_elements(coalesce(v_plan->'actions','[]'::jsonb)) where value->>'clientId'=v_plan#>>'{today,firstMeaningfulActionClientId}' and coalesce((value->>'deferred')::boolean,false)=false limit 1;
    if v_first_action is null then raise exception 'Today initialization requires a real next action'; end if;
    v_goal_client:=v_first_action->>'linkedGoalClientId'; if v_goal_map ? v_goal_client then v_first_goal_id:=(v_goal_map->>v_goal_client)::uuid; end if; v_title:=left(coalesce(v_first_action->>'title','Complete your first Project You+ action'),220);
    insert into public.tasks(user_id,goal_id,title,tier,due_at,ai_prioritized,source,source_key,domain,action_kind,duration_minutes,minimum_version,evidence_type) values(v_user_id,v_first_goal_id,v_title,'important',now()+interval '12 hours',true,'onboarding','onboarding:'||p_session_id::text||':today-first',v_first_action->>'domain',coalesce(v_first_action->>'kind','task'),greatest(0,least(240,coalesce((v_first_action->>'durationMinutes')::int,0))),nullif(left(coalesce(v_first_action->>'minimumVersion',''),300),''),nullif(left(coalesce(v_first_action->>'evidenceType',''),60),''))
    on conflict(user_id,source_key) where source_key is not null do update set title=excluded.title,goal_id=excluded.goal_id,due_at=excluded.due_at,ai_prioritized=true returning id into v_existing; v_action_ids:=v_action_ids||jsonb_build_array(v_existing);
  end if;

  if not exists(select 1 from public.weekly_review_settings where user_id=v_user_id and active=true) then raise exception 'Weekly Review was not configured'; end if;
  if not exists(select 1 from public.goals where user_id=v_user_id and status='active') then raise exception 'At least one activated goal is required'; end if;
  if not exists(select 1 from public.tasks where user_id=v_user_id and completed_at is null) then raise exception 'Today does not have a next action'; end if;

  v_steps:=jsonb_build_object('goals','completed','habits','completed','schedule',case when jsonb_array_length(v_calendar_ids)>0 or v_result->'workoutPlan' is not null then 'completed' else 'deferred' end,'metrics','completed','weeklyReview','completed','today','completed');
  v_result:=coalesce(v_result,'{}'::jsonb)||jsonb_build_object('goalMilestones',v_milestone_ids,'goalMetrics',v_metric_ids,'systemActions',v_action_ids,'calendarEvents',v_calendar_ids,'steps',v_steps,'sourceContextVersion',v_plan#>>'{metadata,sourceContextVersion}','proposalId',v_plan#>>'{metadata,proposalId}');
  update public.onboarding_sessions set proposal_status='active',activated_records=v_result,activated_at=now(),activation_state=jsonb_build_object('overall','active','steps',v_steps),error_code=null,error_message=null,updated_at=now(),last_saved_at=now() where id=p_session_id and user_id=v_user_id;
  update public.profiles set blueprint=coalesce(blueprint,'{}'::jsonb)||jsonb_build_object('activeSystem',jsonb_build_object('proposalId',v_plan#>>'{metadata,proposalId}','sourceContextVersion',v_plan#>>'{metadata,sourceContextVersion}','generatorVersion',v_plan#>>'{metadata,generatorVersion}','weeklyReview',v_plan->'weeklyReview','workload',v_plan->'workload','activatedAt',now())) where id=v_user_id;
  return v_result;
end;$$;
revoke all on function public.activate_onboarding_system_v3(uuid) from public,anon;
grant execute on function public.activate_onboarding_system_v3(uuid) to authenticated;
