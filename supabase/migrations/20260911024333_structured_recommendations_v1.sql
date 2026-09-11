-- Reuse and complete the recommendation table from the approved intelligence schema.
create table if not exists public.ai_recommendations (
  id uuid primary key default uuid_generate_v4(), user_id uuid not null references auth.users(id) on delete cascade,
  domain text not null check (domain in ('planner','health','finance','progress','general')), observation text not null,
  evidence jsonb not null default '[]'::jsonb, reason text not null, suggested_action text not null, expected_impact text,
  confidence text not null default 'medium' check (confidence in ('low','medium','high')),
  status text not null default 'pending' check (status in ('pending','accepted','dismissed','completed','expired')),
  action_type text, action_payload jsonb not null default '{}'::jsonb, requires_confirmation boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), expires_at timestamptz
);
alter table public.ai_recommendations add column if not exists related_entities jsonb not null default '[]'::jsonb;
alter table public.ai_recommendations add column if not exists dedupe_key text;
alter table public.ai_recommendations add column if not exists accepted_at timestamptz;
alter table public.ai_recommendations add column if not exists dismissed_at timestamptz;
alter table public.ai_recommendations add column if not exists completed_at timestamptz;
create unique index if not exists ai_recommendations_user_dedupe_idx on public.ai_recommendations(user_id,dedupe_key);
create index if not exists ai_recommendations_user_status_created_idx on public.ai_recommendations(user_id,status,created_at desc);
alter table public.ai_recommendations enable row level security;
drop policy if exists ai_recommendations_isolation on public.ai_recommendations;
drop policy if exists ai_recommendations_read_own on public.ai_recommendations;
create policy ai_recommendations_read_own on public.ai_recommendations for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists ai_recommendations_insert_own on public.ai_recommendations;
create policy ai_recommendations_insert_own on public.ai_recommendations for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists ai_recommendations_update_own on public.ai_recommendations;
create policy ai_recommendations_update_own on public.ai_recommendations for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
revoke all on public.ai_recommendations from anon;
revoke delete, truncate, references, trigger on public.ai_recommendations from authenticated;
grant select, insert, update on public.ai_recommendations to authenticated;
create or replace function public.set_ai_recommendation_state_timestamps() returns trigger language plpgsql set search_path = public as $$
begin new.updated_at=now(); if old.status is distinct from new.status then if new.status='accepted' then new.accepted_at=coalesce(new.accepted_at,now()); end if; if new.status='dismissed' then new.dismissed_at=coalesce(new.dismissed_at,now()); end if; if new.status='completed' then new.completed_at=coalesce(new.completed_at,now()); end if; end if; return new; end; $$;
revoke all on function public.set_ai_recommendation_state_timestamps() from public, anon, authenticated;
drop trigger if exists set_ai_recommendation_state_timestamps on public.ai_recommendations;
create trigger set_ai_recommendation_state_timestamps before update on public.ai_recommendations for each row execute function public.set_ai_recommendation_state_timestamps();
