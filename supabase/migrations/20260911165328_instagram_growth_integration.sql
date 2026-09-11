alter table public.marketing_community_actions add column if not exists external_id text;
alter table public.marketing_community_actions add column if not exists metadata jsonb not null default '{}'::jsonb;
create unique index if not exists marketing_community_owner_external_idx
  on public.marketing_community_actions(owner_id, external_id) where external_id is not null;

grant select, insert, update on public.marketing_agent_runs,
  public.marketing_content_items, public.marketing_trend_signals,
  public.marketing_daily_metrics, public.marketing_community_actions,
  public.marketing_partnerships, public.marketing_campaigns,
  public.marketing_learnings, public.ai_department_budget,
  public.ai_department_spend_ledger to authenticated;
