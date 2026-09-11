"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const ALLOWED = new Set(["sleep_minutes","steps","water_cups","weight_kg","resting_hr"]);
export async function addHealthMetric(formData: FormData) {
  const metricType = String(formData.get("metricType") ?? "");
  const value = Number(formData.get("value"));
  if (!ALLOWED.has(metricType)) return { error: "Choose a valid health metric." };
  if (!Number.isFinite(value) || value < 0) return { error: "Enter a valid value." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in again to save health data." };
  const { error } = await supabase.from("health_metrics").insert({ user_id: user.id, metric_type: metricType, value, source: "manual" });
  if (error) return { error: error.message };
  revalidatePath("/dashboard"); revalidatePath("/coach"); revalidatePath("/health"); revalidatePath("/today"); revalidatePath("/you");
  return { error: null };
}
