alter table public.behavior_events drop constraint behavior_events_event_type_check;
alter table public.behavior_events add constraint behavior_events_event_type_check check(event_type in ('task.completed','task.missed','habit.completed','habit.missed','workout.completed','workout.missed','meal.logged','supplement.completed','calendar.changed','spending.threshold','goal.progress_changed','score.changed','achievement.unlocked','milestone.unlocked','first_week.completed','pattern.discovered','workout.plan_activated','workout.schedule_changed'));

create or replace function private.capture_health_plan_event() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if tg_op='INSERT' and new.active or tg_op='UPDATE' and new.active and not old.active then
  perform public.append_behavior_event(new.user_id,'workout.plan_activated','workout.plan_activated:'||new.id,'workout_plans',new.id::text,now(),jsonb_build_object('title',new.title,'schedule',new.schedule));
 elsif tg_op='UPDATE' and new.schedule is distinct from old.schedule then
  perform public.append_behavior_event(new.user_id,'workout.schedule_changed','workout.schedule_changed:'||new.id||':'||extract(epoch from clock_timestamp()),'workout_plans',new.id::text,now(),jsonb_build_object('previous_schedule',old.schedule,'schedule',new.schedule));
 end if;
 return new;
end $$;
revoke all on function private.capture_health_plan_event() from public,anon,authenticated;
create trigger health_plan_event after insert or update on public.workout_plans for each row execute function private.capture_health_plan_event();

create or replace function private.enrich_health_workout_event() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_session jsonb;
begin
 if new.status='completed' and new.workout_id is not null then
  select s into v_session from public.workout_plans p cross join lateral jsonb_array_elements(p.schedule) s where p.id=new.plan_id and s->>'key'=new.session_key;
  update public.behavior_events set payload=payload||jsonb_build_object('workout_plan_id',new.plan_id,'session_key',new.session_key,'workout_name',v_session->>'title','exercise_count',jsonb_array_length(coalesce(v_session->'exercises','[]')),'day',new.completed_on) where user_id=new.user_id and event_type='workout.completed' and source_id=new.workout_id::text;
 end if;
 return new;
end $$;
revoke all on function private.enrich_health_workout_event() from public,anon,authenticated;
create trigger health_workout_event after insert or update on public.workout_plan_logs for each row execute function private.enrich_health_workout_event();

-- Starting a session must not satisfy the historical completion reconciler.
do $$ declare definition text; begin
 select pg_get_functiondef('private.reconcile_behavior_events(date)'::regprocedure) into definition;
 definition:=replace(definition,'l.completed_on=p_through','l.completed_on=p_through and l.status=''completed''');
 execute definition;
end $$;
