import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "./profile";
import { calculateHealthScore } from "@/lib/health/score";
import {
  dateStart,
  scheduleForDate,
  shiftDate,
  supplementDue,
  userDate,
  weekday,
  type TrainingPlan,
  type WorkoutStatus,
} from "@/lib/health/schedule";
import type { NutritionFood } from "@/lib/actions/nutrition";

export type MacroTotals = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};
export type Meal = {
  id: string;
  meal_name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  foods: NutritionFood[];
  source: string;
  logged_at: string;
};
export type HealthSupplement = {
  id: string;
  name: string;
  dosage: string | null;
  timing: string;
  frequency: string;
  notes: string | null;
  created_at: string;
  done: boolean;
  due: boolean;
};
export const getHealthOverview = cache(async () => {
  const [supabase, profile] = await Promise.all([createClient(), getProfile()]);
  const now = new Date(),
    timezone = profile.timezone || "UTC",
    today = userDate(now, timezone),
    from = shiftDate(today, -6),
    end = dateStart(shiftDate(today, 1), timezone);
  const [
    plan,
    logs,
    meals,
    supplements,
    suppLogs,
    metrics,
    targets,
    reminders,
  ] = await Promise.all([
    supabase
      .from("workout_plans")
      .select(
        "id,title,goal,days_per_week,session_minutes,schedule,schedule_history,created_at",
      )
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("workout_plan_logs")
      .select("id,plan_id,session_key,completed_on,status")
      .gte("completed_on", from)
      .lte("completed_on", today),
    supabase
      .from("nutrition_logs")
      .select("*")
      .gte("logged_at", dateStart(from, timezone).toISOString())
      .lt("logged_at", end.toISOString())
      .order("logged_at", { ascending: false }),
    supabase
      .from("supplements")
      .select("*")
      .eq("active", true)
      .order("created_at"),
    supabase
      .from("supplement_logs")
      .select("supplement_id,logged_on")
      .gte("logged_on", from)
      .lte("logged_on", today),
    supabase
      .from("health_metrics")
      .select("id,metric_type,value,recorded_at,source")
      .gte(
        "recorded_at",
        dateStart(shiftDate(today, -30), timezone).toISOString(),
      )
      .lt("recorded_at", end.toISOString())
      .order("recorded_at", { ascending: false })
      .limit(200),
    supabase
      .from("profiles")
      .select("nutrition_targets")
      .eq("id", profile.id)
      .maybeSingle(),
    supabase
      .from("reminders")
      .select("id,target_id,time_of_day,enabled,days_of_week")
      .eq("target_type", "supplement")
      .order("created_at", { ascending: false }),
  ]);
  const activePlan = plan.data as TrainingPlan | null,
    allMeals = (meals.data ?? []) as Meal[],
    todayMeals = allMeals.filter(
      (x) => userDate(new Date(x.logged_at), timezone) === today,
    );
  const todayWorkout =
    scheduleForDate(activePlan, today, timezone).find(
      (x) => x.dayIndex === weekday(today),
    ) ?? null;
  const status = (logs.data ?? []).find(
    (x) =>
      x.plan_id === activePlan?.id &&
      x.session_key === todayWorkout?.key &&
      x.completed_on === today,
  )?.status as WorkoutStatus | undefined;
  const todaySupplements: HealthSupplement[] = (supplements.data ?? []).map(
    (x) => ({
      ...x,
      done: (suppLogs.data ?? []).some(
        (log) => log.supplement_id === x.id && log.logged_on === today,
      ),
      due: supplementDue(x.frequency, weekday(today), Boolean(todayWorkout)),
    }),
  );
  const score = calculateHealthScore({
    now,
    trackingSince: profile.createdAt,
    timezone,
    plan: activePlan,
    planLogs: logs.data ?? [],
    nutritionLogs: allMeals,
    supplements: supplements.data ?? [],
    supplementLogs: suppLogs.data ?? [],
    available: {
      training: !plan.error && !logs.error,
      diet: !meals.error,
      supplements: !supplements.error && !suppLogs.error && !plan.error,
    },
  });
  const totals = todayMeals.reduce(
    (s, x) => ({
      calories: s.calories + Number(x.calories),
      protein: s.protein + Number(x.protein_g),
      carbs: s.carbs + Number(x.carbs_g),
      fat: s.fat + Number(x.fat_g),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
  return {
    today,
    timezone,
    score,
    training: {
      activePlan,
      todayWorkout,
      status: todayWorkout
        ? (status ?? "not_started")
        : ("not_scheduled" as const),
    },
    nutrition: {
      totals,
      targets: (targets.data?.nutrition_targets ?? null) as MacroTotals | null,
      meals: todayMeals,
      recentMeals: allMeals,
    },
    supplements: todaySupplements,
    metrics: metrics.data ?? [],
    reminders: reminders.data ?? [],
    errors: {
      training: !!plan.error || !!logs.error,
      nutrition: !!meals.error,
      supplements: !!supplements.error || !!suppLogs.error,
      recovery: !!metrics.error,
      targets: !!targets.error,
      reminders: !!reminders.error,
    },
  };
});
export type HealthOverview = Awaited<ReturnType<typeof getHealthOverview>>;
