import { shiftDate, userDate } from "@/lib/health/schedule";
import type {
  FinanceAccount,
  FinanceBill,
  FinanceBudget,
  FinanceGoal,
  FinanceOverview,
  FinanceRecommendation,
  FinanceTransaction,
  FinanceTransactionType,
  GoalProjection,
} from "./types";

type GoalHistory = {
  source_id: string | null;
  occurred_at: string;
  payload: Record<string, unknown> | null;
};

export function calculateFinanceOverview(input: {
  now: Date;
  timezone: string;
  accounts: FinanceAccount[];
  transactions: FinanceTransaction[];
  budgets: FinanceBudget[];
  bills: FinanceBill[];
  holdings: Array<{ id: string; ticker: string | null; name: string; value: number | string | null; as_of: string }>;
  goals: FinanceGoal[];
  goalHistory: GoalHistory[];
  priorFinanceScore?: number | null;
  connection?: FinanceOverview["connection"];
  errors?: string[];
}): FinanceOverview {
  const today = userDate(input.now, input.timezone);
  const [year, month, day] = today.split("-").map(Number);
  const monthKey = today.slice(0, 7);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const monthElapsed = day / daysInMonth;
  const currentTransactions = dedupeTransactions(input.transactions).filter(
    (row) => userDate(new Date(row.occurred_at), input.timezone).startsWith(monthKey),
  );
  const hasTransactionCoverage = currentTransactions.length > 0 || Boolean(input.connection?.status === "connected" && input.connection.lastSyncedAt);
  const confirmed = currentTransactions.filter((row) => !row.pending);
  let spending = 0;
  let income = 0;
  let hasIncome = false;
  const categorySpend = new Map<string, number>();

  for (const row of confirmed) {
    const amount = Number(row.amount || 0);
    const type = normalizedTransactionType(row);
    if (type === "expense") {
      const value = Math.max(0, -amount);
      spending += value;
      const category = normalizeCategory(row.category);
      categorySpend.set(category, (categorySpend.get(category) ?? 0) + value);
    } else if (type === "refund") {
      const value = Math.max(0, amount);
      spending = Math.max(0, spending - value);
      const category = normalizeCategory(row.category);
      categorySpend.set(category, Math.max(0, (categorySpend.get(category) ?? 0) - value));
    } else if (type === "income") {
      hasIncome = true;
      income += Math.max(0, amount);
    }
  }

  const periodBudgets = input.budgets.filter((row) => row.period_start.slice(0, 7) === monthKey);
  const overallBudget = periodBudgets.find((row) => /^(all|overall|total)$/i.test(row.category));
  const categoryBudgets = periodBudgets.filter((row) => !/^(all|overall|total)$/i.test(row.category));
  const budgetTotal = overallBudget
    ? Number(overallBudget.monthly_limit)
    : categoryBudgets.length
      ? categoryBudgets.reduce((sum, row) => sum + Number(row.monthly_limit || 0), 0)
      : null;
  const budgetRemaining = budgetTotal === null || !hasTransactionCoverage ? null : budgetTotal - spending;
  const expectedSpend = budgetTotal === null ? null : budgetTotal * monthElapsed;
  const spendingPacePct = hasTransactionCoverage && expectedSpend && expectedSpend > 0 ? Math.round((spending / expectedSpend) * 100) : null;
  const budgetScore = expectedSpend === null || !hasTransactionCoverage
    ? null
    : expectedSpend <= 0 || spending <= expectedSpend
      ? 100
      : clamp(100 - ((spending / expectedSpend) - 1) * 100);

  const netCashFlow = hasIncome ? income - spending : null;
  const savingsRate = hasIncome && income > 0 ? (income - spending) / income : null;
  const cashFlowScore = savingsRate === null ? null : clamp(50 + savingsRate * 250);
  const savingsScore = savingsRate === null ? null : clamp((Math.max(0, savingsRate) / 0.2) * 100);

  const liquidAccounts = input.accounts.filter((row) => /^(checking|savings|cash)$/i.test(row.account_type ?? ""));
  const cashAvailable = liquidAccounts.length
    ? liquidAccounts.reduce((sum, row) => sum + Number(row.balance || 0), 0)
    : null;

  const billItems = input.bills
    .map((bill) => ({ ...bill, status: billStatus(bill, today) }))
    .sort((a, b) => a.due_date.localeCompare(b.due_date));
  const openBills = billItems.filter((bill) => !bill.paid);
  const overdueBills = openBills.filter((bill) => bill.status === "overdue");
  const billScore = input.bills.length === 0 ? null : overdueBills.length ? 0 : openBills.some((bill) => bill.status === "due soon") ? 80 : 100;
  const consistency = average([budgetScore, savingsScore, billScore]);
  const overall = weightedAverage([
    { value: budgetScore, weight: 30 },
    { value: cashFlowScore, weight: 30 },
    { value: savingsScore, weight: 20 },
    { value: consistency, weight: 20 },
  ]);
  const direction = overall === null || input.priorFinanceScore == null ? null : overall - input.priorFinanceScore;
  const directionLabel = direction === null ? "calibrating" : direction >= 2 ? "improving" : direction <= -2 ? "declining" : "stable";

  const factors = [
    factor("budget", budgetScore, budgetTotal === null ? "No monthly budget configured" : !hasTransactionCoverage ? "Confirmed transaction coverage is unavailable" : spending <= (expectedSpend ?? 0) ? "Spending is within the month-to-date budget pace" : `Spending is ${Math.max(0, Math.round((spending / Math.max(1, expectedSpend ?? 1) - 1) * 100))}% ahead of budget pace`),
    factor("cash_flow", cashFlowScore, !hasIncome ? "Income data is unavailable" : netCashFlow! >= 0 ? "Confirmed income is covering month-to-date spending" : "Month-to-date spending is above confirmed income"),
    factor("savings", savingsScore, savingsRate === null ? "Savings rate is unavailable without confirmed income" : `Savings rate is ${percent(savingsRate)}`),
    factor("consistency", consistency, billScore === 0 ? "At least one tracked bill is overdue" : "Based on budget pace, savings behavior, and tracked bill status"),
  ] as FinanceOverview["score"]["factors"];
  const weakest = [...factors].filter((row) => row.value !== null).sort((a, b) => (a.value ?? 0) - (b.value ?? 0))[0];
  const primaryReason = weakest?.label ?? "Add a budget or confirmed transactions to calculate financial direction.";

  const categories = [...new Set([...categorySpend.keys(), ...categoryBudgets.map((row) => normalizeCategory(row.category))])]
    .map((name) => {
      const spent = categorySpend.get(name) ?? 0;
      const budget = categoryBudgets.find((row) => normalizeCategory(row.category) === name);
      const limit = budget ? Number(budget.monthly_limit) : null;
      return { name, spent, budget: limit, pacePct: limit && monthElapsed > 0 ? Math.round((spent / (limit * monthElapsed)) * 100) : null };
    })
    .sort((a, b) => b.spent - a.spent);

  const goals = input.goals.map((goal) => goalProjection(goal, input.goalHistory, input.now));
  const holdingsTotal = input.holdings.length ? input.holdings.reduce((sum, row) => sum + Number(row.value || 0), 0) : null;
  const investmentAccounts = input.accounts.filter((row) => row.account_type === "investment");
  const investmentTotal = holdingsTotal ?? (investmentAccounts.length ? investmentAccounts.reduce((sum, row) => sum + Number(row.balance || 0), 0) : null);
  const upcomingTotal = openBills.length ? openBills.reduce((sum, bill) => sum + Number(bill.amount || 0), 0) : null;
  const recommendation = chooseRecommendation({ overdueBills, openBills, upcomingTotal, cashAvailable, spendingPacePct, budgetRemaining, goals, savingsRate, factors });
  const lastSyncedAt = latestDate([
    ...input.accounts.map((row) => row.last_synced_at),
    input.connection?.lastSyncedAt ?? null,
  ]);

  return {
    score: { overall, budget: budgetScore, cashFlow: cashFlowScore, savings: savingsScore, consistency, direction, directionLabel, primaryReason, calculatedAt: input.now.toISOString(), factors },
    metrics: { cashAvailable, monthlySpending: hasTransactionCoverage ? spending : null, budgetTotal, budgetRemaining, savingsRate, income: hasIncome ? income : null, netCashFlow, spendingPacePct },
    categories,
    accounts: input.accounts,
    recentTransactions: [...currentTransactions].sort((a, b) => b.occurred_at.localeCompare(a.occurred_at)).slice(0, 12),
    bills: { upcomingCount: openBills.length, totalUpcoming: upcomingTotal, next: openBills[0] ?? null, items: billItems.slice(0, 8) },
    investments: { totalValue: investmentTotal, holdings: input.holdings.slice(0, 8).map((row) => ({ id: row.id, ticker: row.ticker, name: row.name, value: Number(row.value || 0), asOf: row.as_of })) },
    goals,
    recommendation,
    connection: input.connection ?? { status: "disconnected", environment: null, lastSyncedAt: null },
    dataFreshness: { lastSyncedAt },
    errors: input.errors ?? [],
  };
}

