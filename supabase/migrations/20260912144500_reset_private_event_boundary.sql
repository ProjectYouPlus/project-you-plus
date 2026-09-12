-- Move Reset meaningful-event privilege behind the existing private-schema pattern.
-- The public RPC remains SECURITY INVOKER so authenticated callers cannot directly invoke a privileged exposed function.

create or replace function private.append_reset_behavior_event(
  p_enrollment_id uuid,
  p_event_type text,
  p_payload jsonb default '{}'::jsonb,
  p_dedupe_key text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_event_type not in (
    'reset.started',
    'reset.day_closed',
    'reset.minimum_day_used',
    'reset.returned',
    'reset.pattern_detected',
    'reset.pattern_confirmed',
    'reset.pattern_rejected',
    'reset.adjustment_proposed',
    'reset.adjustment_approved',
    'reset.weekly_review_completed',
    'reset.completed'
  ) then
    raise exception 'Invalid Reset event type';
  end if;

  if not exists (
    select 1
    from public.reset_enrollments
    where id = p_enrollment_id
      and user_id = v_user_id
  ) then
    raise exception 'Reset enrollment not found';
  end if;

  v_id := public.append_behavior_event(
    v_user_id,
    p_event_type,
    p_dedupe_key,
    'reset_enrollments',
    p_enrollment_id::text,
    now(),
    coalesce(p_payload, '{}'::jsonb)
  );

  return v_id;
end;
$$;

revoke all on function private.append_reset_behavior_event(uuid,text,jsonb,text) from public, anon;
grant execute on function private.append_reset_behavior_event(uuid,text,jsonb,text) to authenticated;

create or replace function public.append_reset_behavior_event(
  p_enrollment_id uuid,
  p_event_type text,
  p_payload jsonb default '{}'::jsonb,
  p_dedupe_key text default null
)
returns uuid
language sql
security invoker
set search_path = public, private, pg_temp
as $$
  select private.append_reset_behavior_event(
    p_enrollment_id,
    p_event_type,
    p_payload,
    p_dedupe_key
  );
$$;

revoke all on function public.append_reset_behavior_event(uuid,text,jsonb,text) from public, anon;
grant execute on function public.append_reset_behavior_event(uuid,text,jsonb,text) to authenticated;
