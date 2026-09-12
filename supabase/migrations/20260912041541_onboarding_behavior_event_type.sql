alter table public.behavior_events drop constraint if exists behavior_events_event_type_check;
alter table public.behavior_events add constraint behavior_events_event_type_check check (event_type = any (array[
  'task.completed'::text,'task.missed'::text,'habit.completed'::text,'habit.missed'::text,
  'workout.completed'::text,'workout.missed'::text,'meal.logged'::text,'supplement.completed'::text,
  'calendar.changed'::text,'spending.threshold'::text,'goal.progress_changed'::text,'score.changed'::text,
  'achievement.unlocked'::text,'milestone.unlocked'::text,'first_week.completed'::text,'pattern.discovered'::text,
  'workout.plan_activated'::text,'workout.schedule_changed'::text,'finance.goal_created'::text,'finance.goal_completed'::text,
  'finance.account_synced'::text,'finance.transaction_synced'::text,'finance.budget_changed'::text,'finance.bill_changed'::text,
  'progression.personal_best'::text,'progression.one_percent_earned'::text,'onboarding.completed'::text
]));