export function normalizedTransactionType(row: FinanceTransaction): FinanceTransactionType {
  if (row.transaction_type && row.transaction_type !== "unknown") return row.transaction_type;
  const label = `${row.category ?? ""} ${row.original_category ?? ""} ${row.merchant ?? ""}`.toLowerCase().replaceAll("_", " ");
  if (/credit card payment|card payment|payment thank you/.test(label)) return "credit_card_payment";
  if (/transfer|ach|wire|cash withdrawal/.test(label)) return "transfer";
  if (/refund|reversal|returned/.test(label) && Number(row.amount) > 0) return "refund";
  return Number(row.amount) < 0 ? "expense" : "income";
}

export function dedupeTransactions(rows: FinanceTransaction[]) {
  const replacedPendingIds = new Set(rows.map((row) => row.pending_transaction_id).filter((value): value is string => Boolean(value)));
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (row.pending && row.provider_transaction_id && replacedPendingIds.has(row.provider_transaction_id)) return false;
    const key = row.provider_transaction_id || row.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function goalProjection(goal: FinanceGoal, history: GoalHistory[], now: Date): GoalProjection {
  const currentAmount = Math.max(0, Number(goal.current_amount || 0));
  const targetAmount = Math.max(0, Number(goal.target_amount || 0));
  const remainingAmount = Math.max(0, targetAmount - currentAmount);
  const contributions = history
    .filter((row) => row.source_id === goal.id && row.payload)
    .map((row) => ({ at: new Date(row.occurred_at), delta: Number(row.payload?.current_amount ?? 0) - Number(row.payload?.previous_amount ?? 0) }))
    .filter((row) => row.delta > 0 && Number.isFinite(row.delta));
  const spanDays = contributions.length > 1 ? Math.max(1, (now.getTime() - Math.min(...contributions.map((row) => row.at.getTime()))) / 86400000) : 0;
  const currentMonthlyPace = contributions.length > 1 && spanDays >= 14
    ? contributions.reduce((sum, row) => sum + row.delta, 0) / spanDays * 30.4375
    : null;
  const monthsRemaining = goal.deadline ? Math.max(1 / 30.4375, (new Date(`${goal.deadline}T12:00:00`).getTime() - now.getTime()) / (86400000 * 30.4375)) : null;
  const configuredTargetPace = Number(goal.target_monthly_contribution || 0) || null;
  const requiredMonthlyPace = remainingAmount === 0 ? 0 : configuredTargetPace ?? (monthsRemaining && monthsRemaining > 0 ? remainingAmount / monthsRemaining : null);
  const estimatedCurrentPaceDate = currentMonthlyPace && currentMonthlyPace > 0 ? addMonths(now, remainingAmount / currentMonthlyPace) : null;
  const progressPct = targetAmount > 0 ? clamp((currentAmount / targetAmount) * 100) : 0;
  let status: GoalProjection["status"] = "insufficient_data";
  if (remainingAmount === 0 && targetAmount > 0) status = "completed";
  else if (currentMonthlyPace !== null && requiredMonthlyPace !== null) status = currentMonthlyPace > requiredMonthlyPace * 1.05 ? "ahead" : currentMonthlyPace >= requiredMonthlyPace * 0.95 ? "on_track" : "behind";
  return { goalId: goal.id, name: goal.title, currentAmount, targetAmount, remainingAmount, progressPct, currentMonthlyPace, requiredMonthlyPace, estimatedCurrentPaceDate, targetPaceDate: goal.deadline, status };
}

function chooseRecommendation(input: {
  overdueBills: Array<FinanceBill & { status: string }>;
  openBills: Array<FinanceBill & { status: string }>;
  upcomingTotal: number | null;
  cashAvailable: number | null;
  spendingPacePct: number | null;
  budgetRemaining: number | null;
  goals: GoalProjection[];
  savingsRate: number | null;
  factors: FinanceOverview["score"]["factors"];
}): FinanceRecommendation | null {
  if (input.overdueBills.length) return { category: "bills", priority: "high", observation: `${input.overdueBills.length} tracked bill${input.overdueBills.length === 1 ? " is" : "s are"} overdue.`, impact: "Overdue obligations can put immediate pressure on cash flow.", recommendedAction: "Review the overdue bill status and confirm what has been paid.", sourceIds: input.overdueBills.map((row) => row.id) };
  if (input.cashAvailable !== null && input.upcomingTotal !== null && input.upcomingTotal > input.cashAvailable) return { category: "cash_flow", priority: "high", observation: "Tracked upcoming bills are greater than available liquid cash.", impact: "The current cash position may not cover every tracked obligation.", recommendedAction: "Review bill timing and available cash before discretionary spending.", sourceIds: input.openBills.map((row) => row.id) };
  if ((input.spendingPacePct ?? 0) > 110) return { category: "budget", priority: "high", observation: `Spending is running ${input.spendingPacePct! - 100}% ahead of the month-to-date budget pace.`, impact: input.budgetRemaining !== null ? `${currency(Math.max(0, input.budgetRemaining))} remains in the monthly budget.` : "The configured monthly budget is at risk.", recommendedAction: "Protect the remaining budget by slowing the highest-spending flexible category.", sourceIds: [] };
  const behind = input.goals.find((goal) => goal.status === "behind");
  if (behind) return { category: "goal", priority: "medium", observation: `${behind.name} is behind its required contribution pace.`, impact: behind.targetPaceDate ? `At the current pace, the ${formatMonth(behind.targetPaceDate)} target is at risk.` : "Progress is slower than the configured contribution target.", recommendedAction: behind.requiredMonthlyPace ? `Review whether ${currency(behind.requiredMonthlyPace)} per month is realistic before changing the goal.` : "Add a repeatable contribution plan.", sourceIds: [behind.goalId] };
  if (input.savingsRate !== null && input.savingsRate < 0.15) return { category: "savings", priority: "medium", observation: `The current savings rate is ${percent(input.savingsRate)}.`, impact: "The current month is building savings more slowly than a 15% reference pace.", recommendedAction: "Review the largest flexible spending category before changing the savings target.", sourceIds: [] };
  if (input.factors.some((row) => row.value !== null)) return { category: "positive", priority: "low", observation: "The available Finance signals are currently on track.", impact: "Budget pace, cash flow, savings, and bill status show no urgent issue in the available data.", recommendedAction: "Keep the current plan steady and review again after the next sync.", sourceIds: [] };
  return null;
}

function factor(id: "budget" | "cash_flow" | "savings" | "consistency", value: number | null, label: string) {
  return { id, label, value, status: value === null ? "neutral" as const : value >= 80 ? "positive" as const : "needs_attention" as const };
}
function normalizeCategory(value: string | null) { const clean = (value || "Other").replaceAll("_", " ").trim(); return clean ? clean.replace(/\b\w/g, (char) => char.toUpperCase()) : "Other"; }
function billStatus(bill: FinanceBill, today: string) { if (bill.paid) return "paid"; if (bill.due_date < today) return "overdue"; const days = dayDifference(today, bill.due_date); return days <= 7 ? "due soon" : "upcoming"; }
function dayDifference(a: string, b: string) { return Math.round((new Date(`${b}T12:00:00Z`).getTime() - new Date(`${a}T12:00:00Z`).getTime()) / 86400000); }
function weightedAverage(values: Array<{ value: number | null; weight: number }>) { const available = values.filter((row): row is { value: number; weight: number } => row.value !== null); const weight = available.reduce((sum, row) => sum + row.weight, 0); return weight ? Math.round(available.reduce((sum, row) => sum + row.value * row.weight, 0) / weight) : null; }
function average(values: Array<number | null>) { const available = values.filter((value): value is number => value !== null); return available.length ? Math.round(available.reduce((sum, value) => sum + value, 0) / available.length) : null; }
function clamp(value: number) { return Math.max(0, Math.min(100, Math.round(value))); }
function percent(value: number) { return new Intl.NumberFormat(undefined, { style: "percent", maximumFractionDigits: 0 }).format(value); }
function currency(value: number) { return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value); }
function addMonths(date: Date, months: number) { if (!Number.isFinite(months) || months < 0 || months > 600) return null; const copy = new Date(date); copy.setMonth(copy.getMonth() + Math.ceil(months)); return copy.toISOString().slice(0, 10); }
function formatMonth(value: string) { return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { month: "long", year: "numeric" }); }
function latestDate(values: Array<string | null>) { const valid = values.filter((value): value is string => Boolean(value) && !Number.isNaN(new Date(value!).getTime())); return valid.sort((a, b) => b.localeCompare(a))[0] ?? null; }
