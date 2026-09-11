update public.ai_recommendations
set action_type='advice.follow', action_payload='{}'::jsonb
where status in ('pending','accepted')
  and coalesce(action_type,'') not in ('advice.follow','task.complete','task.reschedule','calendar.reschedule','goal.progress','workout_plan.activate');

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
    else
      raise exception 'unsupported recommendation action';
    end if;
    get diagnostics v_changed = row_count;
    if v_changed <> 1 then raise exception 'recommended item was not found or cannot be changed'; end if;
  end if;

  perform set_config('app.recommendation_execution','confirmed',true);
  update public.ai_recommendations set status='completed' where id=v_rec.id returning * into v_rec;
  return v_rec;
end;
$$;

revoke all on function private.execute_ai_recommendation(uuid) from public, anon;
grant execute on function private.execute_ai_recommendation(uuid) to authenticated;

create or replace function public.execute_ai_recommendation(p_id uuid)
returns public.ai_recommendations
language sql
security invoker
set search_path = public, private
as $$ select private.execute_ai_recommendation(p_id); $$;

revoke all on function public.execute_ai_recommendation(uuid) from public, anon;
grant execute on function public.execute_ai_recommendation(uuid) to authenticated;
