-- Private aggregate: invoked by the server only after owner/admin authorization.
-- Aggregation occurs in Postgres, so totals are not limited by API row pagination.
create function public.website_owner_overview(p_days integer default 30)
returns jsonb language sql stable security invoker set search_path = '' as $$
with bounds as (
  select greatest(1,least(coalesce(p_days,30),90)) as days,
    (date_trunc('day',now() at time zone 'UTC') - (greatest(1,least(coalesce(p_days,30),90))-1)*interval '1 day') at time zone 'UTC' as since
), events as materialized (
  select e.* from public.website_events e, bounds b
  where e.created_at >= b.since and e.created_at <= now()
    and coalesce(e.utm_campaign,'') <> 'website_qa'
), waitlist as materialized (
  select w.* from public.beta_waitlist w where w.email not like '%@example.invalid'
    and coalesce(w.utm_campaign,'') <> 'website_qa'
), signups as materialized (
  select w.* from waitlist w, bounds b where w.created_at >= b.since and w.created_at <= now()
), visits as materialized (
  select distinct on (session_id) session_id,source,utm_medium,utm_campaign,created_at
  from events where event='homepage_visit' order by session_id,created_at,id
), converted as materialized (
  select v.* from visits v where exists (select 1 from events e where e.session_id=v.session_id and e.event='waitlist_submitted')
), days as (
  select generate_series(0,(select days-1 from bounds)) as offset_day
), daily as (
  select to_char((b.since at time zone 'UTC') + d.offset_day*interval '1 day','YYYY-MM-DD') as date,
    (select count(*) from visits v where (v.created_at at time zone 'UTC')::date=((b.since at time zone 'UTC')::date+d.offset_day)) as visits,
    (select count(*) from signups s where (s.created_at at time zone 'UTC')::date=((b.since at time zone 'UTC')::date+d.offset_day)) as signups
  from days d cross join bounds b
), source_keys as (
  select source from visits union select source from signups
), sources as (
  select k.source,
    (select count(*) from visits v where v.source=k.source) as visits,
    (select count(*) from signups s where s.source=k.source) as signups,
    (select count(*) from converted c where c.source=k.source) as converted
  from source_keys k
), campaign_keys as (
  select source,coalesce(utm_medium,'') as medium,coalesce(utm_campaign,'') as campaign from visits
  union select source,coalesce(utm_medium,''),coalesce(utm_campaign,'') from signups
), campaigns as (
  select k.*,
    (select count(*) from visits v where v.source=k.source and coalesce(v.utm_medium,'')=k.medium and coalesce(v.utm_campaign,'')=k.campaign) as visits,
    (select count(*) from signups s where s.source=k.source and coalesce(s.utm_medium,'')=k.medium and coalesce(s.utm_campaign,'')=k.campaign) as signups
  from campaign_keys k
)
select jsonb_build_object(
  'days',(select days from bounds),'since',(select since from bounds),'updated_at',now(),
  'visits',(select count(*) from visits),'signups',(select count(*) from signups),
  'converted_visits',(select count(*) from converted),
  'cta_visits',(select count(distinct session_id) from events where event in ('hero_beta_cta_click','nav_beta_cta_click','bottom_beta_cta_click')),
  'form_starts',(select count(distinct session_id) from events where event='waitlist_form_started'),
  'total_waitlist',(select count(*) from waitlist),
  'waiting',(select count(*) from waitlist where signup_status='waiting'),
  'daily',coalesce((select jsonb_agg(to_jsonb(d) order by date) from daily d),'[]'::jsonb),
  'sources',coalesce((select jsonb_agg(to_jsonb(s) order by visits desc,signups desc,source) from sources s),'[]'::jsonb),
  'campaigns',coalesce((select jsonb_agg(to_jsonb(c)) from (select * from campaigns order by signups desc,visits desc,source,campaign limit 10) c),'[]'::jsonb),
  'recent',coalesce((select jsonb_agg(to_jsonb(r)) from (select id,name,email,improvement_goal,source,utm_campaign,signup_status,created_at from signups order by created_at desc,id desc limit 10) r),'[]'::jsonb)
);
$$;
revoke all on function public.website_owner_overview(integer) from public,anon,authenticated;
grant execute on function public.website_owner_overview(integer) to service_role;
