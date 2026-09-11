create or replace function public.award_active_challenges(p_user_id uuid, p_event text, p_direction integer default 1)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.challenge_members cm
  set points = greatest(0, cm.points + p_direction * case
    when c.metric = 'consistency_points' and p_event = 'task' then 10
    when c.metric = 'consistency_points' and p_event = 'habit' then 5
    when c.metric = 'consistency_points' and p_event = 'workout' then 15
    when c.metric = 'task_wins' and p_event = 'task' then 1
    when c.metric = 'habit_days' and p_event = 'habit' then 1
    when c.metric = 'workouts' and p_event = 'workout' then 1
    else 0
  end)
  from public.challenges c
  where c.id = cm.challenge_id
    and cm.user_id = p_user_id
    and c.status = 'active'
    and current_date between c.starts_on and c.ends_on;
end;
$$;
revoke all on function public.award_active_challenges(uuid,text,integer) from public;
create or replace function public.challenge_score_habit_log()
returns trigger language plpgsql security definer set search_path = public
as $$ begin perform public.award_active_challenges(new.user_id, 'habit', 1); return new; end; $$;
create or replace function public.challenge_score_workout_plan_log()
returns trigger language plpgsql security definer set search_path = public
as $$ begin perform public.award_active_challenges(new.user_id, 'workout', 1); return new; end; $$;
create or replace function public.challenge_score_manual_workout()
returns trigger language plpgsql security definer set search_path = public
as $$ begin if coalesce(new.source,'manual') <> 'plan' then perform public.award_active_challenges(new.user_id, 'workout', 1); end if; return new; end; $$;
create or replace function public.challenge_score_task_completion()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if old.completed_at is null and new.completed_at is not null then perform public.award_active_challenges(new.user_id, 'task', 1);
  elsif old.completed_at is not null and new.completed_at is null then perform public.award_active_challenges(new.user_id, 'task', -1);
  end if;
  return new;
end;
$$;
drop trigger if exists challenge_habit_log_trigger on public.habit_logs;
create trigger challenge_habit_log_trigger after insert on public.habit_logs for each row execute function public.challenge_score_habit_log();
drop trigger if exists challenge_workout_plan_log_trigger on public.workout_plan_logs;
create trigger challenge_workout_plan_log_trigger after insert on public.workout_plan_logs for each row execute function public.challenge_score_workout_plan_log();
drop trigger if exists challenge_manual_workout_trigger on public.workouts;
create trigger challenge_manual_workout_trigger after insert on public.workouts for each row execute function public.challenge_score_manual_workout();
drop trigger if exists challenge_task_completion_trigger on public.tasks;
create trigger challenge_task_completion_trigger after update of completed_at on public.tasks for each row execute function public.challenge_score_task_completion();
