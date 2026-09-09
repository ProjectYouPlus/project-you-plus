"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const TARGET_TYPES = new Set(["task", "habit", "workout", "supplement", "custom"]);
const RECURRENCES = new Set(["once", "daily", "weekdays", "weekly", "custom"]);

export async function addReminder(formData: FormData) {
  const combinedTarget = String(formData.get("target") ?? "").trim();
  const [combinedType, combinedId] = combinedTarget.includes(":") ? combinedTarget.split(":", 2) : ["", ""];
  const targetType = combinedType || String(formData.get("targetType") ?? "custom");
  const targetId = (combinedId || String(formData.get("targetId") ?? "")).trim() || null;
  const title = String(formData.get("title") ?? "").trim();
  const recurrence = String(formData.get("recurrence") ?? "once");
  const remindAtRaw = String(formData.get("remindAt") ?? "").trim();
  const timeOfDay = String(formData.get("timeOfDay") ?? "").trim() || null;

  if (!TARGET_TYPES.has(targetType)) return { error: "Choose a valid reminder type." };
  if (!RECURRENCES.has(recurrence)) return { error: "Choose a valid repeat setting." };
  if (!title) return { error: "Name the reminder." };
  if (recurrence === "once" && !remindAtRaw) return { error: "Choose when you want to be reminded." };
  if (recurrence !== "once" && !timeOfDay) return { error: "Choose a reminder time." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in again." };

  let remindAt: string | null = null;
  if (remindAtRaw) {
    const parsed = new Date(remindAtRaw);
    if (Number.isNaN(parsed.getTime())) return { error: "Choose a valid reminder date and time." };
    remindAt = parsed.toISOString();
  }

  const { error } = await supabase.from("reminders").insert({
    user_id: user.id,
    target_type: targetType,
    target_id: targetId,
    title,
    recurrence,
    remind_at: remindAt,
    time_of_day: timeOfDay,
    channel: "in_app",
    enabled: true,
  });
  if (error) return { error: error.message };

  revalidatePath("/reminders");
  revalidatePath("/dashboard");
  return { error: null };
}

export async function setReminderEnabled(id: string, enabled: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.from("reminders").update({ enabled, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/reminders");
  return { error: null };
}

export async function deleteReminder(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("reminders").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/reminders");
  return { error: null };
}
