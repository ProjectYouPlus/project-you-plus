create table if not exists work_schedules (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null default 'Work',
  days_of_week int[] not null default array[1,2,3,4,5],
  start_time time not null default '09:00',
  end_time time not null default '17:00',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table work_schedules enable row level security;
drop policy if exists work_schedules_isolation on work_schedules;
create policy work_schedules_isolation on work_schedules for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists work_schedules_user_active_idx on work_schedules(user_id, active);
