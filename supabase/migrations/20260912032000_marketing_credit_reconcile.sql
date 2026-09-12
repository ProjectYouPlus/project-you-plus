-- Reconcile Higgsfield credit accounting from the generation-job ledger and make
-- settlement robust to jobs that jump directly from queued/processing to terminal.

create or replace function private.settle_marketing_generation_budget()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  charge numeric(10,2);
  reserved numeric(10,2);
begin
  if new.status in ('succeeded','failed','cancelled')
     and old.status not in ('succeeded','failed','cancelled') then
    reserved := coalesce(old.estimated_credits, 0);
    charge := case
      when new.status = 'succeeded' then coalesce(new.actual_credits, new.estimated_credits, old.estimated_credits, 0)
      else 0
    end;

    update public.marketing_credit_budgets
    set credits_reserved = greatest(0, credits_reserved - reserved),
        credits_used = credits_used + charge,
        updated_at = now()
    where owner_id = new.owner_id and campaign_id = new.campaign_id;
  end if;

  return new;
end;
$$;

-- Rebuild this month's used/reserved counters from source-of-truth generation rows.
with totals as (
  select
    b.id as budget_id,
    coalesce(sum(case
      when j.status = 'succeeded'
       and j.created_at::date between b.period_start and b.period_end
      then coalesce(j.actual_credits, j.estimated_credits, 0)
      else 0 end), 0)::numeric(10,2) as used,
    coalesce(sum(case
      when j.status in ('awaiting_provider','submitted','processing')
       and j.created_at::date between b.period_start and b.period_end
      then coalesce(j.estimated_credits, 0)
      else 0 end), 0)::numeric(10,2) as reserved
  from public.marketing_credit_budgets b
  left join public.marketing_generation_jobs j
    on j.owner_id = b.owner_id
   and j.campaign_id = b.campaign_id
   and j.provider = b.provider
  group by b.id
)
update public.marketing_credit_budgets b
set credits_used = t.used,
    credits_reserved = t.reserved,
    updated_at = now()
from totals t
where b.id = t.budget_id;
