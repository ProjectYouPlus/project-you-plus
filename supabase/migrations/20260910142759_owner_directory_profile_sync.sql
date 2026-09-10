alter table public.user_directory add column if not exists onboarding_completed boolean not null default false;

update public.user_directory d
set full_name = coalesce(p.full_name, d.full_name),
    onboarding_completed = coalesce(p.onboarding_completed, false),
    updated_at = now()
from public.profiles p
where p.id = d.user_id;

create or replace function private.sync_profile_to_directory()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.user_directory
  set full_name = coalesce(new.full_name, public.user_directory.full_name),
      onboarding_completed = coalesce(new.onboarding_completed, false),
      updated_at = now()
  where user_id = new.id;
  return new;
end;
$$;

drop trigger if exists profiles_sync_owner_directory on public.profiles;
create trigger profiles_sync_owner_directory
after insert or update of full_name, onboarding_completed on public.profiles
for each row execute function private.sync_profile_to_directory();
