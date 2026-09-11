-- Canonical longitudinal event stream.
alter table public.behavior_events drop constraint if exists behavior_events_event_type_check;
alter table public.behavior_events add constraint behavior_events_event_type_check check (event_type in (
  'task.completed','task.missed','habit.completed','habit.missed',
  'workout.completed','workout.missed','meal.logged','supplement.completed',
  'calendar.changed','spending.threshold','goal.progress_changed',
  'score.changed','achievement.unlocked','milestone.unlocked','first_week.completed',
  'pattern.discovered'
));

comment on table public.user_intelligence_events is
  'DEPRECATED: retained temporarily for migration verification. Use public.behavior_events as the canonical longitudinal event stream.';
revoke all on public.user_intelligence_events from anon, authenticated;

-- The recomputing v2 challenge scorer is authoritative. Disable the older
-- incremental trigger family so a behavior can never be counted twice.
drop trigger if exists challenge_habit_log_trigger on public.habit_logs;
drop trigger if exists challenge_workout_plan_log_trigger on public.workout_plan_logs;
drop trigger if exists challenge_manual_workout_trigger on public.workouts;
drop trigger if exists challenge_task_completion_trigger on public.tasks;
comment on function public.award_active_challenges(uuid,text,integer) is
  'DEPRECATED: incremental challenge scorer disabled in favor of refresh_challenge_points_for_user.';
revoke all on function public.award_active_challenges(uuid,text,integer) from public, anon, authenticated;
revoke all on function public.challenge_score_habit_log() from public, anon, authenticated;
revoke all on function public.challenge_score_workout_plan_log() from public, anon, authenticated;
revoke all on function public.challenge_score_manual_workout() from public, anon, authenticated;
revoke all on function public.challenge_score_task_completion() from public, anon, authenticated;
revoke all on function public.refresh_challenge_points_for_user(uuid) from public, anon, authenticated;
revoke all on function public.refresh_challenge_points_trigger() from public, anon, authenticated;
revoke all on function public.refresh_new_challenge_member_points() from public, anon, authenticated;

-- Trigger helpers are invoked by PostgreSQL, not application roles.
revoke all on function public.append_behavior_event(uuid,text,text,text,text,timestamptz,jsonb) from public, anon, authenticated;
revoke all on function public.capture_behavior_event() from public, anon, authenticated;
revoke all on function public.set_ai_recommendation_state_timestamps() from public, anon, authenticated;

-- RLS predicates need authenticated execution but never anonymous execution.
revoke all on function public.is_challenge_member(uuid) from public, anon;
revoke all on function public.has_challenge_invite(uuid) from public, anon;
revoke all on function public.is_accountability_connection(uuid) from public, anon;
grant execute on function public.is_challenge_member(uuid) to authenticated;
grant execute on function public.has_challenge_invite(uuid) to authenticated;
grant execute on function public.is_accountability_connection(uuid) to authenticated;

-- Recommendation state is controlled by narrow transition functions. Clients
-- can accept or dismiss; only a successful executor can mark work complete.
revoke update on public.ai_recommendations from authenticated;

create or replace function public.enforce_ai_recommendation_transition()
returns trigger language plpgsql set search_path = public as $$
begin
  if old.status is not distinct from new.status then return new; end if;
  if old.status = 'pending' and new.status in ('accepted','dismissed') then return new; end if;
  if old.status = 'accepted' and new.status = 'dismissed' then return new; end if;
  if old.status = 'accepted' and new.status = 'completed'
     and current_setting('app.recommendation_execution', true) = 'confirmed' then return new; end if;
  raise exception 'illegal recommendation state transition: % -> %', old.status, new.status;
end; $$;
revoke all on function public.enforce_ai_recommendation_transition() from public, anon, authenticated;
drop trigger if exists enforce_ai_recommendation_transition on public.ai_recommendations;
create trigger enforce_ai_recommendation_transition before update of status on public.ai_recommendations
for each row execute function public.enforce_ai_recommendation_transition();

create or replace function public.transition_ai_recommendation(p_id uuid, p_target text)
returns public.ai_recommendations language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid(); v_row public.ai_recommendations;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if p_target not in ('accepted','dismissed') then raise exception 'unsupported recommendation transition'; end if;
  update public.ai_recommendations
     set status = p_target
   where id = p_id and user_id = v_user
     and ((status = 'pending') or (status = 'accepted' and p_target = 'dismissed'))
  returning * into v_row;
  if v_row.id is null then raise exception 'recommendation not found or transition is not allowed'; end if;
  return v_row;
end; $$;
revoke all on function public.transition_ai_recommendation(uuid,text) from public, anon;
grant execute on function public.transition_ai_recommendation(uuid,text) to authenticated;

create or replace function public.complete_ai_recommendation_after_execution(p_id uuid, p_user_id uuid)
returns public.ai_recommendations language plpgsql security definer set search_path = public as $$
declare v_row public.ai_recommendations;
begin
  perform set_config('app.recommendation_execution','confirmed',true);
  update public.ai_recommendations set status = 'completed'
   where id = p_id and user_id = p_user_id and status = 'accepted'
  returning * into v_row;
  if v_row.id is null then raise exception 'accepted recommendation not found'; end if;
  return v_row;
end; $$;
revoke all on function public.complete_ai_recommendation_after_execution(uuid,uuid) from public, anon, authenticated;
grant execute on function public.complete_ai_recommendation_after_execution(uuid,uuid) to service_role;

create or replace function public.activate_workout_plan_recommendation(p_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid(); v_rec public.ai_recommendations; v_plan_id uuid;
  v_days integer; v_minutes integer; v_schedule jsonb;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  select * into v_rec from public.ai_recommendations
   where id = p_id and user_id = v_user and status in ('pending','accepted')
     and action_type = 'workout_plan.activate' for update;
  if v_rec.id is null then raise exception 'workout plan proposal not found'; end if;
  v_days := (v_rec.action_payload->>'daysPerWeek')::integer;
  v_minutes := (v_rec.action_payload->>'sessionMinutes')::integer;
  v_schedule := v_rec.action_payload->'schedule';
  if coalesce(v_rec.action_payload->>'title','') = ''
     or coalesce(v_rec.action_payload->>'goal','') = ''
     or v_days not between 1 and 7 or v_minutes not between 25 and 90
     or jsonb_typeof(v_schedule) <> 'array' or jsonb_array_length(v_schedule) <> v_days then
    raise exception 'invalid workout plan proposal';
  end if;
  if v_rec.status = 'pending' then
    update public.ai_recommendations set status = 'accepted' where id = v_rec.id;
  end if;
  insert into public.workout_plans(user_id,title,goal,days_per_week,session_minutes,experience,schedule,active,source)
  values(v_user,left(v_rec.action_payload->>'title',120),v_rec.action_payload->>'goal',v_days,v_minutes,
    coalesce(v_rec.action_payload->>'experience','intermediate'),v_schedule,false,'recommendation:'||v_rec.id)
  returning id into v_plan_id;
  update public.workout_plans set active=false where user_id=v_user and active=true and id<>v_plan_id;
  update public.workout_plans set active=true where id=v_plan_id;
  perform set_config('app.recommendation_execution','confirmed',true);
  update public.ai_recommendations set status='completed' where id=v_rec.id and status='accepted';
  return v_plan_id;
end; $$;
revoke all on function public.activate_workout_plan_recommendation(uuid) from public, anon;
grant execute on function public.activate_workout_plan_recommendation(uuid) to authenticated;
