-- Historical bridge applied to the connected development database before the private event boundary.
-- The following migration immediately replaces this with SECURITY INVOKER plus a private scoped helper.
alter function public.activate_onboarding_system(uuid) security definer;
revoke all on function public.activate_onboarding_system(uuid) from public, anon;
grant execute on function public.activate_onboarding_system(uuid) to authenticated, service_role;
