delete from public.weekly_reviews a
using public.weekly_reviews b
where a.user_id = b.user_id
  and a.week_start = b.week_start
  and (a.created_at, a.id) > (b.created_at, b.id);

create unique index if not exists weekly_reviews_user_week_key
  on public.weekly_reviews(user_id, week_start);
