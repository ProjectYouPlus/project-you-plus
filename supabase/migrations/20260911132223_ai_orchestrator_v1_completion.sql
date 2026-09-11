alter table public.ai_recommendations
  add column if not exists source_agent text;

update public.ai_recommendations
set source_agent = case
  when domain in ('planner','health','finance','progress') then domain
  else 'coach'
end
where source_agent is null;

alter table public.ai_recommendations
  alter column source_agent set default 'coach',
  alter column source_agent set not null;

alter table public.ai_recommendations
  drop constraint if exists ai_recommendations_source_agent_check;
alter table public.ai_recommendations
  add constraint ai_recommendations_source_agent_check
  check (source_agent in ('coach','planner','health','finance','progress'));

-- Equivalent advice is unique only while it can still be acted on. Once a
-- recommendation is dismissed, completed, or expired, it may be proposed again
-- if fresh evidence makes it useful.
drop index if exists public.ai_recommendations_user_dedupe_idx;
create unique index if not exists ai_recommendations_active_dedupe_idx
  on public.ai_recommendations(user_id,dedupe_key)
  where dedupe_key is not null and status in ('pending','accepted');
