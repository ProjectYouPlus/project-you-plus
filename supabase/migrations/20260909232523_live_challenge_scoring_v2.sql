create or replace function public.refresh_challenge_points_for_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_points integer;
begin
  for r in
    select cm.challenge_id, c.metric, c.starts_on, c.ends_on
    from public.challenge_members cm
    join public.challenges c on c.id = cm.challenge_id
    where cm.user_id = p_user_id and c.status = 'active'
  loop
    if r.metric = 'workouts' then
      select count(*)::int into v_points
      from public.workouts w
      where w.user_id = p_user_id
        and (w.performed_at at time zone 'UTC')::date between r.starts_on and r.ends_on;
    elsif r.metric = 'habit_days' then
      select count(distinct hl.logged_at)::int into v_points
      from public.habit_logs hl
      where hl.user_id = p_user_id
        and hl.logged_at between r.starts_on and r.ends_on;
    elsif r.metric = 'task_wins' then
      select count(*)::int into v_points
      from public.tasks t
      where t.user_id = p_user_id and t.completed_at is not null
        and (t.completed_at at time zone 'UTC')::date between r.starts_on and r.ends_on;
    else
      select
        coalesce((select count(*) * 15 from public.workouts w where w.user_id = p_user_id and (w.performed_at at time zone 'UTC')::date between r.starts_on and r.ends_on),0)
        + coalesce((select count(*) * 5 from public.habit_logs hl where hl.user_id = p_user_id and hl.logged_at between r.starts_on and r.ends_on),0)
        + coalesce((select count(*) * 10 from public.tasks t where t.user_id = p_user_id and t.completed_at is not null and (t.completed_at at time zone 'UTC')::date between r.starts_on and r.ends_on),0)
      into v_points;
    end if;

    update public.challenge_members
    set points = coalesce(v_points,0)
    where challenge_id = r.challenge_id and user_id = p_user_id;
  end loop;
end;
$$;

create or replace function public.refresh_challenge_points_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.refresh_challenge_points_for_user(case when tg_op = 'DELETE' then old.user_id else new.user_id end);
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists py_challenge_habit_logs on public.habit_logs;
create trigger py_challenge_habit_logs after insert or update or delete on public.habit_logs for each row execute function public.refresh_challenge_points_trigger();

drop trigger if exists py_challenge_workouts on public.workouts;
create trigger py_challenge_workouts after insert or update or delete on public.workouts for each row execute function public.refresh_challenge_points_trigger();

drop trigger if exists py_challenge_tasks on public.tasks;
create trigger py_challenge_tasks after insert or update of completed_at or delete on public.tasks for each row execute function public.refresh_challenge_points_trigger();

create or replace function public.refresh_new_challenge_member_points()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.refresh_challenge_points_for_user(new.user_id);
  return new;
end;
$$;

drop trigger if exists py_challenge_member_join on public.challenge_members;
create trigger py_challenge_member_join after insert on public.challenge_members for each row execute function public.refresh_new_challenge_member_points();

revoke all on function public.refresh_challenge_points_for_user(uuid) from public, anon, authenticated;
revoke all on function public.refresh_challenge_points_trigger() from public, anon, authenticated;
revoke all on function public.refresh_new_challenge_member_points() from public, anon, authenticated;
