-- Trigger helpers are internal. Only the authenticated reconciliation RPC is exposed.
revoke all on function public.append_behavior_event(uuid,text,text,text,text,timestamptz,jsonb) from public, anon, authenticated;
revoke all on function public.capture_behavior_event() from public, anon, authenticated;
revoke all on function public.reconcile_behavior_events(date) from public, anon, authenticated;
grant execute on function public.reconcile_behavior_events(date) to authenticated;
