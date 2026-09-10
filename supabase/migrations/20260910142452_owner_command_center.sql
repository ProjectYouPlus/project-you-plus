create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'admin' check (role in ('owner','admin','analyst','support')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.admin_users enable row level security;
revoke all on public.admin_users from anon;
grant select, insert, update, delete on public.admin_users to authenticated;

create or replace function private.is_app_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.admin_users a
    where a.user_id = (select auth.uid()) and a.active = true
  );
$$;

create or replace function private.is_app_owner()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.admin_users a
    where a.user_id = (select auth.uid()) and a.active = true and a.role = 'owner'
  );
$$;

grant execute on function private.is_app_admin() to authenticated;
grant execute on function private.is_app_owner() to authenticated;

create policy "admins can view admin users" on public.admin_users for select to authenticated using ((select private.is_app_admin()));
create policy "owners can insert admin users" on public.admin_users for insert to authenticated with check ((select private.is_app_owner()));
create policy "owners can update admin users" on public.admin_users for update to authenticated using ((select private.is_app_owner())) with check ((select private.is_app_owner()));
create policy "owners can delete admin users" on public.admin_users for delete to authenticated using ((select private.is_app_owner()));

create table if not exists public.user_directory (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  provider text,
  created_at timestamptz not null,
  last_sign_in_at timestamptz,
  email_confirmed_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.user_directory enable row level security;
revoke all on public.user_directory from anon;
grant select on public.user_directory to authenticated;
create policy "admins can view user directory" on public.user_directory for select to authenticated using ((select private.is_app_admin()));

create table if not exists public.user_admin_metadata (
  user_id uuid primary key references auth.users(id) on delete cascade,
  access_tier text not null default 'beta',
  cohort text,
  tags text[] not null default '{}',
  notes text,
  last_seen_at timestamptz,
  last_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.user_admin_metadata enable row level security;
revoke all on public.user_admin_metadata from anon;
grant select, insert, update, delete on public.user_admin_metadata to authenticated;
create policy "admins can view user metadata" on public.user_admin_metadata for select to authenticated using ((select private.is_app_admin()));
create policy "admins can insert user metadata" on public.user_admin_metadata for insert to authenticated with check ((select private.is_app_admin()));
create policy "admins can update user metadata" on public.user_admin_metadata for update to authenticated using ((select private.is_app_admin())) with check ((select private.is_app_admin()));
create policy "owners can delete user metadata" on public.user_admin_metadata for delete to authenticated using ((select private.is_app_owner()));

create table if not exists public.login_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null default 'sign_in' check (event_type in ('sign_in','sign_up','email_confirm','session_start')),
  auth_method text,
  occurred_at timestamptz not null default now(),
  city text,
  region text,
  country text,
  timezone text,
  latitude numeric,
  longitude numeric,
  ip_address text,
  user_agent text,
  device_family text,
  browser text,
  os text,
  path text
);
alter table public.login_events enable row level security;
revoke all on public.login_events from anon;
grant select, insert on public.login_events to authenticated;
create policy "users can insert own login events" on public.login_events for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "admins can view login events" on public.login_events for select to authenticated using ((select private.is_app_admin()));
create index if not exists login_events_user_time_idx on public.login_events(user_id, occurred_at desc);
create index if not exists login_events_time_idx on public.login_events(occurred_at desc);
create index if not exists login_events_geo_idx on public.login_events(country, region, city);

create table if not exists public.activity_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_name text not null,
  path text,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);
alter table public.activity_events enable row level security;
revoke all on public.activity_events from anon;
grant select, insert on public.activity_events to authenticated;
create policy "users can insert own activity" on public.activity_events for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "admins can view activity" on public.activity_events for select to authenticated using ((select private.is_app_admin()));
create index if not exists activity_events_user_time_idx on public.activity_events(user_id, occurred_at desc);
create index if not exists activity_events_event_time_idx on public.activity_events(event_name, occurred_at desc);
create index if not exists activity_events_path_time_idx on public.activity_events(path, occurred_at desc);

