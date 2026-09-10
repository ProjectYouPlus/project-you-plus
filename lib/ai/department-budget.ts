type Department = "development" | "growth";

type SupabaseLike = {
  from: (table: string) => any;
};

const DEFAULT_MONTHLY_BUDGET_CENTS = 5000;

export async function getDepartmentBudget(supabase: SupabaseLike, ownerId: string) {
  const month = new Date().toISOString().slice(0, 7) + "-01";
  const { data } = await supabase
    .from("ai_department_budget")
    .select("owner_id,monthly_budget_cents,development_enabled,growth_enabled,budget_month,estimated_spend_cents")
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (!data) {
    const initial = {
      owner_id: ownerId,
      monthly_budget_cents: DEFAULT_MONTHLY_BUDGET_CENTS,
      development_enabled: true,
      growth_enabled: true,
      budget_month: month,
      estimated_spend_cents: 0,
    };
    const { data: created, error } = await supabase
      .from("ai_department_budget")
      .insert(initial)
      .select()
      .single();
    if (error) throw error;
    return created;
  }

  if (data.budget_month !== month) {
    const { data: reset, error } = await supabase
      .from("ai_department_budget")
      .update({ budget_month: month, estimated_spend_cents: 0, updated_at: new Date().toISOString() })
      .eq("owner_id", ownerId)
      .select()
      .single();
    if (error) throw error;
    return reset;
  }

  return data;
}

export async function assertDepartmentCanSpend(
  supabase: SupabaseLike,
  ownerId: string,
  department: Department,
  reserveCents = 1
) {
  const budget = await getDepartmentBudget(supabase, ownerId);
  const enabled = department === "development" ? budget.development_enabled : budget.growth_enabled;
  if (!enabled) throw new Error(`${department === "development" ? "Development Team" : "Growth Department"} is turned off.`);
  if (budget.estimated_spend_cents + reserveCents > budget.monthly_budget_cents) {
    throw new Error("Monthly AI budget reached. Increase the budget or wait for the monthly reset.");
  }
  return budget;
}
