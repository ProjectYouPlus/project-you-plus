-- Split the marketing runtime into independent heartbeats so OpenAI, Higgsfield,
-- and Instagram publishing cannot block one another. pg_net defaults to a 5s
-- timeout, so explicitly allow enough time for each production step.

do $$
declare r record;
begin
  for r in select jobid from cron.job where jobname in (
    'project-you-marketing-runtime',
    'project-you-marketing-agents',
    'project-you-marketing-provider',
    'project-you-marketing-publisher'
  ) loop
    perform cron.unschedule(r.jobid);
  end loop;
end $$;

select cron.schedule(
  'project-you-marketing-agents',
  '* * * * *',
  $cron$
    select net.http_post(
      url := 'https://project-you-plus.vercel.app/api/marketing-ops/runtime/tick?mode=agents',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select token from private.marketing_runtime_auth where id = 'default')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 50000
    );
  $cron$
);

select cron.schedule(
  'project-you-marketing-provider',
  '* * * * *',
  $cron$
    select net.http_post(
      url := 'https://project-you-plus.vercel.app/api/marketing-ops/runtime/tick?mode=provider',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select token from private.marketing_runtime_auth where id = 'default')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 50000
    );
  $cron$
);

select cron.schedule(
  'project-you-marketing-publisher',
  '* * * * *',
  $cron$
    select net.http_post(
      url := 'https://project-you-plus.vercel.app/api/marketing-ops/runtime/tick?mode=publish',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select token from private.marketing_runtime_auth where id = 'default')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 50000
    );
  $cron$
);
