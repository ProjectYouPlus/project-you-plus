-- Prevent rich v3 deferred items from being interpreted as active by the legacy v2 compatibility RPC.
-- v3 keeps its full proposal in-memory; this trigger temporarily projects only active items
-- into the session for the nested v2 call, then restores the full proposal when v3 marks it active.

create or replace function private.guard_autobuild_v3_legacy_projection()
returns trigger
language plpgsql
set search_path = public, private, pg_temp
as $$
declare
  v_active_ids text[] := '{}'::text[];
  v_projected jsonb;
  v_has_health boolean := false;
  v_has_money boolean := false;
begin
  if old.proposal_status='approved'
     and new.proposal_status='edited'
     and coalesce(new.activation_state->>'overall','')='activating'
     and jsonb_typeof(old.generated_plan->'metadata')='object'
  then
    select coalesce(array_agg(value->>'clientId'),'{}'::text[])
      into v_active_ids
      from jsonb_array_elements(coalesce(old.generated_plan->'goals','[]'::jsonb))
     where coalesce((value->>'deferred')::boolean,false)=false;

    select exists(select 1 from jsonb_array_elements(coalesce(old.generated_plan->'goals','[]'::jsonb)) g where coalesce((g->>'deferred')::boolean,false)=false and g->>'domain'='health') into v_has_health;
    select exists(select 1 from jsonb_array_elements(coalesce(old.generated_plan->'goals','[]'::jsonb)) g where coalesce((g->>'deferred')::boolean,false)=false and g->>'domain'='money') into v_has_money;

    v_projected := old.generated_plan;
    v_projected := jsonb_set(v_projected,'{goals}',coalesce((select jsonb_agg(value) from jsonb_array_elements(coalesce(old.generated_plan->'goals','[]'::jsonb)) where coalesce((value->>'deferred')::boolean,false)=false),'[]'::jsonb),true);
    v_projected := jsonb_set(v_projected,'{habits}',coalesce((select jsonb_agg(value) from jsonb_array_elements(coalesce(old.generated_plan->'habits','[]'::jsonb)) where coalesce(value->>'goalClientId','')='' or value->>'goalClientId'=any(v_active_ids)),'[]'::jsonb),true);
    v_projected := jsonb_set(v_projected,'{priorities}',coalesce((select jsonb_agg(value) from jsonb_array_elements(coalesce(old.generated_plan->'priorities','[]'::jsonb)) where coalesce(value->>'goalClientId','')='' or value->>'goalClientId'=any(v_active_ids)),'[]'::jsonb),true);
    if not v_has_health then v_projected := jsonb_set(v_projected,'{healthPlan}','null'::jsonb,true); end if;
    if not v_has_money then v_projected := jsonb_set(v_projected,'{financialFocus}','null'::jsonb,true); end if;

    new.generated_plan := v_projected;
    new.activation_state := coalesce(new.activation_state,'{}'::jsonb) || jsonb_build_object('_full_plan',old.generated_plan);
  elsif old.proposal_status='confirmed'
        and new.proposal_status='active'
        and old.activation_state ? '_full_plan'
  then
    new.generated_plan := old.activation_state->'_full_plan';
    new.activation_state := coalesce(new.activation_state,'{}'::jsonb) - '_full_plan';
  end if;
  return new;
end;
$$;

revoke all on function private.guard_autobuild_v3_legacy_projection() from public,anon,authenticated;
drop trigger if exists onboarding_v3_legacy_projection_guard on public.onboarding_sessions;
create trigger onboarding_v3_legacy_projection_guard
before update on public.onboarding_sessions
for each row execute function private.guard_autobuild_v3_legacy_projection();
