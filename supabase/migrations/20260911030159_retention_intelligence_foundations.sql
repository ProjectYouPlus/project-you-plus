create table if not exists public.user_intelligence_events (
  id uuid primary key default uuid_generate_v4(), user_id uuid not null references auth.users(id) on delete cascade,
  event_name text not null, domain text not null default 'general', entity_type text, entity_id text,
  occurred_at timestamptz not null default now(), value numeric, metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
alter table public.user_intelligence_events add column if not exists dedupe_key text;
create unique index if not exists user_intelligence_events_user_dedupe_idx on public.user_intelligence_events(user_id,dedupe_key);
create index if not exists user_intelligence_events_user_time_idx on public.user_intelligence_events(user_id,occurred_at desc);
alter table public.user_intelligence_events enable row level security;
drop policy if exists user_intelligence_events_isolation on public.user_intelligence_events;
create policy user_intelligence_events_read_own on public.user_intelligence_events for select to authenticated using((select auth.uid())=user_id);
revoke all on public.user_intelligence_events from anon;
revoke insert,update,delete,truncate on public.user_intelligence_events from authenticated;
grant select on public.user_intelligence_events to authenticated;

alter table public.notifications add column if not exists notification_key text;
alter table public.notifications add column if not exists notification_type text not null default 'general';
alter table public.notifications add column if not exists metadata jsonb not null default '{}'::jsonb;
create unique index if not exists notifications_user_key_idx on public.notifications(user_id,notification_key) where notification_key is not null;
create index if not exists notifications_user_unread_idx on public.notifications(user_id,created_at desc) where read_at is null;
