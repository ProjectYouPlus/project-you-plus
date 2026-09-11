import { NextResponse } from "next/server";
import { getDepartmentBudget } from "@/lib/ai/department-budget";
import { requireMarketingOwner } from "@/lib/marketing/server";

async function budgetPayload(supabase: any, userId: string) {
  const budget = await getDepartmentBudget(supabase, userId);
  const monthStart = `${new Date().toISOString().slice(0, 7)}-01T00:00:00.000Z`;
  const { data: ledger } = await supabase
    .from("ai_department_spend_ledger")
    .select("department,estimated_cost_cents")
    .eq("owner_id", userId)
    .gte("created_at", monthStart);
  const developmentSpendCents = (ledger || []).filter((row: any) => row.department === "development").reduce((sum: number, row: any) => sum + Number(row.estimated_cost_cents || 0), 0);
  const growthSpendCents = (ledger || []).filter((row: any) => row.department === "growth").reduce((sum: number, row: any) => sum + Number(row.estimated_cost_cents || 0), 0);
  return {
    monthlyBudgetCents: budget.monthly_budget_cents,
    estimatedSpendCents: budget.estimated_spend_cents,
    remainingCents: Math.max(0, budget.monthly_budget_cents - budget.estimated_spend_cents),
    developmentSpendCents,
    growthSpendCents,
    developmentEnabled: budget.development_enabled,
    growthEnabled: budget.growth_enabled,
    growthMode: budget.growth_mode || "assisted",
    budgetMonth: budget.budget_month,
  };
}

export async function GET() {
  const { supabase, user, allowed } = await requireMarketingOwner();
  if (!allowed || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await budgetPayload(supabase, user.id));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Budget unavailable" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const { supabase, user, allowed } = await requireMarketingOwner();
  if (!allowed || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json() as {
    monthlyBudgetCents?: number;
    developmentEnabled?: boolean;
    growthEnabled?: boolean;
    growthMode?: "manual" | "assisted" | "autopilot";
  };
  await getDepartmentBudget(supabase, user.id);
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.monthlyBudgetCents === "number") updates.monthly_budget_cents = Math.max(0, Math.round(body.monthlyBudgetCents));
  if (typeof body.developmentEnabled === "boolean") updates.development_enabled = body.developmentEnabled;
  if (typeof body.growthEnabled === "boolean") updates.growth_enabled = body.growthEnabled;
  if (["manual", "assisted", "autopilot"].includes(body.growthMode || "")) updates.growth_mode = body.growthMode;
  const { error } = await supabase.from("ai_department_budget").update(updates).eq("owner_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(await budgetPayload(supabase, user.id));
}
