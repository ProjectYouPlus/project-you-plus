-- Run the daily Atlas planner hourly at minute five. The planner itself is
-- idempotent and only creates one plan per America/New_York date after 6 AM.

do $$
declare r record;
begin
  for r in select jobid from cron.job where jobname = 'project-you-marketing-planner' loop
    perform cron.unschedule(r.jobid);
  end loop;
end $$;

select cron.schedule(
  'project-you-marketing-planner',
  '5 * * * *',
  $cron$
    select net.http_post(
      url := 'https://project-you-plus.vercel.app/api/marketing-ops/runtime/tick?mode=plan',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select token from private.marketing_runtime_auth where id = 'default')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 50000
    );
  $cron$
);
