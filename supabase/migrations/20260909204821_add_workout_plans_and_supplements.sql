create table if not exists workout_plans (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  goal text not null,
  days_per_week int not null check (days_per_week between 1 and 7),
  session_minutes int not null default 45,
  experience text not null default 'beginner',
  schedule jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  source text not null default 'project_you',
  created_at timestamptz not null default now()
);

create table if not exists workout_plan_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid not null references workout_plans(id) on delete cascade,
  session_key text not null,
  completed_on date not null default current_date,
  duration_minutes int,
  created_at timestamptz not null default now(),
  unique (user_id, plan_id, session_key, completed_on)
);

create table if not exists supplements (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  dosage text,
  timing text not null default 'morning',
  frequency text not null default 'daily',
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists supplement_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  supplement_id uuid not null references supplements(id) on delete cascade,
  logged_on date not null default current_date,
  taken_at timestamptz not null default now(),
  unique (user_id, supplement_id, logged_on)
);

alter table workout_plans enable row level security;
alter table workout_plan_logs enable row level security;
alter table supplements enable row level security;
alter table supplement_logs enable row level security;

drop policy if exists workout_plans_isolation on workout_plans;
create policy workout_plans_isolation on workout_plans for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists workout_plan_logs_isolation on workout_plan_logs;
create policy workout_plan_logs_isolation on workout_plan_logs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists supplements_isolation on supplements;
create policy supplements_isolation on supplements for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists supplement_logs_isolation on supplement_logs;
create policy supplement_logs_isolation on supplement_logs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists workout_plans_user_active_idx on workout_plans(user_id, active);
create index if not exists workout_plan_logs_user_day_idx on workout_plan_logs(user_id, completed_on);
create index if not exists supplements_user_active_idx on supplements(user_id, active);
create index if not exists supplement_logs_user_day_idx on supplement_logs(user_id, logged_on);
