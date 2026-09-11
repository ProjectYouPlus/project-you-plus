-- Extend existing Health entities; no parallel workout or nutrition stores.
alter table public.profiles add column nutrition_targets jsonb;
alter table public.profiles add constraint nutrition_targets_object check (nutrition_targets is null or jsonb_typeof(nutrition_targets)='object');
alter table public.workout_plans add column schedule_history jsonb not null default '[]';
alter table public.workout_plan_logs add column status text not null default 'completed' check(status in ('not_started','in_progress','completed','skipped'));
alter table public.workout_plan_logs add column workout_id uuid references public.workouts(id);
alter table public.workout_plan_logs add column updated_at timestamptz not null default now();

create or replace function public.set_health_workout_state(p_plan uuid,p_session text,p_status text) returns uuid
language plpgsql security invoker set search_path=public as $$
declare v_user uuid:=auth.uid(); v_plan workout_plans; v_session jsonb; v_day date; v_log workout_plan_logs; v_workout uuid; v_zone text;
begin
 if v_user is null then raise exception 'Sign in again'; end if;
 if p_status not in ('not_started','in_progress','completed','skipped') then raise exception 'Invalid workout status'; end if;
 select * into v_plan from workout_plans where id=p_plan and user_id=v_user and active for update;
 if not found then raise exception 'Active plan not found'; end if;
 select coalesce(timezone,'UTC') into v_zone from profiles where id=v_user;
 v_day:=(now() at time zone coalesce(v_zone,'UTC'))::date;
 select x into v_session from jsonb_array_elements(v_plan.schedule) x where x->>'key'=p_session and (x->>'dayIndex')::int=extract(dow from v_day)::int;
 if v_session is null then raise exception 'This workout is not scheduled today'; end if;
 select * into v_log from workout_plan_logs where user_id=v_user and plan_id=p_plan and session_key=p_session and completed_on=v_day;
 if v_log.status='completed' then return v_log.id; end if;
 if p_status='completed' then
  insert into workouts(user_id,title,type,duration_minutes,source) values(v_user,v_session->>'title','strength',greatest(1,least(600,(v_session->>'duration')::int)),'plan') returning id into v_workout;
 end if;
 insert into workout_plan_logs(user_id,plan_id,session_key,completed_on,duration_minutes,status,workout_id)
 values(v_user,p_plan,p_session,v_day,(v_session->>'duration')::int,p_status,v_workout)
 on conflict(user_id,plan_id,session_key,completed_on) do update set status=excluded.status,workout_id=coalesce(excluded.workout_id,workout_plan_logs.workout_id),updated_at=now() returning * into v_log;
 return v_log.id;
end $$;
revoke all on function public.set_health_workout_state(uuid,text,text) from public,anon;
grant execute on function public.set_health_workout_state(uuid,text,text) to authenticated;

create or replace function public.set_training_days(p_plan uuid,p_days int[]) returns void language plpgsql security invoker set search_path=public as $$
declare v_user uuid:=auth.uid(); v_plan workout_plans; v_schedule jsonb:='[]'; v_day int; v_i int:=0; v_date date; v_zone text; v_history jsonb;
begin
 if v_user is null then raise exception 'Sign in again'; end if;
 select * into v_plan from workout_plans where id=p_plan and user_id=v_user and active for update;
 if not found then raise exception 'Active plan not found'; end if;
 if p_days is null or cardinality(p_days)=0 or cardinality(p_days)<>jsonb_array_length(v_plan.schedule) or cardinality(p_days)<>(select count(distinct x) from unnest(p_days)x) or exists(select 1 from unnest(p_days)x where x<0 or x>6 or x is null) then raise exception 'Choose one distinct day for each existing session'; end if;
 select coalesce(timezone,'UTC') into v_zone from profiles where id=v_user;
 v_date:=(now() at time zone coalesce(v_zone,'UTC'))::date;
 foreach v_day in array p_days loop
  v_schedule:=v_schedule||jsonb_build_array((v_plan.schedule->v_i)||jsonb_build_object('dayIndex',v_day,'day',(array['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'])[v_day+1])); v_i:=v_i+1;
 end loop;
 v_history:=v_plan.schedule_history;
 if jsonb_array_length(v_history)=0 then v_history:=jsonb_build_array(jsonb_build_object('from',(v_plan.created_at at time zone v_zone)::date,'schedule',v_plan.schedule)); end if;
 update workout_plans set schedule=v_schedule,schedule_history=v_history||jsonb_build_array(jsonb_build_object('from',v_date,'schedule',v_schedule)) where id=p_plan;
 update reminders r set days_of_week=p_days::smallint[],updated_at=now() from supplements s where r.user_id=v_user and r.target_type='supplement' and r.target_id=s.id and s.frequency='training_days';
end $$;
revoke all on function public.set_training_days(uuid,int[]) from public,anon;
grant execute on function public.set_training_days(uuid,int[]) to authenticated;

-- Repair the existing supplement journal trigger's timestamp reference.
do $$ declare definition text; begin
 select pg_get_functiondef('public.capture_behavior_event()'::regprocedure) into definition;
 definition:=replace(definition,'''supplement_logs'',new.id::text,new.created_at','''supplement_logs'',new.id::text,new.taken_at');
 execute definition;
end $$;

drop policy workout_plan_logs_isolation on public.workout_plan_logs;
create policy workout_plan_logs_isolation on public.workout_plan_logs for all to authenticated using(auth.uid()=user_id) with check(auth.uid()=user_id and exists(select 1 from public.workout_plans p where p.id=plan_id and p.user_id=auth.uid()));
drop policy supplement_logs_isolation on public.supplement_logs;
create policy supplement_logs_isolation on public.supplement_logs for all to authenticated using(auth.uid()=user_id) with check(auth.uid()=user_id and exists(select 1 from public.supplements s where s.id=supplement_id and s.user_id=auth.uid()));
