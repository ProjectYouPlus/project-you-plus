"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/demo-mode";
import { generateBlueprint, type OnboardingAnswers } from "@/lib/blueprint";

export async function completeOnboarding(answers: OnboardingAnswers) {
  if (!Array.isArray(answers.focusAreas) || !answers.focusAreas.length) {
    return { error: "Choose at least one priority to build your plan." };
  }

  let resolvedName = answers.name?.trim() || "";
  let userId: string | null = null;
  let supabase: Awaited<ReturnType<typeof createClient>> | null = null;

  if (!isDemoMode) {
    supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Your session expired. Sign in again to save your plan." };
    userId = user.id;
    resolvedName = resolvedName || String(user.user_metadata?.full_name ?? "").trim() || user.email?.split("@")[0] || "You";
  } else {
    resolvedName = resolvedName || "You";
  }

  const normalizedAnswers = { ...answers, name: resolvedName };
  const blueprint = generateBlueprint(normalizedAnswers);

  if (!isDemoMode && supabase && userId) {
    const { data: existing, error: readError } = await supabase.from("goals").select("title").eq("user_id", userId);
    if (readError) return { error: "Could not load your goals. Please try again." };

    const titles = [...new Set(normalizedAnswers.topGoals.map((title) => title.trim()).filter(Boolean))];
    const newTitles = titles.filter((title) => !existing?.some((goal) => goal.title === title));
    if (newTitles.length) {
      const { error } = await supabase.from("goals").insert(newTitles.map((title) => ({ user_id: userId, title, status: "active", progress: 0 })));
      if (error) return { error: "Could not save your goals. Please try again." };
    }

    const { error } = await supabase.from("profiles").upsert({ id: userId, full_name: resolvedName, onboarding_completed: true, blueprint });
    if (error) return { error: "Could not save your profile. Please try again." };
  }

  const cookieStore = await cookies();
  cookieStore.set("py_blueprint", JSON.stringify(blueprint), {
    maxAge: 600,
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  redirect("/onboarding/blueprint");
}
