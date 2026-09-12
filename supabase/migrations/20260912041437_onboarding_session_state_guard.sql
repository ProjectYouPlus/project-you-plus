create or replace function public.guard_onboarding_session_status()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.status = 'generating'
     and new.status = 'in_progress'
     and new.current_stage = 'generating'
     and new.answers is not distinct from old.answers then
    new.status := 'generating';
  elsif old.status = 'awaiting_confirmation'
     and new.status = 'in_progress'
     and new.current_stage = 'review'
     and new.answers is not distinct from old.answers
     and new.generated_plan is not distinct from old.generated_plan then
    new.status := 'awaiting_confirmation';
  end if;
  return new;
end;$$;

drop trigger if exists onboarding_session_status_guard on public.onboarding_sessions;
create trigger onboarding_session_status_guard
before update on public.onboarding_sessions
for each row execute function public.guard_onboarding_session_status();
