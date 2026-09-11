"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createCalendarEvent(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const startAt = String(formData.get("startAt") ?? "");
  const endAt = String(formData.get("endAt") ?? "");
  if (!title || !startAt || !endAt) return { error: "Add a title, start time, and end time." };
  if (new Date(endAt) <= new Date(startAt)) return { error: "End time must be after the start time." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in again to add this to your calendar." };
  const { error } = await supabase.from("calendar_events").insert({ user_id: user.id, title, start_at: startAt, end_at: endAt, source: "internal" });
  if (error) return { error: error.message };
  revalidatePath("/dashboard"); revalidatePath("/calendar"); revalidatePath("/today"); revalidatePath("/run-my-day");
  return { error: null };
}
