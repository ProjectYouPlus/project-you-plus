"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/demo-mode";
import { getSiteUrl } from "@/lib/supabase/env";
import { getBooleanSetting, recordAuthEvent } from "@/lib/analytics/server";

export type AuthResult = { error: string | null; message?: string };

export async function signIn(formData: FormData): Promise<AuthResult> {
  if (isDemoMode) redirect("/dashboard");
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };
  await recordAuthEvent(supabase, "sign_in", { authMethod: "password", path: "/login" });
  redirect("/dashboard");
}

export async function signUp(formData: FormData): Promise<AuthResult> {
  if (isDemoMode) redirect("/onboarding");
  const fullName = String(formData.get("fullName") ?? "").trim();
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const supabase = await createClient();

  const signupsEnabled = await getBooleanSetting(supabase, "signup_enabled", true);
  if (!signupsEnabled) return { error: "New Project You+ registrations are temporarily closed." };

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName || undefined }, emailRedirectTo: `${getSiteUrl()}/auth/confirm` },
  });
  if (error) return { error: error.message };
  if (data.session) {
    await recordAuthEvent(supabase, "sign_up", { authMethod: "email", path: "/signup" });
    redirect("/onboarding");
  }
  return { error: null, message: "Account created. Check your email, confirm your address, then you’ll continue into onboarding." };
}

export async function requestPasswordReset(formData: FormData): Promise<AuthResult> {
  if (isDemoMode) return { error: null };
  const email = String(formData.get("email") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${getSiteUrl()}/auth/confirm?next=/reset-password` });
  if (error) return { error: error.message };
  return { error: null, message: "Password reset email sent." };
}

export async function signOut() {
  if (!isDemoMode) { const supabase = await createClient(); await supabase.auth.signOut(); }
  revalidatePath("/", "layout");
  redirect("/login");
}

export async function updatePassword(formData: FormData): Promise<AuthResult> {
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) return { error: "Use at least 8 characters." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Open a valid password reset link first." };
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };
  return { error: null, message: "Password updated. You can continue to your account." };
}
