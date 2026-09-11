create table if not exists public.ai_department_budget (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  monthly_budget_cents integer not null default 5000 check (monthly_budget_cents >= 0),
  development_enabled boolean not null default true,
  growth_enabled boolean not null default true,
  budget_month date not null default date_trunc('month', now())::date,
  estimated_spend_cents integer not null default 0 check (estimated_spend_cents >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_department_spend_ledger (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  department text not null check (department in ('development','growth')),
  agent_key text,
  estimated_cost_cents integer not null default 0 check (estimated_cost_cents >= 0),
  source text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.ai_department_budget enable row level security;
alter table public.ai_department_spend_ledger enable row level security;

drop policy if exists "owner manages ai department budget" on public.ai_department_budget;
create policy "owner manages ai department budget" on public.ai_department_budget
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "owner manages ai spend ledger" on public.ai_department_spend_ledger;
create policy "owner manages ai spend ledger" on public.ai_department_spend_ledger
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create index if not exists ai_department_spend_owner_created_idx
  on public.ai_department_spend_ledger(owner_id, created_at desc);
