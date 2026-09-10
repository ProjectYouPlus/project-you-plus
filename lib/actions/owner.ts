"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const BOOLEAN_SETTINGS = new Set([
  "signup_enabled",
  "maintenance_mode",
  "onboarding_required",
  "analytics_enabled",
  "location_analytics_enabled",
]);

async function requireAdminAction() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Unauthorized");

  const { data: admin } = await supabase
    .from("admin_users")
    .select("role")
    .eq("user_id", user.id)
    .eq("active", true)
    .maybeSingle();

  if (!admin) throw new Error("Unauthorized");
  return { supabase, user, role: admin.role as string };
}

export async function updateModuleControl(formData: FormData) {
  const moduleKey = String(formData.get("moduleKey") ?? "").trim();
  const intent = String(formData.get("intent") ?? "rollout");
  const rollout = Math.max(0, Math.min(100, Number(formData.get("rollout") ?? 100)));

  if (!moduleKey || !Number.isFinite(rollout)) return;

  const { supabase, user } = await requireAdminAction();
  const { data: module } = await supabase
    .from("app_modules")
    .select("locked,enabled,rollout_percent")
    .eq("module_key", moduleKey)
    .maybeSingle();

  if (!module || module.locked) return;

  const enabled = intent === "toggle" ? !module.enabled : module.enabled;
  const nextRollout = intent === "rollout" ? Math.round(rollout) : module.rollout_percent;

  await supabase
    .from("app_modules")
    .update({
      enabled,
      rollout_percent: nextRollout,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("module_key", moduleKey);

  revalidatePath("/owner");
}

export async function updateBooleanSetting(formData: FormData) {
  const settingKey = String(formData.get("settingKey") ?? "").trim();
  const value = String(formData.get("value")) === "true";
  if (!BOOLEAN_SETTINGS.has(settingKey)) return;

  const { supabase, user } = await requireAdminAction();
  await supabase
    .from("app_settings")
    .update({
      value,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("setting_key", settingKey);

  revalidatePath("/owner");
}