create table if not exists public.app_modules (
  module_key text primary key,
  label text not null,
  description text,
  enabled boolean not null default true,
  rollout_percent integer not null default 100 check (rollout_percent between 0 and 100),
  locked boolean not null default false,
  config jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);
alter table public.app_modules enable row level security;
revoke all on public.app_modules from anon;
grant select, insert, update, delete on public.app_modules to authenticated;
create policy "authenticated can view app modules" on public.app_modules for select to authenticated using (true);
create policy "admins can insert app modules" on public.app_modules for insert to authenticated with check ((select private.is_app_admin()));
create policy "admins can update app modules" on public.app_modules for update to authenticated using ((select private.is_app_admin())) with check ((select private.is_app_admin()));
create policy "owners can delete app modules" on public.app_modules for delete to authenticated using ((select private.is_app_owner()));

create table if not exists public.app_settings (
  setting_key text primary key,
  label text not null,
  description text,
  category text not null default 'general',
  value jsonb not null,
  public_readable boolean not null default false,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;
grant select on public.app_settings to anon, authenticated;
grant insert, update, delete on public.app_settings to authenticated;
create policy "public can read public settings" on public.app_settings for select to anon using (public_readable = true);
create policy "authenticated can read public settings" on public.app_settings for select to authenticated using (public_readable = true or (select private.is_app_admin()));
create policy "admins can insert settings" on public.app_settings for insert to authenticated with check ((select private.is_app_admin()));
create policy "admins can update settings" on public.app_settings for update to authenticated using ((select private.is_app_admin())) with check ((select private.is_app_admin()));
create policy "owners can delete settings" on public.app_settings for delete to authenticated using ((select private.is_app_owner()));

create table if not exists public.admin_audit_log (
  id bigint generated always as identity primary key,
  admin_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id text,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);
alter table public.admin_audit_log enable row level security;
revoke all on public.admin_audit_log from anon;
grant select on public.admin_audit_log to authenticated;
create policy "admins can view audit log" on public.admin_audit_log for select to authenticated using ((select private.is_app_admin()));
create index if not exists admin_audit_log_time_idx on public.admin_audit_log(created_at desc);

create or replace function private.sync_user_directory()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.user_directory(user_id,email,full_name,provider,created_at,last_sign_in_at,email_confirmed_at,updated_at)
  values(new.id,new.email,coalesce(new.raw_user_meta_data->>'full_name',new.raw_user_meta_data->>'name'),coalesce(new.raw_app_meta_data->>'provider','email'),new.created_at,new.last_sign_in_at,new.email_confirmed_at,now())
  on conflict (user_id) do update set email=excluded.email, full_name=coalesce(excluded.full_name,public.user_directory.full_name), provider=excluded.provider, last_sign_in_at=excluded.last_sign_in_at, email_confirmed_at=excluded.email_confirmed_at, updated_at=now();
  insert into public.user_admin_metadata(user_id) values(new.id) on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_sync_directory on auth.users;
create trigger on_auth_user_sync_directory after insert or update of email,last_sign_in_at,email_confirmed_at,raw_user_meta_data,raw_app_meta_data on auth.users for each row execute function private.sync_user_directory();

insert into public.user_directory(user_id,email,full_name,provider,created_at,last_sign_in_at,email_confirmed_at,updated_at)
select u.id,u.email,coalesce(u.raw_user_meta_data->>'full_name',u.raw_user_meta_data->>'name'),coalesce(u.raw_app_meta_data->>'provider','email'),u.created_at,u.last_sign_in_at,u.email_confirmed_at,now() from auth.users u
on conflict (user_id) do update set email=excluded.email,full_name=coalesce(excluded.full_name,public.user_directory.full_name),provider=excluded.provider,last_sign_in_at=excluded.last_sign_in_at,email_confirmed_at=excluded.email_confirmed_at,updated_at=now();
insert into public.user_admin_metadata(user_id) select id from auth.users on conflict (user_id) do nothing;

create or replace function private.touch_user_last_seen()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.user_admin_metadata(user_id,last_seen_at,last_path,updated_at)
  values(new.user_id,new.occurred_at,new.path,now())
  on conflict (user_id) do update set last_seen_at=greatest(coalesce(public.user_admin_metadata.last_seen_at,'-infinity'::timestamptz),excluded.last_seen_at),last_path=coalesce(excluded.last_path,public.user_admin_metadata.last_path),updated_at=now();
  return new;
end;
$$;

drop trigger if exists login_events_touch_last_seen on public.login_events;
create trigger login_events_touch_last_seen after insert on public.login_events for each row execute function private.touch_user_last_seen();
drop trigger if exists activity_events_touch_last_seen on public.activity_events;
create trigger activity_events_touch_last_seen after insert on public.activity_events for each row execute function private.touch_user_last_seen();

create or replace function private.audit_owner_change()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare actor uuid := auth.uid(); new_data jsonb; old_data jsonb; target text;
begin
  if actor is null then return coalesce(new,old); end if;
  new_data := case when tg_op <> 'DELETE' then to_jsonb(new) else null end;
  old_data := case when tg_op <> 'INSERT' then to_jsonb(old) else null end;
  target := coalesce(new_data->>'module_key',new_data->>'setting_key',new_data->>'user_id',old_data->>'module_key',old_data->>'setting_key',old_data->>'user_id');
  insert into public.admin_audit_log(admin_user_id,action,target_type,target_id,before_data,after_data) values(actor,lower(tg_op),tg_table_name,target,old_data,new_data);
  return coalesce(new,old);
end;
$$;

drop trigger if exists audit_app_modules on public.app_modules;
create trigger audit_app_modules after insert or update or delete on public.app_modules for each row execute function private.audit_owner_change();
drop trigger if exists audit_app_settings on public.app_settings;
create trigger audit_app_settings after insert or update or delete on public.app_settings for each row execute function private.audit_owner_change();
drop trigger if exists audit_user_admin_metadata on public.user_admin_metadata;
create trigger audit_user_admin_metadata after insert or update or delete on public.user_admin_metadata for each row execute function private.audit_owner_change();

insert into public.app_modules(module_key,label,description,enabled,rollout_percent,locked) values
('dashboard','Today / Command Center','Daily execution dashboard and trajectory score.',true,100,true),
('coach','Coach','AI coaching, insights and decision support.',true,100,false),
('health','Health','Health overview, metrics and connected health data.',true,100,false),
('money','Finance','Budgeting, accounts, cash flow and money tools.',true,100,false),
('fitness','Fitness','Workout plans, sessions and training logs.',true,100,false),
('supplements','Supplements','Supplement routines and adherence.',true,100,false),
('accountability','Accountability','Friends, challenges and accountability tools.',true,100,false),
('reminders','Alerts','Reminders, notifications and execution alerts.',true,100,false),
('integrations','Integrations','External connections and sync features.',true,100,false),
('social','Social','Social profile, friend discovery and challenges.',true,100,false)
on conflict (module_key) do nothing;

insert into public.app_settings(setting_key,label,description,category,value,public_readable) values
('signup_enabled','New signups','Allow new users to create Project You+ accounts.','access','true'::jsonb,true),
('maintenance_mode','Maintenance mode','Temporarily block the signed-in product experience while you make changes.','access','false'::jsonb,true),
('onboarding_required','Require onboarding','Require new users to complete onboarding before entering the app.','experience','true'::jsonb,true),
('analytics_enabled','Product analytics','Track signed-in product usage such as page views and session starts.','analytics','true'::jsonb,true),
('location_analytics_enabled','Approximate location analytics','Capture approximate sign-in location from network headers for security and aggregate geography.','analytics','true'::jsonb,true),
('ip_retention_days','IP retention target','Operational target for how long exact sign-in IP data should be retained.','privacy','90'::jsonb,false)
on conflict (setting_key) do nothing;
