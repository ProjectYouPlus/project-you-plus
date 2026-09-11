-- Coach may propose a training-day move, but this function is the only mutation path.
-- It rechecks ownership and payload shape after the user presses Confirm and apply.
create or replace function private.execute_ai_recommendation(p_id uuid)
returns public.ai_recommendations
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_user uuid := auth.uid();
  v_rec public.ai_recommendations;
  v_changed integer;
  v_start timestamptz;
  v_end timestamptz;
  v_plan public.workout_plans;
  v_days int[];
  v_from_day integer;
  v_to_day integer;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  select * into v_rec from public.ai_recommendations
   where id = p_id and user_id = v_user and status in ('pending','accepted')
   for update;
  if v_rec.id is null then raise exception 'recommendation not found or no longer active'; end if;

  if v_rec.action_type = 'advice.follow' then
    if v_rec.status <> 'accepted' then raise exception 'accept this recommendation before marking it complete'; end if;
  else
    if v_rec.status = 'pending' then
      update public.ai_recommendations set status='accepted' where id=v_rec.id returning * into v_rec;
    end if;
    if v_rec.action_type = 'task.complete' then
      update public.tasks set completed_at=coalesce(completed_at,now())
       where id=(v_rec.action_payload->>'taskId')::uuid and user_id=v_user;
    elsif v_rec.action_type = 'task.reschedule' then
      update public.tasks set due_at=(v_rec.action_payload->>'dueAt')::timestamptz
       where id=(v_rec.action_payload->>'taskId')::uuid and user_id=v_user;
    elsif v_rec.action_type = 'calendar.reschedule' then
      v_start := (v_rec.action_payload->>'startAt')::timestamptz;
      v_end := (v_rec.action_payload->>'endAt')::timestamptz;
      if v_end <= v_start then raise exception 'calendar end must be after start'; end if;
      update public.calendar_events set start_at=v_start,end_at=v_end
       where id=(v_rec.action_payload->>'eventId')::uuid and user_id=v_user and source='internal';
    elsif v_rec.action_type = 'goal.progress' then
      update public.goals set progress=(v_rec.action_payload->>'progress')::integer
       where id=(v_rec.action_payload->>'goalId')::uuid and user_id=v_user
         and (v_rec.action_payload->>'progress')::integer between 0 and 100;
    elsif v_rec.action_type = 'workout.schedule_move' then
      select * into v_plan from public.workout_plans
       where id=(v_rec.action_payload->>'planId')::uuid and user_id=v_user and active
       for update;
      if v_plan.id is null then raise exception 'active workout plan not found'; end if;
      if not exists (
        select 1 from jsonb_array_elements(v_plan.schedule) item
        where item->>'key'=v_rec.action_payload->>'sessionKey'
      ) then raise exception 'workout session not found'; end if;
      select array_agg(value::integer order by ordinal) into v_days
       from jsonb_array_elements_text(v_rec.action_payload->'days') with ordinality as x(value,ordinal);
      v_from_day := (v_rec.action_payload->>'fromDayIndex')::integer;
      v_to_day := (v_rec.action_payload->>'toDayIndex')::integer;
      if v_days is null
        or cardinality(v_days) <> jsonb_array_length(v_plan.schedule)
        or cardinality(v_days) <> (select count(distinct day) from unnest(v_days) day)
        or exists(select 1 from unnest(v_days) day where day < 0 or day > 6)
        or v_from_day < 0 or v_from_day > 6 or v_to_day < 0 or v_to_day > 6 or v_from_day = v_to_day
      then raise exception 'invalid workout schedule change'; end if;
      perform public.set_training_days(v_plan.id,v_days);
      v_changed := 1;
    else
      raise exception 'unsupported recommendation action';
    end if;
    if v_rec.action_type <> 'workout.schedule_move' then
      get diagnostics v_changed = row_count;
    end if;
    if v_changed <> 1 then raise exception 'recommended item was not found or cannot be changed'; end if;
  end if;

  perform set_config('app.recommendation_execution','confirmed',true);
  update public.ai_recommendations set status='completed' where id=v_rec.id returning * into v_rec;
  return v_rec;
end;
$$;

revoke all on function private.execute_ai_recommendation(uuid) from public, anon;
grant execute on function private.execute_ai_recommendation(uuid) to authenticated;
