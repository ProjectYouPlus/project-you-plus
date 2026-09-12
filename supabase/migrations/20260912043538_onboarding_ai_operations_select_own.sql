drop policy if exists "users read own onboarding ai runs" on public.ai_agent_runs;
create policy "users read own onboarding ai runs" on public.ai_agent_runs
  for select to authenticated
  using (requested_by = auth.uid() and run_type = 'onboarding_generation' and agent_key = 'orchestrator');
