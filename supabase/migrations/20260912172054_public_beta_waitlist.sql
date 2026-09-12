-- Public website writes go through validated, rate-limited server endpoints.
create table public.beta_waitlist (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100),
  email text not null unique check (email = lower(btrim(email)) and char_length(email) between 3 and 254),
  improvement_goal text check (char_length(improvement_goal) <= 1000),
  willingness_to_pay text check (willingness_to_pay in ('yes','maybe','no')),
  source text not null check (source in ('instagram','tiktok','direct','referral','other')),
  referral_source text, utm_source text, utm_medium text, utm_campaign text,
  landing_page text not null default '/',
  signup_status text not null default 'waiting' check (signup_status in ('waiting','invited','active','withdrawn')),
  created_at timestamptz not null default now()
);
create table public.website_events (
  id uuid primary key default gen_random_uuid(), session_id uuid not null,
  event text not null check (event in ('homepage_visit','hero_beta_cta_click','bottom_beta_cta_click','nav_beta_cta_click','waitlist_form_started','waitlist_submitted','willingness_to_pay_response')),
  source text not null check (source in ('instagram','tiktok','direct','referral','other')),
  referral_source text, utm_source text, utm_medium text, utm_campaign text,
  landing_page text not null default '/',
  willingness_to_pay text check (willingness_to_pay in ('yes','maybe','no')),
  created_at timestamptz not null default now()
);
create index website_events_funnel_idx on public.website_events (created_at,event,source);
create index website_events_session_idx on public.website_events (session_id);
create index beta_waitlist_campaign_idx on public.beta_waitlist (created_at,source);
create table public.website_request_limits (
  key text primary key, bucket timestamptz not null, count integer not null
);
alter table public.beta_waitlist enable row level security;
alter table public.website_events enable row level security;
alter table public.website_request_limits enable row level security;
revoke all on public.beta_waitlist, public.website_events, public.website_request_limits from public, anon, authenticated;
grant select,insert,update,delete on public.beta_waitlist, public.website_events, public.website_request_limits to service_role;

create function public.website_request_allowed(p_key text, p_limit integer)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare v_count integer; v_bucket timestamptz := date_trunc('minute',now());
begin
  delete from public.website_request_limits where bucket < now() - interval '2 hours';
  insert into public.website_request_limits as limits (key,bucket,count) values(p_key,v_bucket,1)
  on conflict(key) do update set bucket=v_bucket,count=case when limits.bucket=v_bucket then limits.count+1 else 1 end
  returning count into v_count;
  return v_count <= least(greatest(p_limit,1),120);
end;
$$;
revoke all on function public.website_request_allowed(text,integer) from public,anon,authenticated;
grant execute on function public.website_request_allowed(text,integer) to service_role;

create function public.register_beta_waitlist(p_signup jsonb, p_session_id uuid)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare v_id uuid;
begin
  insert into public.beta_waitlist(name,email,improvement_goal,willingness_to_pay,source,referral_source,utm_source,utm_medium,utm_campaign,landing_page)
  values(p_signup->>'name',lower(btrim(p_signup->>'email')),p_signup->>'improvement_goal',p_signup->>'willingness_to_pay',p_signup->>'source',p_signup->>'referral_source',p_signup->>'utm_source',p_signup->>'utm_medium',p_signup->>'utm_campaign','/')
  on conflict(email) do nothing returning id into v_id;
  if v_id is null then return false; end if;
  insert into public.website_events(session_id,event,source,referral_source,utm_source,utm_medium,utm_campaign,landing_page)
  values(p_session_id,'waitlist_submitted',p_signup->>'source',p_signup->>'referral_source',p_signup->>'utm_source',p_signup->>'utm_medium',p_signup->>'utm_campaign','/');
  if p_signup->>'willingness_to_pay' is not null then
    insert into public.website_events(session_id,event,source,referral_source,utm_source,utm_medium,utm_campaign,landing_page,willingness_to_pay)
    values(p_session_id,'willingness_to_pay_response',p_signup->>'source',p_signup->>'referral_source',p_signup->>'utm_source',p_signup->>'utm_medium',p_signup->>'utm_campaign','/',p_signup->>'willingness_to_pay');
  end if;
  return true;
end;
$$;
revoke all on function public.register_beta_waitlist(jsonb,uuid) from public,anon,authenticated;
grant execute on function public.register_beta_waitlist(jsonb,uuid) to service_role;
