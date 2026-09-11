export type FinanceTransactionType =
  | "income"
  | "expense"
  | "refund"
  | "transfer"
  | "credit_card_payment"
  | "unknown";

export type FinanceAccount = {
  id: string;
  name: string;
  account_type: string | null;
  balance: number | string | null;
  institution: string | null;
  connected_via: string | null;
  mask: string | null;
  last_synced_at: string | null;
};

export type FinanceTransaction = {
  id: string;
  account_id: string | null;
  amount: number | string;
  category: string | null;
  original_category?: string | null;
  merchant: string | null;
  occurred_at: string;
  pending: boolean;
  transaction_type?: FinanceTransactionType | null;
  provider_transaction_id?: string | null;
  pending_transaction_id?: string | null;
};

export type FinanceBudget = {
  id: string;
  category: string;
  monthly_limit: number | string;
  period_start: string;
};

export type FinanceBill = {
  id: string;
  name: string;
  amount: number | string;
  due_date: string;
  paid: boolean | null;
};

export type FinanceGoal = {
  id: string;
  title: string;
  financial_goal_type: string | null;
  current_amount: number | string | null;
  target_amount: number | string | null;
  target_monthly_contribution: number | string | null;
  deadline: string | null;
  linked_account_id: string | null;
  status: string | null;
  created_at: string;
};

export type FinanceScoreFactor = {
  id: "budget" | "cash_flow" | "savings" | "consistency";
  label: string;
  value: number | null;
  status: "positive" | "neutral" | "needs_attention";
};

export type FinanceScore = {
  overall: number | null;
  budget: number | null;
  cashFlow: number | null;
  savings: number | null;
  consistency: number | null;
  direction: number | null;
  directionLabel: "improving" | "stable" | "declining" | "calibrating";
  primaryReason: string;
  calculatedAt: string;
  factors: FinanceScoreFactor[];
};

export type GoalProjection = {
  goalId: string;
  name: string;
  currentAmount: number;
  targetAmount: number;
  remainingAmount: number;
  progressPct: number;
  currentMonthlyPace: number | null;
  requiredMonthlyPace: number | null;
  estimatedCurrentPaceDate: string | null;
  targetPaceDate: string | null;
  status: "ahead" | "on_track" | "behind" | "completed" | "insufficient_data";
};

export type FinanceRecommendation = {
  category: "budget" | "spending" | "cash_flow" | "savings" | "bills" | "goal" | "positive";
  priority: "low" | "medium" | "high";
  observation: string;
  impact: string;
  recommendedAction: string | null;
  sourceIds: string[];
};

export type FinanceOverview = {
  score: FinanceScore;
  metrics: {
    cashAvailable: number | null;
    monthlySpending: number | null;
    budgetTotal: number | null;
    budgetRemaining: number | null;
    savingsRate: number | null;
    income: number | null;
    netCashFlow: number | null;
    spendingPacePct: number | null;
  };
  categories: Array<{ name: string; spent: number; budget: number | null; pacePct: number | null }>;
  accounts: FinanceAccount[];
  recentTransactions: FinanceTransaction[];
  bills: { upcomingCount: number; totalUpcoming: number | null; next: (FinanceBill & { status: string }) | null; items: Array<FinanceBill & { status: string }> };
  investments: { totalValue: number | null; holdings: Array<{ id: string; ticker: string | null; name: string; value: number; asOf: string }> };
  goals: GoalProjection[];
  recommendation: FinanceRecommendation | null;
  connection: { status: "connected" | "syncing" | "needs_attention" | "disconnected"; environment: string | null; lastSyncedAt: string | null };
  dataFreshness: { lastSyncedAt: string | null };
  errors: string[];
};
