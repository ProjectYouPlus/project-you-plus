-- Cover Finance V1 foreign keys used by linked goals and investment cleanup.
create index if not exists goals_linked_account_idx on public.goals(linked_account_id) where linked_account_id is not null;
create index if not exists investment_holdings_account_idx on public.investment_holdings(account_id) where account_id is not null;
