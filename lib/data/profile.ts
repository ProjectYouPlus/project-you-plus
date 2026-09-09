import { isDemoMode } from "@/lib/demo-mode";
import { mockProfile } from "@/lib/mock-data";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";
import { redirect } from "next/navigation";

export async function getProfile(): Promise<Profile> {
  if (isDemoMode) return mockProfile;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data, error } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (error && error.code !== "PGRST116") throw new Error("Could not load your profile. Please try again.");
  if (!data) return { id: user.id, fullName: null, timezone: "UTC", onboardingCompleted: false, blueprint: null };

  return {
    id: data.id,
    fullName: data.full_name,
    timezone: data.timezone,
    onboardingCompleted: data.onboarding_completed,
    blueprint: data.blueprint,
  };
}
