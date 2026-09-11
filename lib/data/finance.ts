import { cache } from "react";
import { calculateFinanceOverview } from "@/lib/finance/overview";
import type {
  FinanceAccount,
  FinanceBill,
  FinanceBudget,
  FinanceGoal,
  FinanceOverview,
  FinanceTransaction,
} from "@/lib/finance/types";
import { shiftDate, userDate } from "@/lib/health/schedule";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "./profile";

type QueryResult = { error: { message: string } | null };

export const getFinanceOverview = cache(async (): Promise<FinanceOverview> => {
  const [supabase, profile] = await Promise.all([createClient(), getProfile()]);
  const now = new Date();
  const timezone = profile.timezone || "UTC";
  const today = userDate(now, timezone);
  const monthStart = `${today.slice(0, 7)}-01`;
  const transactionStart = shiftDate(monthStart, -62);
  const billStart = shiftDate(today, -31);

  const [accounts, transactions, budgets, bills, holdings, goals, goalHistory, integrations, snapshots] = await Promise.all([
    supabase.from("finance_accounts").select("id,name,account_type,balance,institution,connected_via,mask,last_synced_at").order("created_at"),
    supabase.from("transactions").select("id,account_id,amount,category,original_category,merchant,occurred_at,pending,transaction_type,provider_transaction_id,pending_transaction_id").gte("occurred_at", `${transactionStart}T00:00:00.000Z`).order("occurred_at", { ascending: false }).limit(500),
    supabase.from("budgets").select("id,category,monthly_limit,period_start").eq("period_start", monthStart),
    supabase.from("bills").select("id,name,amount,due_date,paid").gte("due_date", billStart).order("due_date").limit(100),
    supabase.from("investment_holdings").select("id,ticker,name,value,as_of").order("value", { ascending: false }).limit(100),
    supabase.from("goals").select("id,title,financial_goal_type,current_amount,target_amount,target_monthly_contribution,deadline,linked_account_id,status,created_at").eq("category", "finance").in("status", ["active", "completed"]).order("created_at", { ascending: false }),
    supabase.from("behavior_events").select("source_id,occurred_at,payload").eq("source_table", "goals").in("event_type", ["finance.goal_created", "goal.progress_changed", "finance.goal_completed"]).gte("occurred_at", `${shiftDate(today, -365)}T00:00:00.000Z`).order("occurred_at"),
    supabase.from("integrations").select("status,metadata").eq("provider", "plaid").maybeSingle(),
    supabase.from("score_snapshots").select("breakdown,captured_on").order("captured_on", { ascending: false }).limit(14),
  ]);

  const errors: string[] = [];
  collectError(errors, "accounts", accounts);
  collectError(errors, "transactions", transactions);
  collectError(errors, "budgets", budgets);
  collectError(errors, "bills", bills);
  collectError(errors, "investments", holdings);
  collectError(errors, "goals", goals);
  collectError(errors, "goal history", goalHistory);
  collectError(errors, "Plaid status", integrations);
  collectError(errors, "score history", snapshots);

  const accountRows = (accounts.data ?? []) as FinanceAccount[];
  const goalRows = ((goals.data ?? []) as FinanceGoal[]).map((goal) => {
    const linked = goal.linked_account_id ? accountRows.find((account) => account.id === goal.linked_account_id) : null;
    return linked ? { ...goal, current_amount: linked.balance } : goal;
  });
  const metadata = isRecord(integrations.data?.metadata) ? integrations.data.metadata : {};
  const connectionStatus = connectionState(integrations.data?.status, metadata);

  return calculateFinanceOverview({
    now,
    timezone,
    accounts: accountRows,
    transactions: (transactions.data ?? []) as FinanceTransaction[],
    budgets: (budgets.data ?? []) as FinanceBudget[],
    bills: (bills.data ?? []) as FinanceBill[],
    holdings: (holdings.data ?? []) as Array<{ id: string; ticker: string | null; name: string; value: number | string | null; as_of: string }>,
    goals: goalRows,
    goalHistory: (goalHistory.data ?? []) as Array<{ source_id: string | null; occurred_at: string; payload: Record<string, unknown> | null }>,
    priorFinanceScore: previousFinanceScore(snapshots.data ?? [], today),
    connection: {
      status: connectionStatus,
      environment: stringOrNull(metadata.environment),
      lastSyncedAt: stringOrNull(metadata.last_synced_at),
    },
    errors,
  });
});

function collectError(errors: string[], label: string, result: QueryResult) {
  if (result.error) errors.push(`${label}: ${result.error.message}`);
}

function previousFinanceScore(rows: Array<{ breakdown: unknown; captured_on: string }>, today: string) {
  for (const row of rows) {
    if (row.captured_on === today) continue;
    if (!isRecord(row.breakdown)) continue;
    const nested = isRecord(row.breakdown.finance) ? row.breakdown.finance : null;
    const value = row.breakdown.financeScore ?? nested?.overall;
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}

function connectionState(status: string | null | undefined, metadata: Record<string, unknown>): FinanceOverview["connection"]["status"] {
  if (status === "syncing") return "syncing";
  if (status === "error" || status === "needs_attention" || metadata.last_error) return "needs_attention";
  if (status === "connected") return "connected";
  return "disconnected";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function stringOrNull(value: unknown) {
  return typeof value === "string" && value ? value : null;
}
