drop index if exists public.notifications_user_key_idx;
create unique index notifications_user_key_idx on public.notifications(user_id,notification_key);
