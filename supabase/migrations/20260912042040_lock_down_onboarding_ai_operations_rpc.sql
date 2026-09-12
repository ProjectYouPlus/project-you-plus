revoke all on function public.begin_onboarding_ai_operation(text) from public;
revoke all on function public.begin_onboarding_ai_operation(text) from anon;
grant execute on function public.begin_onboarding_ai_operation(text) to authenticated;

revoke all on function public.finish_onboarding_ai_operation(bigint,text,text,jsonb) from public;
revoke all on function public.finish_onboarding_ai_operation(bigint,text,text,jsonb) from anon;
grant execute on function public.finish_onboarding_ai_operation(bigint,text,text,jsonb) to authenticated;
