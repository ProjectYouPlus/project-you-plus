-- Marketing agents may run concurrently in separate execution lanes.
-- A small lane cap prevents runaway external API usage while allowing the
-- content pipeline (Frame, Signal, Muse, provider work) to progress in parallel.

update public.marketing_agent_runs
set status = 'failed',
    finished_at = coalesce(finished_at, now()),
    error_message = coalesce(error_message, 'Closed during marketing concurrency upgrade'),
    metadata = metadata || jsonb_build_object('closed_by', 'marketing_concurrency_upgrade')
where status in ('queued', 'running')
  and coalesce(started_at, created_at) < now() - interval '10 minutes';

drop index if exists public.marketing_agent_runs_one_active_per_owner_idx;

create index if not exists marketing_agent_runs_owner_active_idx
  on public.marketing_agent_runs(owner_id, created_at desc)
  where status in ('queued', 'running');
