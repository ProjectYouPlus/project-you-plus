-- Marketing execution v2: allow a small number of concurrent agent runs and
-- automatically clear stale work so one failed request cannot block the department.

update public.marketing_agent_runs
set status = 'failed',
    finished_at = coalesce(finished_at, now()),
    error_message = coalesce(error_message, 'Automatically closed as stale during concurrency upgrade'),
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('closed_by', 'marketing_concurrency_v2')
where status in ('queued', 'running')
  and coalesce(started_at, created_at) < now() - interval '5 minutes';

drop index if exists public.marketing_agent_runs_one_active_per_owner_idx;

create index if not exists marketing_agent_runs_owner_active_idx
  on public.marketing_agent_runs(owner_id, created_at desc)
  where status in ('queued', 'running');

create or replace function private.enforce_marketing_agent_concurrency()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  active_count integer;
begin
  if new.status not in ('queued', 'running') then
    return new;
  end if;

  -- Serialize the admission check per owner to avoid races between simultaneous runs.
  perform pg_advisory_xact_lock(hashtextextended(new.owner_id::text, 72426));

  update public.marketing_agent_runs
  set status = 'failed',
      finished_at = coalesce(finished_at, now()),
      error_message = coalesce(error_message, 'Automatically closed after exceeding the 5-minute active window'),
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('closed_by', 'stale_run_reaper')
  where owner_id = new.owner_id
    and id is distinct from new.id
    and status in ('queued', 'running')
    and coalesce(started_at, created_at) < now() - interval '5 minutes';

  select count(*) into active_count
  from public.marketing_agent_runs
  where owner_id = new.owner_id
    and id is distinct from new.id
    and status in ('queued', 'running');

  if active_count >= 3 then
    raise exception 'Marketing execution lanes are full. Try again after an active run completes.';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_marketing_agent_concurrency on public.marketing_agent_runs;
create trigger enforce_marketing_agent_concurrency
before insert or update of status on public.marketing_agent_runs
for each row execute function private.enforce_marketing_agent_concurrency();
