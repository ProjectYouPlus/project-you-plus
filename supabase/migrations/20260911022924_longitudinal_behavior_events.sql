-- A compact, append-only behavioral journal for longitudinal AI context.
create table if not exists public.behavior_events (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (event_type in (
    'task.completed','task.missed','habit.completed','habit.missed',
    'workout.completed','workout.missed','meal.logged','supplement.completed',
    'calendar.changed','spending.threshold','goal.progress_changed',
    'score.changed','achievement.unlocked','milestone.unlocked','first_week.completed'
  )),
  occurred_at timestamptz not null default now(),
  source_table text,
  source_id text,
  dedupe_key text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, dedupe_key)
);

create index if not exists behavior_events_user_time_idx on public.behavior_events(user_id, occurred_at desc);
create index if not exists behavior_events_user_type_time_idx on public.behavior_events(user_id, event_type, occurred_at desc);
alter table public.behavior_events enable row level security;
drop policy if exists behavior_events_read_own on public.behavior_events;
create policy behavior_events_read_own on public.behavior_events for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists behavior_events_insert_own on public.behavior_events;
create policy behavior_events_insert_own on public.behavior_events for insert to authenticated with check ((select auth.uid()) = user_id);
revoke all on public.behavior_events from anon;
grant select, insert on public.behavior_events to authenticated;

create or replace function public.append_behavior_event(
  p_user_id uuid, p_event_type text, p_dedupe_key text,
  p_source_table text default null, p_source_id text default null,
  p_occurred_at timestamptz default now(), p_payload jsonb default '{}'::jsonb
) returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.behavior_events(user_id,event_type,dedupe_key,source_table,source_id,occurred_at,payload)
  values(p_user_id,p_event_type,p_dedupe_key,p_source_table,p_source_id,p_occurred_at,coalesce(p_payload,'{}'::jsonb))
  on conflict(user_id,dedupe_key) do nothing;
end; $$;
revoke all on function public.append_behavior_event(uuid,text,text,text,text,timestamptz,jsonb) from public;

create or replace function public.capture_behavior_event() returns trigger language plpgsql security definer set search_path = public as $$
declare v_threshold int; v_spend numeric; v_limit numeric; v_month date; v_category text;
begin
  if tg_table_name='tasks' and tg_op='UPDATE' and old.completed_at is null and new.completed_at is not null then
    perform append_behavior_event(new.user_id,'task.completed','task.completed:'||new.id,'tasks',new.id::text,new.completed_at,jsonb_build_object('goal_id',new.goal_id,'due_at',new.due_at,'tier',new.tier));
  elsif tg_table_name='habit_logs' and tg_op='INSERT' then
    perform append_behavior_event(new.user_id,'habit.completed','habit.completed:'||new.habit_id||':'||new.logged_at,'habit_logs',new.id::text,new.created_at,jsonb_build_object('habit_id',new.habit_id,'day',new.logged_at));
  elsif tg_table_name='workouts' and tg_op='INSERT' then
    perform append_behavior_event(new.user_id,'workout.completed','workout.completed:'||new.id,'workouts',new.id::text,new.performed_at,jsonb_build_object('type',new.type,'duration_minutes',new.duration_minutes,'source',new.source));
  elsif tg_table_name='nutrition_logs' and tg_op='INSERT' then
    perform append_behavior_event(new.user_id,'meal.logged','meal.logged:'||new.id,'nutrition_logs',new.id::text,new.logged_at,jsonb_build_object('calories',new.calories,'protein_g',new.protein_g));
  elsif tg_table_name='supplement_logs' and tg_op='INSERT' then
    perform append_behavior_event(new.user_id,'supplement.completed','supplement.completed:'||new.supplement_id||':'||new.logged_on,'supplement_logs',new.id::text,new.created_at,jsonb_build_object('supplement_id',new.supplement_id,'day',new.logged_on));
  elsif tg_table_name='calendar_events' then
    perform append_behavior_event(coalesce(new.user_id,old.user_id),'calendar.changed','calendar.changed:'||coalesce(new.id,old.id)||':'||tg_op||':'||extract(epoch from clock_timestamp()),'calendar_events',coalesce(new.id,old.id)::text,now(),jsonb_build_object('operation',lower(tg_op),'source',coalesce(new.source,old.source)));
  elsif tg_table_name='daily_scores' then
    if tg_op='INSERT' or old.score is distinct from new.score then
      perform append_behavior_event(new.user_id,'score.changed','score.changed:'||new.id||':'||new.score,'daily_scores',new.id::text,now(),jsonb_build_object('score',new.score,'previous_score',case when tg_op='UPDATE' then old.score end,'scored_on',new.scored_on));
    end if;
  elsif tg_table_name='goals' and tg_op='UPDATE' and old.progress is distinct from new.progress then
    perform append_behavior_event(new.user_id,'goal.progress_changed','goal.progress_changed:'||new.id||':'||new.progress,'goals',new.id::text,now(),jsonb_build_object('previous',old.progress,'current',new.progress));
    for v_threshold in select unnest(array[25,50,75,100]) loop
      if coalesce(old.progress,0)<v_threshold and coalesce(new.progress,0)>=v_threshold then
        perform append_behavior_event(new.user_id,'milestone.unlocked','milestone.unlocked:goal:'||new.id||':'||v_threshold,'goals',new.id::text,now(),jsonb_build_object('milestone',v_threshold));
      end if;
    end loop;
    if coalesce(old.progress,0)<100 and coalesce(new.progress,0)>=100 then
      perform append_behavior_event(new.user_id,'achievement.unlocked','achievement.unlocked:goal:'||new.id,'goals',new.id::text,now(),jsonb_build_object('kind','goal_completed'));
    end if;
  elsif tg_table_name='transactions' and tg_op='INSERT' and new.amount<0 then
    v_month:=date_trunc('month',new.occurred_at)::date; v_category:=coalesce(new.category,'all');
    select sum(abs(t.amount)), max(b.monthly_limit) into v_spend,v_limit from public.transactions t join public.budgets b on b.user_id=t.user_id and (b.category=t.category or b.category='all') where t.user_id=new.user_id and t.amount<0 and t.occurred_at>=v_month and t.occurred_at<v_month+interval '1 month' and (b.category=v_category or b.category='all');
    if v_limit>0 then
      foreach v_threshold in array array[80,100] loop
        if v_spend/v_limit*100>=v_threshold then perform append_behavior_event(new.user_id,'spending.threshold','spending.threshold:'||v_month||':'||v_category||':'||v_threshold,'transactions',new.id::text,new.occurred_at,jsonb_build_object('category',v_category,'threshold_pct',v_threshold,'spent',v_spend,'limit',v_limit)); end if;
      end loop;
    end if;
  end if;
  return coalesce(new,old);
