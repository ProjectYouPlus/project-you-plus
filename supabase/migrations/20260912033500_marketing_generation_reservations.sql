-- Allow the provider worker to replace provisional estimates with Higgsfield's
-- authoritative estimate without double-reserving or racing concurrent jobs.

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
  where owner_id = j.owner_id and campaign_id = j.campaign_id and provider = j.provider
  for update;
  if not found then raise exception 'Campaign credit budget is not configured'; end if;

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
