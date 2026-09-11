"use server";
import { createClient } from "@/lib/supabase/server";
import { refreshHealthViews } from "@/lib/health/refresh";
import type { WorkoutStatus } from "@/lib/health/schedule";
export async function updateTrainingDays(planId: string, days: number[]) {
  const client = await createClient();
  const { error } = await client.rpc("set_training_days", {
    p_plan: planId,
    p_days: days,
  });
  if (error) return { error: error.message };
  refreshHealthViews();
  return { error: null };
}
export async function updateWorkoutStatus(
  planId: string,
  key: string,
  status: WorkoutStatus,
) {
  const client = await createClient();
  const { error } = await client.rpc("set_health_workout_state", {
    p_plan: planId,
    p_session: key,
    p_status: status,
  });
  if (error) return { error: error.message };
  refreshHealthViews();
  return { error: null };
}
export async function saveNutritionTargets(form: FormData) {
  const values = Object.fromEntries(
    ["calories", "protein", "carbs", "fat"].map((key) => [
      key,
      Number(form.get(key)),
    ]),
  );
  if (
    Object.values(values).some((x) => !Number.isFinite(x) || x < 0 || x > 20000)
  )
    return { error: "Enter valid nonnegative targets." };
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return { error: "Sign in again." };
  const { error } = await client
    .from("profiles")
    .update({ nutrition_targets: values })
    .eq("id", user.id);
  if (error) return { error: error.message };
  refreshHealthViews();
  return { error: null };
}
