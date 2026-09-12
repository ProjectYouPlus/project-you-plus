create or replace function public.append_onboarding_completed_event(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_session public.onboarding_sessions%rowtype;
  v_answers jsonb;
  v_plan jsonb;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  select * into v_session from public.onboarding_sessions
    where id=p_session_id and user_id=v_user_id and status='completed';
  if not found then raise exception 'Completed onboarding session not found'; end if;
  v_answers:=coalesce(v_session.answers,'{}'::jsonb);
  v_plan:=coalesce(v_session.generated_plan,'{}'::jsonb);
  perform public.append_behavior_event(
    v_user_id,
    'onboarding.completed',
    'onboarding.completed:'||p_session_id::text,
    'onboarding_sessions',
    p_session_id::text,
    coalesce(v_session.completed_at,now()),
    jsonb_build_object(
      'onboarding_version',v_session.onboarding_version,
      'primary_domain',v_answers#>>'{direction,primaryDomain}',
      'selected_domain_count',jsonb_array_length(coalesce(v_answers#>'{direction,domains}','[]'::jsonb)),
      'goal_count',jsonb_array_length(coalesce(v_plan->'goals','[]'::jsonb)),
      'health_included',coalesce((v_answers#>>'{health,included}')::boolean,false),
      'finance_deferred',coalesce((v_answers#>>'{finance,deferred}')::boolean,false),
      'coaching_style',v_answers#>>'{coaching,style}',
      'weekly_review_day',v_plan#>>'{weeklyReview,day}'
    )
  );
end;$$;

revoke all on function public.append_onboarding_completed_event(uuid) from public;
revoke all on function public.append_onboarding_completed_event(uuid) from anon;
grant execute on function public.append_onboarding_completed_event(uuid) to authenticated;

do $$
declare
  ddl text;
  old_block text := $old$
  perform public.append_behavior_event(
    v_user_id,
    'onboarding.completed',
    'onboarding.completed:'||p_session_id::text,
    'onboarding_sessions',
    p_session_id::text,
    now(),
    jsonb_build_object(
      'onboarding_version',v_session.onboarding_version,
      'primary_domain',v_answers#>>'{direction,primaryDomain}',
      'selected_domain_count',jsonb_array_length(coalesce(v_answers#>'{direction,domains}','[]'::jsonb)),
      'goal_count',jsonb_array_length(v_plan->'goals'),
      'health_included',coalesce((v_answers#>>'{health,included}')::boolean,false),
      'finance_deferred',coalesce((v_answers#>>'{finance,deferred}')::boolean,false),
      'coaching_style',v_answers#>>'{coaching,style}',
      'weekly_review_day',v_review->>'day'
    )
  );$old$;
begin
  ddl:=pg_get_functiondef('public.activate_onboarding_system(uuid)'::regprocedure);
  if position(old_block in ddl)=0 then raise exception 'Expected onboarding event block not found'; end if;
  ddl:=replace(ddl,old_block,E'\n  perform public.append_onboarding_completed_event(p_session_id);');
  execute ddl;
end $$;
