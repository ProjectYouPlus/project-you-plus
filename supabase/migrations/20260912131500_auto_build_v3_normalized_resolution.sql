-- Keep v3's post-activation ID resolution aligned with the normalized duplicate rule.
-- Migration order guarantees activate_onboarding_system_v3(uuid) already exists. We patch the
-- three canonical title lookups (goals, habits, open tasks) in-place and fail loudly if the
-- expected audited predicate is no longer present, preventing silent migration drift.

do $migration$
declare
  v_definition text;
  v_old text := 'lower(trim(title))=lower(v_title)';
  v_new text := 'regexp_replace(lower(btrim(title)),''\s+'','' '',''g'')=regexp_replace(lower(btrim(v_title)),''\s+'','' '',''g'')';
begin
  select pg_get_functiondef('public.activate_onboarding_system_v3(uuid)'::regprocedure) into v_definition;
  if position(v_old in v_definition)=0 then
    raise exception 'activate_onboarding_system_v3 duplicate predicate changed; review migration before applying';
  end if;
  v_definition := replace(v_definition,v_old,v_new);
  execute v_definition;
end;
$migration$;

revoke all on function public.activate_onboarding_system_v3(uuid) from public,anon;
grant execute on function public.activate_onboarding_system_v3(uuid) to authenticated;
