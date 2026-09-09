alter table public.habits add column if not exists goal_id uuid references public.goals(id) on delete set null;
create index if not exists habits_user_goal_idx on public.habits(user_id, goal_id);
