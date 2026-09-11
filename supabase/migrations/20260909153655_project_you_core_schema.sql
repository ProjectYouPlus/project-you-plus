-- PROJECT YOU — core schema
-- Every table carries a user_id and an RLS policy scoping rows to auth.uid().
-- This is the enforcement layer for Section 20 (data isolation) and
-- Section 22 (privacy) of the product spec — never rely on the client
-- to filter by user, the database does it.

create extension if not exists "uuid-ossp";

-- ---------- Profile (1:1 with auth.users) ----------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  timezone text default 'UTC',
  onboarding_completed boolean default false,
  blueprint jsonb,
  created_at timestamptz default now()
);

create table goals (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  category text,
  target text,
  deadline date,
  progress numeric default 0,
  vision_12mo text,
  objective_90day text,
  status text default 'active',
  created_at timestamptz default now()
);

create table tasks (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid references goals(id) on delete set null,
  title text not null,
  tier text default 'optional',
  due_at timestamptz,
  completed_at timestamptz,
  ai_prioritized boolean default false,
  created_at timestamptz default now()
);

create table calendar_events (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text default 'internal',
  external_id text,
  title text not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  location text,
  created_at timestamptz default now()
);

create table habits (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  target_frequency text default 'daily',
  created_at timestamptz default now()
);

create table habit_logs (
  id uuid primary key default uuid_generate_v4(),
  habit_id uuid not null references habits(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  logged_at date not null default current_date,
  created_at timestamptz default now(),
  unique (habit_id, logged_at)
);

create table workouts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  type text,
  duration_minutes int,
  performed_at timestamptz not null default now(),
  source text default 'manual'
);

create table health_metrics (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  metric_type text not null,
  value numeric not null,
  recorded_at timestamptz not null default now(),
  source text default 'manual'
);

create table medications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  dosage text,
  schedule text,
  created_at timestamptz default now()
);

create table medication_logs (
  id uuid primary key default uuid_generate_v4(),
  medication_id uuid not null references medications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  taken_at timestamptz not null default now()
);

create table finance_accounts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  account_type text,
  balance numeric default 0,
  institution text,
  connected_via text default 'manual',
  created_at timestamptz default now()
);

create table transactions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid references finance_accounts(id) on delete set null,
  amount numeric not null,
  category text,
  merchant text,
  occurred_at timestamptz not null default now()
);

create table budgets (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null,
  monthly_limit numeric not null,
  period_start date not null default date_trunc('month', current_date)
);

create table bills (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  amount numeric not null,
  due_date date not null,
  paid boolean default false
);

create table ai_conversations (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null,
  content text not null,
  created_at timestamptz default now()
);

create table ai_insights (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  insight_type text,
  domain text,
  content text not null,
  action_taken boolean default false,
  created_at timestamptz default now()
);

create table daily_scores (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  score int not null,
  breakdown jsonb,
  scored_on date not null default current_date,
  unique (user_id, scored_on)
);

create table weekly_reviews (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  summary text,
  what_went_well text,
  needs_attention text,
  biggest_opportunity text,
  next_week_plan jsonb,
  created_at timestamptz default now()
);

create table notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text,
  read_at timestamptz,
  created_at timestamptz default now()
);

create table integrations (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  status text default 'available',
  connected_at timestamptz,
  metadata jsonb
);

do $$
declare t text;
begin
  for t in select unnest(array['profiles','goals','tasks','calendar_events','habits','habit_logs','workouts','health_metrics','medications','medication_logs','finance_accounts','transactions','budgets','bills','ai_conversations','ai_insights','daily_scores','weekly_reviews','notifications','integrations'])
  loop execute format('alter table %I enable row level security;', t); end loop;
end $$;

create policy "profiles_isolation" on profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

do $$
declare t text;
begin
  for t in select unnest(array['goals','tasks','calendar_events','habits','habit_logs','workouts','health_metrics','medications','medication_logs','finance_accounts','transactions','budgets','bills','ai_conversations','ai_insights','daily_scores','weekly_reviews','notifications','integrations'])
  loop
    execute format('create policy "%1$s_isolation" on %1$s for all using (auth.uid() = user_id) with check (auth.uid() = user_id);', t);
  end loop;
end $$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, onboarding_completed)
  values (new.id, new.raw_user_meta_data ->> 'full_name', false)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
