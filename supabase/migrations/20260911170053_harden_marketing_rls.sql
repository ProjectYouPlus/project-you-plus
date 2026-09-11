do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'marketing_agent_runs', 'marketing_content_items', 'marketing_trend_signals',
    'marketing_daily_metrics', 'marketing_community_actions', 'marketing_partnerships'
  ]
  loop
    execute format('drop policy if exists "owner manages %I" on public.%I', table_name, table_name);
    execute format(
      'create policy "owner manages %I" on public.%I for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id)',
      table_name, table_name
    );
  end loop;
end $$;

drop policy if exists "owner manages marketing_campaigns" on public.marketing_campaigns;
create policy "owner manages marketing_campaigns" on public.marketing_campaigns for all to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);

drop policy if exists "owner manages marketing_learnings" on public.marketing_learnings;
create policy "owner manages marketing_learnings" on public.marketing_learnings for all to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);

drop policy if exists "owner manages ai department budget" on public.ai_department_budget;
create policy "owner manages ai department budget" on public.ai_department_budget for all to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);

drop policy if exists "owner manages ai spend ledger" on public.ai_department_spend_ledger;
create policy "owner manages ai spend ledger" on public.ai_department_spend_ledger for all to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);

create index if not exists marketing_content_campaign_idx on public.marketing_content_items(campaign_id);
create index if not exists marketing_learnings_content_idx on public.marketing_learnings(content_item_id);
