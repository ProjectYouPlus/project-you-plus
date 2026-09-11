"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { refreshProgressionAfterMutation } from "@/lib/progression/service";

const GOAL_TYPES = new Set(["emergency_fund", "savings", "debt_payoff", "purchase", "investment", "custom"]);

export async function saveMonthlyBudget(formData: FormData) {
  const category = clean(formData.get("category")) || "Overall";
  const monthlyLimit = Number(formData.get("monthlyLimit"));
  const periodStart = clean(formData.get("periodStart"));
  if (category.length > 80 || !validDate(periodStart) || !validMoney(monthlyLimit, false)) return { error: "Enter a valid category, month, and budget amount." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in again to save a budget." };
  const month = `${periodStart.slice(0, 7)}-01`;
  const { data: existing, error: readError } = await supabase.from("budgets").select("id,category").eq("user_id", user.id).eq("period_start", month);
  if (readError) return { error: readError.message };
  const match = existing?.find((row) => row.category.toLowerCase() === category.toLowerCase());
  const query = match
    ? supabase.from("budgets").update({ category, monthly_limit: monthlyLimit }).eq("id", match.id).eq("user_id", user.id)
    : supabase.from("budgets").insert({ user_id: user.id, category, monthly_limit: monthlyLimit, period_start: month });
  const { error } = await query;
  if (error) return { error: error.message };
  await refreshProgressionAfterMutation();
  refreshFinanceViews();
  return { error: null };
}

export async function saveFinancialGoal(formData: FormData) {
  const id = clean(formData.get("id"));
  const title = clean(formData.get("title"));
  const type = clean(formData.get("type")) || "custom";
  const currentAmount = Number(formData.get("currentAmount"));
  const targetAmount = Number(formData.get("targetAmount"));
  const monthlyContributionRaw = clean(formData.get("monthlyContribution"));
  const monthlyContribution = monthlyContributionRaw ? Number(monthlyContributionRaw) : null;
  const deadline = clean(formData.get("deadline")) || null;
  const linkedAccountId = clean(formData.get("linkedAccountId")) || null;
  if (!title || title.length > 120 || !GOAL_TYPES.has(type) || !validMoney(currentAmount, true) || !validMoney(targetAmount, false) || (monthlyContribution !== null && !validMoney(monthlyContribution, true)) || (deadline && !validDate(deadline))) return { error: "Enter a valid goal, amounts, and target date." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in again to save a goal." };
  if (linkedAccountId) {
    const { data: account } = await supabase.from("finance_accounts").select("id").eq("id", linkedAccountId).eq("user_id", user.id).maybeSingle();
    if (!account) return { error: "Choose one of your own accounts for this goal." };
  }
  const progress = Math.min(100, Math.round(currentAmount / targetAmount * 100));
  const completed = progress >= 100;
  const payload = {
    title,
    category: "finance",
    target: `${targetAmount}`,
    deadline,
    progress,
    status: completed ? "completed" : "active",
    financial_goal_type: type,
    current_amount: currentAmount,
    target_amount: targetAmount,
    target_monthly_contribution: monthlyContribution,
    linked_account_id: linkedAccountId,
    completed_at: completed ? new Date().toISOString() : null,
  };
  const query = id
    ? supabase.from("goals").update(payload).eq("id", id).eq("user_id", user.id).eq("category", "finance")
    : supabase.from("goals").insert({ ...payload, user_id: user.id });
  const { error } = await query;
  if (error) return { error: error.message };
  refreshFinanceViews();
  revalidatePath("/goals");
  if (id) revalidatePath(`/goals/${id}`);
  return { error: null };
}

function refreshFinanceViews() {
  for (const path of ["/money", "/dashboard", "/coach", "/you", "/progress"]) revalidatePath(path);
}

function clean(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function validMoney(value: number, allowZero: boolean) {
  return Number.isFinite(value) && (allowZero ? value >= 0 : value > 0) && value <= 1000000000;
}

function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T12:00:00Z`).getTime());
}
