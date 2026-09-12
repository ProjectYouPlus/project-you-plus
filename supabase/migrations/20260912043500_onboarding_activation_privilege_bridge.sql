-- Keep behavior-event appends locked to trusted code while allowing the authenticated onboarding transaction to complete.
-- The activation function validates auth.uid(), selects only that user's session, and writes only that user's canonical records.
alter function public.activate_onboarding_system(uuid) security definer;
revoke all on function public.activate_onboarding_system(uuid) from public, anon;
grant execute on function public.activate_onboarding_system(uuid) to authenticated, service_role;
