"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/owner/access";
import { getDepartmentBudget } from "@/lib/ai/department-budget";

export async function updateDepartmentBudget(formData: FormData) {
  const { supabase } = await requireAdmin();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Unauthorized");
  await getDepartmentBudget(supabase, auth.user.id);

  const department = String(formData.get("department"));
  const enabled = String(formData.get("enabled")) === "true";
  if (!['development', 'growth'].includes(department)) throw new Error("Unknown department");

  const field = department === "development" ? "development_enabled" : "growth_enabled";
  const { error } = await supabase
    .from("ai_department_budget")
    .update({ [field]: enabled, updated_at: new Date().toISOString() })
    .eq("owner_id", auth.user.id);
  if (error) throw error;

  revalidatePath("/owner/budget");
  revalidatePath("/owner/agents");
}

export async function updateMonthlyBudget(formData: FormData) {
  const { supabase } = await requireAdmin();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Unauthorized");
  await getDepartmentBudget(supabase, auth.user.id);
  const dollars = Number(formData.get("dollars"));
  if (!Number.isFinite(dollars) || dollars < 0 || dollars > 10000) throw new Error("Invalid monthly budget");
  const { error } = await supabase
    .from("ai_department_budget")
    .update({ monthly_budget_cents: Math.round(dollars * 100), updated_at: new Date().toISOString() })
    .eq("owner_id", auth.user.id);
  if (error) throw error;
  revalidatePath("/owner/budget");
}
