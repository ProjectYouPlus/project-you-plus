-- Reconciliation only reads and writes the caller's RLS-scoped rows.
alter function public.reconcile_behavior_events(date) security invoker;
