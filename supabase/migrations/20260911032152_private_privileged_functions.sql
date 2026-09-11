create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

-- Move privileged implementations out of the exposed API schema. The public
-- functions below are SECURITY INVOKER wrappers with a deliberately narrow API.
alter function public.is_challenge_member(uuid) set schema private;
alter function public.has_challenge_invite(uuid) set schema private;
alter function public.is_accountability_connection(uuid) set schema private;
alter function public.reconcile_behavior_events(date) set schema private;
alter function public.transition_ai_recommendation(uuid,text) set schema private;
alter function public.activate_workout_plan_recommendation(uuid) set schema private;

revoke all on function private.is_challenge_member(uuid) from public, anon;
revoke all on function private.has_challenge_invite(uuid) from public, anon;
revoke all on function private.is_accountability_connection(uuid) from public, anon;
revoke all on function private.reconcile_behavior_events(date) from public, anon;
revoke all on function private.transition_ai_recommendation(uuid,text) from public, anon;
revoke all on function private.activate_workout_plan_recommendation(uuid) from public, anon;
grant execute on function private.is_challenge_member(uuid) to authenticated;
grant execute on function private.has_challenge_invite(uuid) to authenticated;
grant execute on function private.is_accountability_connection(uuid) to authenticated;
grant execute on function private.reconcile_behavior_events(date) to authenticated;
grant execute on function private.transition_ai_recommendation(uuid,text) to authenticated;
grant execute on function private.activate_workout_plan_recommendation(uuid) to authenticated;

create function public.is_challenge_member(p_challenge_id uuid)
returns boolean language sql stable security invoker set search_path = public, private
as $$ select private.is_challenge_member(p_challenge_id); $$;
create function public.has_challenge_invite(p_challenge_id uuid)
returns boolean language sql stable security invoker set search_path = public, private
as $$ select private.has_challenge_invite(p_challenge_id); $$;
create function public.is_accountability_connection(p_user_id uuid)
returns boolean language sql stable security invoker set search_path = public, private
as $$ select private.is_accountability_connection(p_user_id); $$;
create function public.reconcile_behavior_events(p_through date default current_date - 1)
returns integer language sql security invoker set search_path = public, private
as $$ select private.reconcile_behavior_events(p_through); $$;
create function public.transition_ai_recommendation(p_id uuid,p_target text)
returns public.ai_recommendations language sql security invoker set search_path = public, private
as $$ select private.transition_ai_recommendation(p_id,p_target); $$;
create function public.activate_workout_plan_recommendation(p_id uuid)
returns uuid language sql security invoker set search_path = public, private
as $$ select private.activate_workout_plan_recommendation(p_id); $$;

revoke all on function public.is_challenge_member(uuid) from public, anon;
revoke all on function public.has_challenge_invite(uuid) from public, anon;
revoke all on function public.is_accountability_connection(uuid) from public, anon;
revoke all on function public.reconcile_behavior_events(date) from public, anon;
revoke all on function public.transition_ai_recommendation(uuid,text) from public, anon;
revoke all on function public.activate_workout_plan_recommendation(uuid) from public, anon;
grant execute on function public.is_challenge_member(uuid) to authenticated;
grant execute on function public.has_challenge_invite(uuid) to authenticated;
grant execute on function public.is_accountability_connection(uuid) to authenticated;
grant execute on function public.reconcile_behavior_events(date) to authenticated;
grant execute on function public.transition_ai_recommendation(uuid,text) to authenticated;
grant execute on function public.activate_workout_plan_recommendation(uuid) to authenticated;
