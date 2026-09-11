-- Finance V1 extends the existing finance tables and shared goals/event history.
alter table public.transactions
  add column if not exists original_category text,
  add column if not exists transaction_type text not null default 'unknown',
  add column if not exists pending_transaction_id text,
  add column if not exists iso_currency_code text,
  add column if not exists provider text;

alter table public.transactions drop constraint if exists transactions_transaction_type_check;
alter table public.transactions add constraint transactions_transaction_type_check
  check (transaction_type in ('income','expense','refund','transfer','credit_card_payment','unknown'));

alter table public.finance_accounts drop constraint if exists finance_accounts_account_type_check;
alter table public.finance_accounts add constraint finance_accounts_account_type_check
  check (account_type is null or account_type in ('checking','savings','credit','investment','cash','loan','liability','other'));

alter table public.finance_accounts drop constraint if exists finance_accounts_connected_via_check;
alter table public.finance_accounts add constraint finance_accounts_connected_via_check
  check (connected_via is null or connected_via in ('manual','plaid'));

alter table public.budgets add column if not exists updated_at timestamptz not null default now();
alter table public.budgets drop constraint if exists budgets_monthly_limit_nonnegative;
alter table public.budgets add constraint budgets_monthly_limit_nonnegative check (monthly_limit >= 0);

alter table public.bills add column if not exists updated_at timestamptz not null default now();
alter table public.bills drop constraint if exists bills_amount_nonnegative;
alter table public.bills add constraint bills_amount_nonnegative check (amount >= 0);

alter table public.goals
  add column if not exists financial_goal_type text,
  add column if not exists current_amount numeric,
  add column if not exists target_amount numeric,
  add column if not exists target_monthly_contribution numeric,
  add column if not exists linked_account_id uuid references public.finance_accounts(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists completed_at timestamptz;

alter table public.goals drop constraint if exists goals_financial_goal_type_check;
alter table public.goals add constraint goals_financial_goal_type_check
  check (financial_goal_type is null or financial_goal_type in ('emergency_fund','savings','debt_payoff','purchase','investment','custom'));
alter table public.goals drop constraint if exists goals_financial_amounts_nonnegative;
alter table public.goals add constraint goals_financial_amounts_nonnegative
  check ((current_amount is null or current_amount >= 0) and (target_amount is null or target_amount > 0) and (target_monthly_contribution is null or target_monthly_contribution >= 0));

create index if not exists transactions_user_date_idx on public.transactions(user_id, occurred_at desc);
create index if not exists transactions_account_date_idx on public.transactions(account_id, occurred_at desc) where account_id is not null;
create index if not exists transactions_user_category_date_idx on public.transactions(user_id, category, occurred_at desc);
create unique index if not exists budgets_user_period_category_idx on public.budgets(user_id, period_start, lower(category));
create index if not exists bills_user_due_idx on public.bills(user_id, paid, due_date);
create index if not exists goals_user_finance_status_idx on public.goals(user_id, status, deadline) where category = 'finance';

create or replace function private.set_row_updated_at() returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists budgets_updated_at on public.budgets;
create trigger budgets_updated_at before update on public.budgets for each row execute function private.set_row_updated_at();
drop trigger if exists bills_updated_at on public.bills;
create trigger bills_updated_at before update on public.bills for each row execute function private.set_row_updated_at();
drop trigger if exists goals_updated_at on public.goals;
create trigger goals_updated_at before update on public.goals for each row execute function private.set_row_updated_at();

alter table public.behavior_events drop constraint if exists behavior_events_event_type_check;
alter table public.behavior_events add constraint behavior_events_event_type_check check(event_type in (
  'task.completed','task.missed','habit.completed','habit.missed','workout.completed','workout.missed',
  'meal.logged','supplement.completed','calendar.changed','spending.threshold','goal.progress_changed',
  'score.changed','achievement.unlocked','milestone.unlocked','first_week.completed','pattern.discovered',
  'workout.plan_activated','workout.schedule_changed','finance.goal_created','finance.goal_completed'
));

create or replace function private.capture_finance_goal_event() returns trigger
language plpgsql security definer set search_path = public, private as $$
begin
  if new.category <> 'finance' then return new; end if;
  if tg_op = 'INSERT' then
    perform public.append_behavior_event(new.user_id,'finance.goal_created','finance.goal_created:'||new.id,'goals',new.id::text,new.created_at,
      jsonb_build_object('title',new.title,'current_amount',new.current_amount,'target_amount',new.target_amount,'target_date',new.deadline));
  elsif coalesce(old.current_amount,0) <> coalesce(new.current_amount,0) then
    perform public.append_behavior_event(new.user_id,'goal.progress_changed','finance.goal.progress:'||new.id||':'||coalesce(new.current_amount,0),'goals',new.id::text,now(),
      jsonb_build_object('previous_amount',old.current_amount,'current_amount',new.current_amount,'target_amount',new.target_amount,'previous',old.progress,'current',new.progress));
  end if;
  if tg_op = 'UPDATE' and old.status is distinct from new.status and new.status = 'completed' then
    perform public.append_behavior_event(new.user_id,'finance.goal_completed','finance.goal_completed:'||new.id,'goals',new.id::text,coalesce(new.completed_at,now()),
      jsonb_build_object('title',new.title,'target_amount',new.target_amount));
  end if;
  return new;
end $$;
revoke all on function private.capture_finance_goal_event() from public, anon, authenticated;

drop trigger if exists finance_goal_event on public.goals;
create trigger finance_goal_event after insert or update on public.goals
for each row execute function private.capture_finance_goal_event();

drop policy if exists finance_accounts_isolation on public.finance_accounts;
create policy finance_accounts_isolation on public.finance_accounts for all to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists transactions_isolation on public.transactions;
create policy transactions_isolation on public.transactions for all to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists budgets_isolation on public.budgets;
create policy budgets_isolation on public.budgets for all to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists bills_isolation on public.bills;
create policy bills_isolation on public.bills for all to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists investment_holdings_isolation on public.investment_holdings;
create policy investment_holdings_isolation on public.investment_holdings for all to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists integrations_isolation on public.integrations;
create policy integrations_isolation on public.integrations for all to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
