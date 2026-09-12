create or replace function public.capture_onboarding_stage_abandoned()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.status in ('not_started','in_progress','failed','awaiting_confirmation')
     and old.current_stage is not null
     and old.current_stage not in ('intro','trajectory')
     and old.last_saved_at is not null
     and new.last_saved_at > old.last_saved_at + interval '30 minutes'
     and new.user_id = old.user_id then
    insert into public.activity_events(user_id,event_name,path,metadata)
    values(old.user_id,'stage_abandoned','/onboarding',jsonb_build_object(
      'onboarding_version',old.onboarding_version,
      'stage',left(old.current_stage,40),
      'completion_status','abandoned'
    ));
  end if;
  return new;
end;$$;

revoke all on function public.capture_onboarding_stage_abandoned() from public;
revoke all on function public.capture_onboarding_stage_abandoned() from anon;
revoke all on function public.capture_onboarding_stage_abandoned() from authenticated;

drop trigger if exists onboarding_stage_abandoned_analytics on public.onboarding_sessions;
create trigger onboarding_stage_abandoned_analytics
  after update of last_saved_at on public.onboarding_sessions
  for each row execute function public.capture_onboarding_stage_abandoned();
