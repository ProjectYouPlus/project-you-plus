-- Always-on marketing heartbeat without relying on Vercel Cron plan limits.
-- The bearer token is generated inside Postgres and never committed to source.

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema extensions;

create table if not exists private.marketing_runtime_auth (
  id text primary key,
  token text not null,
  created_at timestamptz not null default now(),
  rotated_at timestamptz not null default now()
);

insert into private.marketing_runtime_auth(id, token)
values ('default', encode(gen_random_bytes(32), 'hex'))
on conflict (id) do nothing;

create or replace function public.get_marketing_runtime_token_hash()
returns text
language sql
security definer
set search_path = private, public, pg_temp
as $$
  select encode(digest(token, 'sha256'), 'hex')
  from private.marketing_runtime_auth
  where id = 'default';
$$;

revoke all on function public.get_marketing_runtime_token_hash() from public, anon, authenticated;
grant execute on function public.get_marketing_runtime_token_hash() to service_role;

do $$
declare existing_job bigint;
begin
  select jobid into existing_job from cron.job where jobname = 'project-you-marketing-runtime' limit 1;
  if existing_job is not null then perform cron.unschedule(existing_job); end if;
end $$;

select cron.schedule(
  'project-you-marketing-runtime',
  '* * * * *',
  $cron$
    select net.http_post(
      url := 'https://project-you-plus.vercel.app/api/marketing-ops/runtime/tick',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select token from private.marketing_runtime_auth where id = 'default')
      ),
      body := '{}'::jsonb
    );
  $cron$
);
