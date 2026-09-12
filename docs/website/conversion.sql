-- Service role / Supabase SQL editor only. Count unique visit sessions, not page reloads.
select source, coalesce(utm_campaign,'(none)') as campaign,
  count(distinct session_id) filter(where event='homepage_visit') as visitors,
  count(*) filter(where event='hero_beta_cta_click') as hero_cta_clicks,
  count(*) filter(where event='bottom_beta_cta_click') as bottom_cta_clicks,
  count(distinct session_id) filter(where event='waitlist_form_started') as form_starts,
  count(*) filter(where event='waitlist_submitted') as signups,
  round(100.0 * count(distinct session_id) filter(where event='waitlist_submitted') /
    nullif(count(distinct session_id) filter(where event='homepage_visit'),0),2) as visitor_signup_pct
from public.website_events
where created_at >= now() - interval '30 days'
group by source,utm_campaign order by visitors desc;

select willingness_to_pay, count(*) as submissions
from public.beta_waitlist group by willingness_to_pay;
