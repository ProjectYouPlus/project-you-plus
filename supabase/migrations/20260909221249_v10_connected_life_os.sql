create table if not exists public.reminders (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  target_type text not null check (target_type in ('task','habit','workout','supplement','custom')),
  target_id uuid,
  title text not null,
  remind_at timestamptz,
  time_of_day time,
  days_of_week smallint[] default '{}',
  recurrence text not null default 'once' check (recurrence in ('once','daily','weekdays','weekly','custom')),
  channel text not null default 'in_app' check (channel in ('in_app','push','email')),
  enabled boolean not null default true,
  last_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists reminders_user_enabled_idx on public.reminders(user_id, enabled);
create index if not exists reminders_due_idx on public.reminders(remind_at) where enabled = true;
alter table public.reminders enable row level security;
drop policy if exists reminders_isolation on public.reminders;
create policy reminders_isolation on public.reminders for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create table if not exists public.push_subscriptions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth_secret text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, endpoint)
);
alter table public.push_subscriptions enable row level security;
drop policy if exists push_subscriptions_isolation on public.push_subscriptions;
create policy push_subscriptions_isolation on public.push_subscriptions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create table if not exists public.social_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  handle text,
  display_name text,
  avatar_url text,
  discoverable boolean not null default false,
  share_streaks boolean not null default true,
  share_score boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists social_profiles_handle_lower_idx on public.social_profiles(lower(handle)) where handle is not null;
alter table public.social_profiles enable row level security;
drop policy if exists social_profiles_self_write on public.social_profiles;
create policy social_profiles_self_write on public.social_profiles for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists social_profiles_discoverable_read on public.social_profiles;
create policy social_profiles_discoverable_read on public.social_profiles for select using (discoverable = true or auth.uid() = user_id);
create table if not exists public.accountability_connections (
  id uuid primary key default uuid_generate_v4(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  addressee_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined','blocked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (requester_id <> addressee_id)
);
create unique index if not exists accountability_connection_pair_idx on public.accountability_connections(least(requester_id, addressee_id), greatest(requester_id, addressee_id));
alter table public.accountability_connections enable row level security;
drop policy if exists accountability_connections_read on public.accountability_connections;
create policy accountability_connections_read on public.accountability_connections for select using (auth.uid() in (requester_id, addressee_id));
drop policy if exists accountability_connections_insert on public.accountability_connections;
create policy accountability_connections_insert on public.accountability_connections for insert with check (auth.uid() = requester_id);
drop policy if exists accountability_connections_update on public.accountability_connections;
create policy accountability_connections_update on public.accountability_connections for update using (auth.uid() in (requester_id, addressee_id)) with check (auth.uid() in (requester_id, addressee_id));
drop policy if exists accountability_connections_delete on public.accountability_connections;
create policy accountability_connections_delete on public.accountability_connections for delete using (auth.uid() in (requester_id, addressee_id));
create table if not exists public.challenges (
  id uuid primary key default uuid_generate_v4(),
  creator_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  metric text not null default 'consistency_points' check (metric in ('consistency_points','workouts','habit_days','task_wins')),
  starts_on date not null default current_date,
  ends_on date not null,
  status text not null default 'active' check (status in ('draft','active','completed','cancelled')),
  privacy text not null default 'friends' check (privacy in ('friends','private')),
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);
create table if not exists public.challenge_members (
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  points integer not null default 0,
  joined_at timestamptz not null default now(),
  primary key(challenge_id, user_id)
);
create or replace function public.is_challenge_member(p_challenge_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$ select exists(select 1 from public.challenge_members cm where cm.challenge_id = p_challenge_id and cm.user_id = auth.uid()); $$;
revoke all on function public.is_challenge_member(uuid) from public;
grant execute on function public.is_challenge_member(uuid) to authenticated;
alter table public.challenges enable row level security;
alter table public.challenge_members enable row level security;
drop policy if exists challenges_read on public.challenges;
create policy challenges_read on public.challenges for select using (creator_id = auth.uid() or public.is_challenge_member(id));
drop policy if exists challenges_write on public.challenges;
create policy challenges_write on public.challenges for all using (creator_id = auth.uid()) with check (creator_id = auth.uid());
drop policy if exists challenge_members_read on public.challenge_members;
create policy challenge_members_read on public.challenge_members for select using (public.is_challenge_member(challenge_id));
drop policy if exists challenge_members_join on public.challenge_members;
create policy challenge_members_join on public.challenge_members for insert with check (user_id = auth.uid());
drop policy if exists challenge_members_leave on public.challenge_members;
create policy challenge_members_leave on public.challenge_members for delete using (user_id = auth.uid());
create table if not exists public.integration_secrets (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  secret_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, provider)
);
alter table public.integration_secrets enable row level security;
create unique index if not exists integrations_user_provider_idx on public.integrations(user_id, provider);
alter table public.finance_accounts add column if not exists provider_account_id text;
alter table public.finance_accounts add column if not exists mask text;
alter table public.finance_accounts add column if not exists last_synced_at timestamptz;
create unique index if not exists finance_accounts_provider_account_idx on public.finance_accounts(user_id, connected_via, provider_account_id) where provider_account_id is not null;
alter table public.transactions add column if not exists provider_transaction_id text;
alter table public.transactions add column if not exists pending boolean not null default false;
create unique index if not exists transactions_provider_transaction_idx on public.transactions(user_id, provider_transaction_id) where provider_transaction_id is not null;
alter table public.calendar_events add column if not exists calendar_id text;
alter table public.calendar_events add column if not exists synced_at timestamptz;
create unique index if not exists calendar_events_provider_external_idx on public.calendar_events(user_id, source, external_id) where external_id is not null;
