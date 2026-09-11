create or replace function public.is_accountability_connection(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.accountability_connections ac
    where ac.status = 'accepted'
      and ((ac.requester_id = auth.uid() and ac.addressee_id = p_user_id)
        or (ac.addressee_id = auth.uid() and ac.requester_id = p_user_id))
  );
$$;
revoke all on function public.is_accountability_connection(uuid) from public;
grant execute on function public.is_accountability_connection(uuid) to authenticated;
drop policy if exists social_profiles_discoverable_read on public.social_profiles;
create policy social_profiles_discoverable_read on public.social_profiles for select
using (discoverable = true or auth.uid() = user_id or public.is_accountability_connection(user_id));
create table if not exists public.investment_holdings (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid references public.finance_accounts(id) on delete cascade,
  provider text not null default 'plaid',
  provider_security_id text,
  ticker text,
  name text not null,
  quantity numeric,
  price numeric,
  value numeric,
  as_of timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create unique index if not exists investment_holdings_provider_security_idx on public.investment_holdings(user_id, account_id, provider, provider_security_id) where provider_security_id is not null;
alter table public.investment_holdings enable row level security;
drop policy if exists investment_holdings_isolation on public.investment_holdings;
create policy investment_holdings_isolation on public.investment_holdings for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
