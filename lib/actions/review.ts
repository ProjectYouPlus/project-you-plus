"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { refreshProgressionAfterMutation } from "@/lib/progression/service";
import { shiftDate, userDate, weekday } from "@/lib/health/schedule";

export async function completeWeeklyReview() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { data: profile } = await supabase.from("profiles").select("timezone").eq("id", user.id).maybeSingle();
  const today = userDate(new Date(), profile?.timezone ?? "UTC");
  const weekStart = shiftDate(today, -((weekday(today) + 6) % 7));

  const { data: existing } = await supabase
    .from("weekly_reviews")
    .select("id")
    .eq("user_id", user.id)
    .eq("week_start", weekStart)
    .maybeSingle();

  if (!existing) {
    const { error } = await supabase.from("weekly_reviews").insert({
      user_id: user.id,
      week_start: weekStart,
      summary: "Weekly Review completed from tracked Project You+ evidence.",
    });
    if (error) throw new Error(error.message);
  }

  await refreshProgressionAfterMutation();
  revalidatePath("/review");
  revalidatePath("/progress");
  revalidatePath("/you");
}
