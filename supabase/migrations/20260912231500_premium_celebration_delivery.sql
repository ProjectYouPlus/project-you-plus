create table if not exists public.celebration_receipts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id uuid not null references public.behavior_events(id) on delete cascade,
  first_presented_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  skipped boolean not null default false,
  created_at timestamptz not null default now(),
  unique(user_id,event_id)
);
create index if not exists celebration_receipts_user_pending_idx on public.celebration_receipts(user_id,acknowledged_at,first_presented_at desc);
alter table public.celebration_receipts enable row level security;
drop policy if exists celebration_receipts_isolation on public.celebration_receipts;
create policy celebration_receipts_isolation on public.celebration_receipts for select to authenticated using((select auth.uid())=user_id);
revoke all on public.celebration_receipts from anon;
revoke insert,update,delete,truncate on public.celebration_receipts from authenticated;
grant select on public.celebration_receipts to authenticated;

comment on table public.celebration_receipts is 'Presentation state for canonical progression events. Earned state remains in achievements, milestones, and behavior_events.';

-- Existing progression history was already presented by the legacy UI. Mark it
-- delivered so this release celebrates only newly earned events.
insert into public.celebration_receipts (user_id, event_id, first_presented_at, acknowledged_at, skipped)
select user_id, id, now(), now(), true
from public.behavior_events
where event_type in ('achievement.unlocked', 'milestone.unlocked', 'progression.one_percent_earned')
on conflict (user_id, event_id) do nothing;