end; $$;
revoke all on function public.capture_behavior_event() from public;

drop trigger if exists behavior_task on public.tasks; create trigger behavior_task after update of completed_at on public.tasks for each row execute function capture_behavior_event();
drop trigger if exists behavior_habit on public.habit_logs; create trigger behavior_habit after insert on public.habit_logs for each row execute function capture_behavior_event();
drop trigger if exists behavior_workout on public.workouts; create trigger behavior_workout after insert on public.workouts for each row execute function capture_behavior_event();
drop trigger if exists behavior_meal on public.nutrition_logs; create trigger behavior_meal after insert on public.nutrition_logs for each row execute function capture_behavior_event();
drop trigger if exists behavior_supplement on public.supplement_logs; create trigger behavior_supplement after insert on public.supplement_logs for each row execute function capture_behavior_event();
drop trigger if exists behavior_calendar on public.calendar_events; create trigger behavior_calendar after insert or update or delete on public.calendar_events for each row execute function capture_behavior_event();
drop trigger if exists behavior_goal on public.goals; create trigger behavior_goal after update of progress on public.goals for each row execute function capture_behavior_event();
drop trigger if exists behavior_score on public.daily_scores; create trigger behavior_score after insert or update of score on public.daily_scores for each row execute function capture_behavior_event();
drop trigger if exists behavior_spending on public.transactions; create trigger behavior_spending after insert on public.transactions for each row execute function capture_behavior_event();

create or replace function public.reconcile_behavior_events(p_through date default current_date - 1) returns integer
language plpgsql security definer set search_path = public as $$
declare v_user uuid:=auth.uid(); v_before bigint; v_after bigint;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  select count(*) into v_before from behavior_events where user_id=v_user;
  insert into behavior_events(user_id,event_type,occurred_at,source_table,source_id,dedupe_key,payload)
    select user_id,'task.missed',coalesce(due_at,p_through::timestamptz),'tasks',id::text,'task.missed:'||id,jsonb_build_object('due_at',due_at,'goal_id',goal_id,'tier',tier) from tasks where user_id=v_user and completed_at is null and due_at<(p_through+1)::timestamptz on conflict(user_id,dedupe_key) do nothing;
  insert into behavior_events(user_id,event_type,occurred_at,source_table,source_id,dedupe_key,payload)
    select h.user_id,'habit.missed',(p_through+time '23:59')::timestamptz,'habits',h.id::text,'habit.missed:'||h.id||':'||p_through,jsonb_build_object('day',p_through)
    from habits h where h.user_id=v_user and h.target_frequency='daily' and not exists(select 1 from habit_logs l where l.habit_id=h.id and l.logged_at=p_through) on conflict(user_id,dedupe_key) do nothing;
  insert into behavior_events(user_id,event_type,occurred_at,source_table,source_id,dedupe_key,payload)
    select p.user_id,'workout.missed',(p_through+time '23:59')::timestamptz,'workout_plans',p.id::text,'workout.missed:'||p.id||':'||(s->>'key')||':'||p_through,jsonb_build_object('day',p_through,'session_key',s->>'key')
    from workout_plans p cross join lateral jsonb_array_elements(p.schedule) s where p.user_id=v_user and p.active and (s->>'dayIndex')::int=extract(dow from p_through)::int and not exists(select 1 from workout_plan_logs l where l.plan_id=p.id and l.session_key=s->>'key' and l.completed_on=p_through) on conflict(user_id,dedupe_key) do nothing;
  insert into behavior_events(user_id,event_type,occurred_at,source_table,source_id,dedupe_key,payload)
    select id,'first_week.completed',created_at+interval '7 days','profiles',id::text,'first_week.completed',jsonb_build_object('joined_at',created_at) from profiles where id=v_user and created_at+interval '7 days'<=now() on conflict(user_id,dedupe_key) do nothing;
  insert into behavior_events(user_id,event_type,occurred_at,source_table,source_id,dedupe_key,payload)
    select cm.user_id,'achievement.unlocked',c.ends_on::timestamptz,'challenges',c.id::text,'achievement.unlocked:challenge:'||c.id,jsonb_build_object('kind','challenge_completed','points',cm.points)
    from challenge_members cm join challenges c on c.id=cm.challenge_id where cm.user_id=v_user and c.status='completed' on conflict(user_id,dedupe_key) do nothing;
  select count(*) into v_after from behavior_events where user_id=v_user; return (v_after-v_before)::integer;
end; $$;
revoke all on function public.reconcile_behavior_events(date) from public;
grant execute on function public.reconcile_behavior_events(date) to authenticated;
