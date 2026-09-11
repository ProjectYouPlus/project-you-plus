import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDepartmentBudget } from "@/lib/ai/department-budget";

function ownerEmails() {
  return (process.env.PROJECT_YOU_OWNER_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

async function ownerContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const email = user?.email?.toLowerCase();
  const authorized = Boolean(user && email && ownerEmails().includes(email));
  return { supabase, user, authorized };
}

export async function GET() {
  const { supabase, user, authorized } = await ownerContext();
  if (!authorized || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const budget = await getDepartmentBudget(supabase, user.id);
    return NextResponse.json({
      monthlyBudgetCents: budget.monthly_budget_cents,
      estimatedSpendCents: budget.estimated_spend_cents,
      remainingCents: Math.max(0, budget.monthly_budget_cents - budget.estimated_spend_cents),
      developmentEnabled: budget.development_enabled,
      growthEnabled: budget.growth_enabled,
      budgetMonth: budget.budget_month,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Budget unavailable" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const { supabase, user, authorized } = await ownerContext();
  if (!authorized || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json() as {
    monthlyBudgetCents?: number;
    developmentEnabled?: boolean;
    growthEnabled?: boolean;
  };
  const current = await getDepartmentBudget(supabase, user.id);
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.monthlyBudgetCents === "number") updates.monthly_budget_cents = Math.max(0, Math.round(body.monthlyBudgetCents));
  if (typeof body.developmentEnabled === "boolean") updates.development_enabled = body.developmentEnabled;
  if (typeof body.growthEnabled === "boolean") updates.growth_enabled = body.growthEnabled;
  const { error } = await supabase.from("ai_department_budget").update(updates).eq("owner_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const next = { ...current, ...updates } as any;
  return NextResponse.json({
    monthlyBudgetCents: next.monthly_budget_cents,
    estimatedSpendCents: next.estimated_spend_cents,
    remainingCents: Math.max(0, next.monthly_budget_cents - next.estimated_spend_cents),
    developmentEnabled: next.development_enabled,
    growthEnabled: next.growth_enabled,
    budgetMonth: next.budget_month,
  });
}
