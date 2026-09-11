"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/data/profile";
import {
  userDate,
  validFrequency,
  supplementDays,
} from "@/lib/health/schedule";
import { refreshHealthViews } from "@/lib/health/refresh";
import { refreshProgressionAfterMutation } from "@/lib/progression/service";

export async function addSupplement(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const dosage = String(formData.get("dosage") ?? "").trim() || null;
  const timing = String(formData.get("timing") ?? "morning");
  const frequency = normalizeFrequency(
    String(formData.get("frequency") ?? "daily"),
    String(formData.get("weeklyDay") ?? "1"),
  );
  const notes = String(formData.get("notes") ?? "").trim() || null;
  if (!name) return { error: "Add the supplement name." };
  if (!validFrequency(frequency))
    return { error: "Choose a valid supplement schedule." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in again." };

  const { error } = await supabase
    .from("supplements")
    .insert({
      user_id: user.id,
      name,
      dosage,
      timing,
      frequency,
      notes,
      active: true,
    });
  if (error) return { error: error.message };
  revalidatePath("/supplements");
  revalidatePath("/health");
  revalidatePath("/dashboard");
  return { error: null };
}

export async function logSupplementToday(supplementId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in again.");
  const profile = await getProfile();
  const loggedOn = userDate(new Date(), profile.timezone);
  const { error } = await supabase
    .from("supplement_logs")
    .upsert(
      { user_id: user.id, supplement_id: supplementId, logged_on: loggedOn },
      { onConflict: "user_id,supplement_id,logged_on", ignoreDuplicates: true },
    );
  if (error) throw new Error(error.message);
  await refreshProgressionAfterMutation();
  refreshHealthViews();
  revalidatePath("/supplements");
  revalidatePath("/health");
  revalidatePath("/dashboard");
}

export async function updateSupplementSchedule(id: string, frequency: string) {
  if (!validFrequency(frequency)) return { error: "Choose a valid schedule." };
  const client = await createClient();
  const { error } = await client
    .from("supplements")
    .update({ frequency })
    .eq("id", id);
  if (error) return { error: error.message };
  const { data: plan } = await client
    .from("workout_plans")
    .select("schedule")
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const days = supplementDays(
    frequency,
    (plan?.schedule ?? []).map((x: { dayIndex: number }) => x.dayIndex),
  );
  const { error: reminderError } = await client
    .from("reminders")
    .update({
      days_of_week: days,
      ...(frequency === "as_needed" ? { enabled: false } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("target_type", "supplement")
    .eq("target_id", id);
  refreshHealthViews();
  return {
    error: reminderError
      ? "Schedule saved; reminder update failed. Please reopen Set Reminder."
      : null,
  };
}
export async function saveSupplementReminder(
  id: string,
  time: string,
  enabled: boolean,
) {
  if (enabled && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))
    return { error: "Choose a valid time." };
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return { error: "Sign in again." };
  const { data: supp } = await client
    .from("supplements")
    .select("name,frequency")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (!supp) return { error: "Supplement not found." };
  if (enabled && supp.frequency === "as_needed")
    return {
      error: "Choose scheduled days before enabling a recurring reminder.",
    };
  const { data: plan } = await client
    .from("workout_plans")
    .select("schedule")
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const days = supplementDays(
    supp.frequency,
    (plan?.schedule ?? []).map((x: { dayIndex: number }) => x.dayIndex),
  );
  const { data: existing } = await client
    .from("reminders")
    .select("id")
    .eq("target_type", "supplement")
    .eq("target_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const payload = {
    user_id: user.id,
    target_type: "supplement",
    target_id: id,
    title: supp.name,
    time_of_day: time || null,
    days_of_week: days,
    recurrence: "custom",
    channel: "in_app",
    enabled,
    updated_at: new Date().toISOString(),
  };
  const { error } = existing
    ? await client.from("reminders").update(payload).eq("id", existing.id)
    : await client.from("reminders").insert(payload);
  refreshHealthViews();
  revalidatePath("/reminders");
  return { error: error?.message ?? null };
}

export async function setSupplementActive(
  supplementId: string,
  active: boolean,
) {
  const supabase = await createClient();
  await supabase.from("supplements").update({ active }).eq("id", supplementId);
  revalidatePath("/supplements");
  revalidatePath("/health");
  revalidatePath("/dashboard");
}

function normalizeFrequency(frequency: string, weeklyDay: string) {
  if (frequency !== "weekly") return frequency;
  const day = Math.max(0, Math.min(6, Number(weeklyDay) || 1));
  return `weekly_${["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][day]}`;
}
