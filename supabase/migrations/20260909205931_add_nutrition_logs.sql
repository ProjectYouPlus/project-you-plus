create table if not exists nutrition_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  meal_name text,
  calories int not null default 0,
  protein_g numeric not null default 0,
  carbs_g numeric not null default 0,
  fat_g numeric not null default 0,
  foods jsonb not null default '[]'::jsonb,
  source text not null default 'manual',
  logged_at timestamptz not null default now()
);
alter table nutrition_logs enable row level security;
drop policy if exists nutrition_logs_isolation on nutrition_logs;
create policy nutrition_logs_isolation on nutrition_logs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists nutrition_logs_user_logged_idx on nutrition_logs(user_id, logged_at desc);
