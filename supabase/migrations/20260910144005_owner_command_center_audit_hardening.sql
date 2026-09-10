create index if not exists admin_audit_log_admin_user_id_idx on public.admin_audit_log(admin_user_id);
create index if not exists app_modules_updated_by_idx on public.app_modules(updated_by);
create index if not exists app_settings_updated_by_idx on public.app_settings(updated_by);

create or replace function private.audit_owner_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  new_data jsonb;
  old_data jsonb;
  target text;
begin
  if actor is null or not exists (
    select 1 from public.admin_users a
    where a.user_id = actor and a.active = true
  ) then
    return coalesce(new, old);
  end if;

  new_data := case when tg_op <> 'DELETE' then to_jsonb(new) else null end;
  old_data := case when tg_op <> 'INSERT' then to_jsonb(old) else null end;
  target := coalesce(new_data->>'module_key', new_data->>'setting_key', new_data->>'user_id', old_data->>'module_key', old_data->>'setting_key', old_data->>'user_id');

  insert into public.admin_audit_log(admin_user_id,action,target_type,target_id,before_data,after_data)
  values(actor,lower(tg_op),tg_table_name,target,old_data,new_data);
  return coalesce(new, old);
end;
$$;
