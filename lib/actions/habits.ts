"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/demo-mode";

export async function createHabit(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const targetFrequency = String(formData.get("targetFrequency") ?? "daily");
  const goalIdRaw = String(formData.get("goalId") ?? "").trim();
  if (!title) return { error: "Give the habit a name." };
  if (isDemoMode) return { error: null };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };
  const { error } = await supabase.from("habits").insert({ user_id: user.id, title, target_frequency: targetFrequency, goal_id: goalIdRaw || null });
  if (error) return { error: error.message };
  revalidatePath("/habits");
  revalidatePath("/dashboard");
  revalidatePath("/you");
  return { error: null };
}

export async function logHabitToday(habitId: string) {
  if (isDemoMode) return;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const today = new Date().toISOString().slice(0, 10);
  const { error } = await supabase.from("habit_logs").upsert({ habit_id: habitId, user_id: user.id, logged_at: today }, { onConflict: "habit_id,logged_at" });
  if (error) throw new Error(error.message);
  revalidatePath("/habits");
  revalidatePath("/dashboard");
  revalidatePath("/review");
}
