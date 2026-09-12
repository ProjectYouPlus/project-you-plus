-- Reset-specific performance hardening identified by Supabase advisor.
-- Keep ownership semantics identical while caching auth.uid() per statement.

create index if not exists reset_enrollments_weekly_review_idx
  on public.reset_enrollments(weekly_review_id)
  where weekly_review_id is not null;

drop policy if exists "users read own reset enrollments" on public.reset_enrollments;
create policy "users read own reset enrollments"
  on public.reset_enrollments for select
  using ((select auth.uid()) = user_id);

drop policy if exists "users insert own reset enrollments" on public.reset_enrollments;
create policy "users insert own reset enrollments"
  on public.reset_enrollments for insert
  with check ((select auth.uid()) = user_id);

drop policy if exists "users update own reset enrollments" on public.reset_enrollments;
create policy "users update own reset enrollments"
  on public.reset_enrollments for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "users read own reset snapshots" on public.reset_daily_snapshots;
create policy "users read own reset snapshots"
  on public.reset_daily_snapshots for select
  using ((select auth.uid()) = user_id);

drop policy if exists "users insert own reset snapshots" on public.reset_daily_snapshots;
create policy "users insert own reset snapshots"
  on public.reset_daily_snapshots for insert
  with check ((select auth.uid()) = user_id);

drop policy if exists "users update own reset snapshots" on public.reset_daily_snapshots;
create policy "users update own reset snapshots"
  on public.reset_daily_snapshots for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "users read own reset closures" on public.reset_daily_closures;
create policy "users read own reset closures"
  on public.reset_daily_closures for select
  using ((select auth.uid()) = user_id);

drop policy if exists "users insert own reset closures" on public.reset_daily_closures;
create policy "users insert own reset closures"
  on public.reset_daily_closures for insert
  with check ((select auth.uid()) = user_id);

drop policy if exists "users update own reset closures" on public.reset_daily_closures;
create policy "users update own reset closures"
  on public.reset_daily_closures for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "users read own reset patterns" on public.reset_patterns;
create policy "users read own reset patterns"
  on public.reset_patterns for select
  using ((select auth.uid()) = user_id);

drop policy if exists "users insert own reset patterns" on public.reset_patterns;
create policy "users insert own reset patterns"
  on public.reset_patterns for insert
  with check ((select auth.uid()) = user_id);

drop policy if exists "users update own reset patterns" on public.reset_patterns;
create policy "users update own reset patterns"
  on public.reset_patterns for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Keep Reset AI Operations policies narrow while avoiding per-row auth.uid() re-evaluation.
drop policy if exists "users insert own reset ai runs" on public.ai_agent_runs;
create policy "users insert own reset ai runs" on public.ai_agent_runs for insert with check (
  requested_by = (select auth.uid())
  and run_type = 'reset_retention'
  and agent_key = 'orchestrator'
  and coalesce(metadata->>'surface','') = 'reset'
  and coalesce(metadata->>'user_facing_agent','') = 'coach'
);

drop policy if exists "users read own reset ai runs" on public.ai_agent_runs;
create policy "users read own reset ai runs" on public.ai_agent_runs for select using (
  requested_by = (select auth.uid())
  and run_type = 'reset_retention'
  and agent_key = 'orchestrator'
);

drop policy if exists "users update own reset ai runs" on public.ai_agent_runs;
create policy "users update own reset ai runs" on public.ai_agent_runs for update using (
  requested_by = (select auth.uid())
  and run_type = 'reset_retention'
  and agent_key = 'orchestrator'
) with check (
  requested_by = (select auth.uid())
  and run_type = 'reset_retention'
  and agent_key = 'orchestrator'
);
