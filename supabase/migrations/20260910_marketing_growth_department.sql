create table if not exists public.marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  objective text,
  channel text not null default 'instagram',
  status text not null default 'active' check (status in ('draft','active','paused','complete','archived')),
  starts_on date not null default current_date,
  ends_on date,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketing_learnings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  content_item_id uuid references public.marketing_content_items(id) on delete set null,
  learning_type text not null check (learning_type in ('hook','format','topic','length','cta','visual','audience','timing','other')),
  pattern text not null,
  evidence text,
  confidence numeric(5,2) not null default 50,
  impact_score numeric(5,2) not null default 50,
  status text not null default 'active' check (status in ('active','testing','validated','retired')),
  created_at timestamptz not null default now()
);

alter table public.marketing_content_items add column if not exists campaign_id uuid references public.marketing_campaigns(id) on delete set null;
alter table public.marketing_content_items add column if not exists approval_status text not null default 'pending' check (approval_status in ('pending','approved','changes_requested','rejected'));
alter table public.marketing_content_items add column if not exists owner_notes text;
alter table public.marketing_content_items add column if not exists score numeric(5,2);

alter table public.marketing_campaigns enable row level security;
alter table public.marketing_learnings enable row level security;

drop policy if exists "owner manages marketing_campaigns" on public.marketing_campaigns;
create policy "owner manages marketing_campaigns" on public.marketing_campaigns for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "owner manages marketing_learnings" on public.marketing_learnings;
create policy "owner manages marketing_learnings" on public.marketing_learnings for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create index if not exists marketing_campaigns_owner_status_idx on public.marketing_campaigns(owner_id, status, updated_at desc);
create index if not exists marketing_learnings_owner_status_idx on public.marketing_learnings(owner_id, status, impact_score desc);
