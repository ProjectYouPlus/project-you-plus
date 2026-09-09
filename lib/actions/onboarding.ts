"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/demo-mode";
import { generateBlueprint, type OnboardingAnswers } from "@/lib/blueprint";

export async function completeOnboarding(answers: OnboardingAnswers) {
  if (!answers.name?.trim() || !Array.isArray(answers.focusAreas) || !answers.focusAreas.length) {
    return { error: "Add your name and at least one focus area." };
  }
  const blueprint = generateBlueprint(answers);
  if (!isDemoMode) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Your session expired. Sign in again to save your plan." };
    const { data: existing, error: readError } = await supabase.from("goals").select("title").eq("user_id", user.id);
    if (readError) return { error: "Could not load your goals. Please try again." };
    const titles = [...new Set(answers.topGoals.map(t => t.trim()).filter(Boolean))];
    const newTitles = titles.filter(title => !existing?.some(goal => goal.title === title));
    if (newTitles.length) {
      const { error } = await supabase.from("goals").insert(newTitles.map(title => ({ user_id: user.id, title, status: "active", progress: 0 })));
      if (error) return { error: "Could not save your goals. Please try again." };
    }
    const { error } = await supabase.from("profiles").upsert({ id: user.id, full_name: answers.name.trim(), onboarding_completed: true, blueprint });
    if (error) return { error: "Could not save your profile. Please try again." };
  }
  const cookieStore = await cookies();
  cookieStore.set("py_blueprint", JSON.stringify(blueprint), {
    maxAge: 600, path: "/", httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production",
  });
  redirect("/onboarding/blueprint");
}
