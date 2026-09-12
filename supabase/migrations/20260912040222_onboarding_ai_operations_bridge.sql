create or replace function public.begin_onboarding_ai_operation(p_title text default 'Build onboarding starting system')
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_user uuid:=auth.uid(); v_id bigint;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  insert into public.ai_agent_runs(agent_key,requested_by,run_type,title,status,metadata,started_at)
  values('orchestrator',v_user,'onboarding_generation',left(coalesce(p_title,'Build onboarding starting system'),180),'running',jsonb_build_object('surface','onboarding','user_facing_agent','coach'),now())
  returning id into v_id;
  return v_id;
end;$$;

create or replace function public.finish_onboarding_ai_operation(p_run_id bigint,p_status text,p_summary text,p_metadata jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_user uuid:=auth.uid();
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_status not in ('passed','failed','blocked') then raise exception 'Invalid status'; end if;
  update public.ai_agent_runs
  set status=p_status,summary=left(coalesce(p_summary,''),4000),metadata=coalesce(metadata,'{}'::jsonb)||coalesce(p_metadata,'{}'::jsonb),finished_at=now()
  where id=p_run_id and requested_by=v_user and run_type='onboarding_generation';
end;$$;

grant execute on function public.begin_onboarding_ai_operation(text) to authenticated;
grant execute on function public.finish_onboarding_ai_operation(bigint,text,text,jsonb) to authenticated;
