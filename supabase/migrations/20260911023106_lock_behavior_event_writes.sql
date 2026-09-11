-- Event integrity: clients can read their own history but only trusted trigger/RPC
-- code may append facts derived from source records.
drop policy if exists behavior_events_insert_own on public.behavior_events;
revoke insert, update, delete on public.behavior_events from authenticated;
grant select on public.behavior_events to authenticated;
alter function public.reconcile_behavior_events(date) security definer;
