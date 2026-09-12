-- Record successful Auto-Build activation in the existing AI Operations stream.
-- Runs only after the activation transaction commits its session transition.
create or replace function private.log_autobuild_activation_ai_operation()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  if new.proposal_status='active'
     and old.proposal_status is distinct from 'active'
     and jsonb_typeof(new.generated_plan->'metadata')='object'
  then
    insert into public.ai_agent_runs(
      agent_key,requested_by,run_type,title,status,summary,metadata,started_at,finished_at
    ) values (
      'orchestrator',new.user_id,'onboarding_activation','Activate approved Project You+ system','passed',
      'Approved Auto-Build system activated into canonical Project You+ records.',
      jsonb_build_object(
        'surface','onboarding_auto_build',
        'user_facing_agent','coach',
        'proposal_id',new.generated_plan#>>'{metadata,proposalId}',
        'generator_version',new.generated_plan#>>'{metadata,generatorVersion}',
        'source_context_version',new.generated_plan#>>'{metadata,sourceContextVersion}',
        'goal_count',coalesce(jsonb_array_length(new.generated_plan->'goals'),0),
        'action_count',coalesce(jsonb_array_length(new.generated_plan->'actions'),0),
        'activation','completed'
      ),
      coalesce(new.approved_at,now()),coalesce(new.activated_at,now())
    );
  end if;
  return new;
end;
$$;
revoke all on function private.log_autobuild_activation_ai_operation() from public,anon,authenticated;
drop trigger if exists onboarding_v3_activation_ai_operations on public.onboarding_sessions;
create trigger onboarding_v3_activation_ai_operations
after update of proposal_status on public.onboarding_sessions
for each row execute function private.log_autobuild_activation_ai_operation();