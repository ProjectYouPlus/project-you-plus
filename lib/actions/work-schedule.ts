"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function addWorkSchedule(formData: FormData) {
  const label = String(formData.get("label") ?? "Work").trim().slice(0, 60) || "Work";
  const startTime = String(formData.get("startTime") ?? "").trim();
  const endTime = String(formData.get("endTime") ?? "").trim();
  const days = formData.getAll("days").map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);
  if (!startTime || !endTime) return { error: "Choose a start and end time." };
  if (!days.length) return { error: "Choose at least one work day." };
  if (startTime >= endTime) return { error: "End time must be after start time." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in again." };
  const { error } = await supabase.from("work_schedules").insert({ user_id: user.id, label, days_of_week: days, start_time: startTime, end_time: endTime, active: true });
  if (error) return { error: error.message };
  revalidatePath("/work-schedule"); revalidatePath("/you"); revalidatePath("/calendar"); revalidatePath("/dashboard"); revalidatePath("/coach");
  return { error: null };
}

export async function setWorkScheduleActive(id: string, active: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.from("work_schedules").update({ active, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/work-schedule"); revalidatePath("/you"); revalidatePath("/calendar"); revalidatePath("/dashboard"); revalidatePath("/coach");
  return { error: null };
}

export async function deleteWorkSchedule(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("work_schedules").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/work-schedule"); revalidatePath("/you"); revalidatePath("/calendar"); revalidatePath("/dashboard"); revalidatePath("/coach");
  return { error: null };
}
