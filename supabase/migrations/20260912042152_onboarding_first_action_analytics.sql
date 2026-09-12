create unique index if not exists activity_events_first_action_completed_once_uq
  on public.activity_events(user_id,event_name)
  where event_name='first_action_completed';

create or replace function public.capture_first_onboarding_action()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid;
begin
  if tg_table_name='tasks' then
    if new.completed_at is null or old.completed_at is not null then return new; end if;
    v_user_id := new.user_id;
  elsif tg_table_name='habit_logs' then
    v_user_id := new.user_id;
  elsif tg_table_name='workouts' then
    v_user_id := new.user_id;
  else
    return new;
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id=v_user_id and p.onboarding_completed=true
  ) then return new; end if;

  insert into public.activity_events(user_id,event_name,path,metadata)
  values(v_user_id,'first_action_completed','/today',jsonb_build_object(
    'onboarding_version',coalesce((select onboarding_version from public.profiles where id=v_user_id),'unknown'),
    'stage','today','completion_status','completed'
  ))
  on conflict (user_id,event_name) where event_name='first_action_completed' do nothing;
  return new;
end;$$;

revoke all on function public.capture_first_onboarding_action() from public;
revoke all on function public.capture_first_onboarding_action() from anon;
revoke all on function public.capture_first_onboarding_action() from authenticated;

drop trigger if exists onboarding_first_task_completed on public.tasks;
create trigger onboarding_first_task_completed
  after update of completed_at on public.tasks
  for each row execute function public.capture_first_onboarding_action();

drop trigger if exists onboarding_first_habit_completed on public.habit_logs;
create trigger onboarding_first_habit_completed
  after insert on public.habit_logs
  for each row execute function public.capture_first_onboarding_action();

drop trigger if exists onboarding_first_workout_completed on public.workouts;
create trigger onboarding_first_workout_completed
  after insert on public.workouts
  for each row execute function public.capture_first_onboarding_action();
