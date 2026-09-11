create table if not exists public.challenge_invites (
  id uuid primary key default uuid_generate_v4(),
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  inviter_id uuid not null references auth.users(id) on delete cascade,
  invitee_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(challenge_id, invitee_id),
  check (inviter_id <> invitee_id)
);
alter table public.challenge_invites enable row level security;
drop policy if exists challenge_invites_read on public.challenge_invites;
create policy challenge_invites_read on public.challenge_invites for select using (auth.uid() in (inviter_id, invitee_id));
drop policy if exists challenge_invites_insert on public.challenge_invites;
create policy challenge_invites_insert on public.challenge_invites for insert with check (auth.uid() = inviter_id and public.is_challenge_member(challenge_id));
drop policy if exists challenge_invites_update on public.challenge_invites;
create policy challenge_invites_update on public.challenge_invites for update using (auth.uid() = invitee_id) with check (auth.uid() = invitee_id);
drop policy if exists challenge_invites_delete on public.challenge_invites;
create policy challenge_invites_delete on public.challenge_invites for delete using (auth.uid() in (inviter_id, invitee_id));
create or replace function public.has_challenge_invite(p_challenge_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$ select exists(select 1 from public.challenge_invites ci where ci.challenge_id = p_challenge_id and ci.invitee_id = auth.uid() and ci.status = 'pending'); $$;
revoke all on function public.has_challenge_invite(uuid) from public;
grant execute on function public.has_challenge_invite(uuid) to authenticated;
drop policy if exists challenges_read on public.challenges;
create policy challenges_read on public.challenges for select using (creator_id = auth.uid() or public.is_challenge_member(id) or public.has_challenge_invite(id));
