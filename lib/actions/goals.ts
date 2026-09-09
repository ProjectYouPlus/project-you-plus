"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/demo-mode";

export async function createGoal(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const category = String(formData.get("category") ?? "custom");
  const target = String(formData.get("target") ?? "") || null;
  const deadline = String(formData.get("deadline") ?? "") || null;

  if (!title) return { error: "Give the goal a title." };

  if (isDemoMode) {
    // No persistence layer in demo mode — the form still validates and
    // submits so the interaction is real, it just can't write anywhere yet.
    redirect("/goals");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { error } = await supabase.from("goals").insert({
    user_id: user.id,
    title,
    category,
    target,
    deadline,
    progress: 0,
    status: "active",
  });

  if (error) return { error: error.message };

  revalidatePath("/goals");
  redirect("/goals");
}

export async function updateGoalProgress(goalId: string, progress: number) {
  if (isDemoMode) return;

  const supabase = await createClient();
  await supabase.from("goals").update({ progress }).eq("id", goalId);
  revalidatePath("/goals");
  revalidatePath(`/goals/${goalId}`);
}

export async function deleteGoal(goalId: string) {
  if (isDemoMode) {
    redirect("/goals");
  }

  const supabase = await createClient();
  await supabase.from("goals").delete().eq("id", goalId);
  revalidatePath("/goals");
  redirect("/goals");
}
