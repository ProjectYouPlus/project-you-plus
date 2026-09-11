-- Marketing agents share one execution lane per owner. This prevents simultaneous
-- AI calls from multiplying serverless runtime and external API usage.
update public.marketing_agent_runs
set status = 'failed',
    metadata = metadata || jsonb_build_object('closed_by', 'run_guard_install')
where status in ('queued', 'running');

create unique index if not exists marketing_agent_runs_one_active_per_owner_idx
  on public.marketing_agent_runs(owner_id)
  where status in ('queued', 'running');
