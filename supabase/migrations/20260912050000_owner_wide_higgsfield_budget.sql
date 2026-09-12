-- Higgsfield credits are an owner/provider monthly allowance, not a per-campaign allowance.
-- Keep campaign_id for compatibility/display, but enforce and settle against the single
-- owner/provider budget row and aggregate generation jobs across all campaigns.

create or replace function private.enforce_marketing_generation_budget()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_budget_id uuid;
  v_used numeric(10,2);
  v_reserved numeric(10,2);
  v_allowance numeric(10,2);
  v_operational numeric(10,2);
  v_limit numeric(10,2);
begin
  if new.status in ('failed','cancelled','reused') or coalesce(new.estimated_credits, 0) = 0 then
    return new;
  end if;

  select id, credits_used, credits_reserved, monthly_allowance, operational_budget
    into v_budget_id, v_used, v_reserved, v_allowance, v_operational
  from public.marketing_credit_budgets
  where owner_id = new.owner_id and provider = new.provider
  order by updated_at desc
  limit 1
  for update;

  if not found then
    raise exception 'Provider credit budget is not configured';
  end if;

  v_limit := case when new.reserve_authorized then v_allowance else v_operational end;
  if v_used + v_reserved + new.estimated_credits > v_limit then
    raise exception 'Higgsfield credit limit reached. Owner reserve approval is required.';
  end if;

  update public.marketing_credit_budgets
  set credits_reserved = credits_reserved + new.estimated_credits,
      updated_at = now()
  where id = v_budget_id;
  return new;
end;
$$;

create or replace function private.settle_marketing_generation_budget()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_budget_id uuid;
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

    select id into v_budget_id
    from public.marketing_credit_budgets
    where owner_id = new.owner_id and provider = new.provider
    order by updated_at desc
    limit 1
    for update;

    if v_budget_id is not null then
      update public.marketing_credit_budgets
      set credits_reserved = greatest(0, credits_reserved - reserved),
          credits_used = credits_used + charge,
          updated_at = now()
      where id = v_budget_id;
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.reserve_marketing_generation_estimate(
  p_job_id uuid,
  p_estimate numeric
)
returns numeric
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  j public.marketing_generation_jobs%rowtype;
  b public.marketing_credit_budgets%rowtype;
  delta numeric(10,2);
  spend_limit numeric(10,2);
begin
  select * into j
  from public.marketing_generation_jobs
  where id = p_job_id
  for update;
  if not found then raise exception 'Generation job not found'; end if;
  if j.status in ('succeeded','failed','cancelled','reused') then
    return coalesce(j.estimated_credits, 0);
  end if;

  select * into b
  from public.marketing_credit_budgets
  where owner_id = j.owner_id and provider = j.provider
  order by updated_at desc
  limit 1
  for update;
  if not found then raise exception 'Provider credit budget is not configured'; end if;

  p_estimate := greatest(0, coalesce(p_estimate, 0));
  delta := p_estimate - coalesce(j.estimated_credits, 0);
  spend_limit := case when j.reserve_authorized then b.monthly_allowance else b.operational_budget end;

  if delta > 0 and b.credits_used + b.credits_reserved + delta > spend_limit then
    raise exception 'Higgsfield credit limit reached. Owner reserve approval is required.';
  end if;

  update public.marketing_credit_budgets
  set credits_reserved = greatest(0, credits_reserved + delta),
      updated_at = now()
  where id = b.id;

  update public.marketing_generation_jobs
  set estimated_credits = p_estimate,
      updated_at = now()
  where id = j.id;

  return p_estimate;
end;
$$;

revoke all on function public.reserve_marketing_generation_estimate(uuid,numeric) from public, anon, authenticated;
grant execute on function public.reserve_marketing_generation_estimate(uuid,numeric) to service_role;

with owner_totals as (
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
   and j.provider = b.provider
  group by b.id
)
update public.marketing_credit_budgets b
set credits_used = t.used,
    credits_reserved = t.reserved,
    updated_at = now()
from owner_totals t
where b.id = t.budget_id;
