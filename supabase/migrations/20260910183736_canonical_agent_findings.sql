create or replace function private.normalize_ai_agent_finding_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.agent_key <> 'orchestrator' or new.severity = 'info' then
    new.status := 'acknowledged';
    return new;
  end if;

  update public.ai_agent_findings
     set status = 'dismissed',
         resolved_at = coalesce(resolved_at, now())
   where status = 'open'
     and agent_key = 'orchestrator'
     and run_id is distinct from new.run_id;

  return new;
end;
$$;

revoke all on function private.normalize_ai_agent_finding_status() from public, anon, authenticated;

drop trigger if exists ai_agent_findings_canonicalize on public.ai_agent_findings;
create trigger ai_agent_findings_canonicalize
before insert on public.ai_agent_findings
for each row execute function private.normalize_ai_agent_finding_status();

update public.ai_agent_findings
   set status = 'acknowledged',
       resolved_at = coalesce(resolved_at, now())
 where status = 'open'
   and (agent_key <> 'orchestrator' or severity = 'info');

with latest as (
  select max(run_id) as run_id
  from public.ai_agent_findings
  where status = 'open'
    and agent_key = 'orchestrator'
    and severity <> 'info'
)
update public.ai_agent_findings f
   set status = 'dismissed',
       resolved_at = coalesce(resolved_at, now())
 where f.status = 'open'
   and f.agent_key = 'orchestrator'
   and f.run_id is distinct from (select run_id from latest);
