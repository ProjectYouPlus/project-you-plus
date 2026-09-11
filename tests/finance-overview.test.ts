import assert from "node:assert/strict";
import test from "node:test";
import { calculateFinanceOverview, dedupeTransactions, normalizedTransactionType } from "../lib/finance/overview";
import type { FinanceTransaction } from "../lib/finance/types";

const now = new Date("2026-09-11T16:00:00Z");
const transaction = (id: string, amount: number, extra: Partial<FinanceTransaction> = {}): FinanceTransaction => ({ id, account_id: null, amount, category: null, merchant: null, occurred_at: "2026-09-05T12:00:00Z", pending: false, ...extra });
const input = (overrides: Partial<Parameters<typeof calculateFinanceOverview>[0]> = {}) => ({
  now, timezone: "UTC", accounts: [], transactions: [], budgets: [], bills: [], holdings: [], goals: [], goalHistory: [], ...overrides,
});

test("returns unavailable score and metrics instead of invented zeroes with no data", () => {
  const result = calculateFinanceOverview(input());
  assert.equal(result.score.overall, null);
  assert.equal(result.metrics.cashAvailable, null);
  assert.equal(result.metrics.monthlySpending, null);
  assert.equal(result.recommendation, null);
});

test("scores only available factors when finance data is partial", () => {
  const result = calculateFinanceOverview(input({ budgets: [{ id: "b", category: "Overall", monthly_limit: 3000, period_start: "2026-09-01" }], transactions: [transaction("expense", -500)] }));
  assert.ok(result.score.overall !== null && result.score.overall >= 0 && result.score.overall <= 100);
  assert.equal(result.score.cashFlow, null);
  assert.equal(result.score.savings, null);
});

test("excludes pending transfers and card payments, while refunds reduce spending", () => {
  const result = calculateFinanceOverview(input({ transactions: [
    transaction("expense", -500, { transaction_type: "expense" }),
    transaction("refund", 100, { transaction_type: "refund" }),
    transaction("pending", -900, { pending: true, transaction_type: "expense" }),
    transaction("transfer", -250, { transaction_type: "transfer" }),
    transaction("card", -300, { transaction_type: "credit_card_payment" }),
  ] }));
  assert.equal(result.metrics.monthlySpending, 400);
});

test("removes a pending transaction when its posted replacement arrives", () => {
  const rows = [transaction("pending", -25, { pending: true, provider_transaction_id: "pending-provider" }), transaction("posted", -25, { provider_transaction_id: "posted-provider", pending_transaction_id: "pending-provider" })];
  assert.deepEqual(dedupeTransactions(rows).map((row) => row.id), ["posted"]);
});

test("recognizes provider categories for transfer, card payment, refund, income, and expense", () => {
  assert.equal(normalizedTransactionType(transaction("a", -50, { original_category: "TRANSFER_IN_ACCOUNT_TRANSFER" })), "transfer");
  assert.equal(normalizedTransactionType(transaction("b", -50, { original_category: "LOAN_PAYMENTS_CREDIT_CARD_PAYMENT" })), "credit_card_payment");
  assert.equal(normalizedTransactionType(transaction("c", 50, { original_category: "REFUND" })), "refund");
  assert.equal(normalizedTransactionType(transaction("d", 50)), "income");
  assert.equal(normalizedTransactionType(transaction("e", -50)), "expense");
});

test("finance behavior score is independent of account wealth", () => {
  const shared = { budgets: [{ id: "b", category: "Overall", monthly_limit: 3000, period_start: "2026-09-01" }], transactions: [transaction("income", 4000), transaction("expense", -700)] };
  const low = calculateFinanceOverview(input({ ...shared, accounts: [{ id: "low", name: "Checking", account_type: "checking", balance: 100, institution: null, connected_via: "manual", mask: null, last_synced_at: null }] }));
  const high = calculateFinanceOverview(input({ ...shared, accounts: [{ id: "high", name: "Checking", account_type: "checking", balance: 100000, institution: null, connected_via: "manual", mask: null, last_synced_at: null }] }));
  assert.equal(low.score.overall, high.score.overall);
});

test("budget pace changes with the date inside the month", () => {
  const shared = { timezone: "UTC", budgets: [{ id: "b", category: "Overall", monthly_limit: 3000, period_start: "2026-09-01" }], transactions: [transaction("expense", -900)] };
  const early = calculateFinanceOverview(input({ ...shared, now: new Date("2026-09-05T12:00:00Z") }));
  const middle = calculateFinanceOverview(input({ ...shared, now: new Date("2026-09-15T12:00:00Z") }));
  const late = calculateFinanceOverview(input({ ...shared, now: new Date("2026-09-29T12:00:00Z") }));
  assert.ok((early.score.budget ?? 0) < (middle.score.budget ?? 0));
  assert.ok((middle.score.budget ?? 0) <= (late.score.budget ?? 0));
});

test("goal projections remain finite with sparse history", () => {
  const result = calculateFinanceOverview(input({ goals: [{ id: "g", title: "Emergency fund", financial_goal_type: "emergency_fund", current_amount: 1000, target_amount: 6000, target_monthly_contribution: null, deadline: "2027-09-01", linked_account_id: null, status: "active", created_at: "2026-09-01T00:00:00Z" }] }));
  assert.equal(result.goals[0].status, "insufficient_data");
  assert.ok(Number.isFinite(result.goals[0].requiredMonthlyPace));
  assert.equal(result.goals[0].estimatedCurrentPaceDate, null);
});

test("prioritizes overdue bills ahead of lower-severity recommendations", () => {
  const result = calculateFinanceOverview(input({ bills: [{ id: "bill", name: "Rent", amount: 1200, due_date: "2026-09-01", paid: false }], budgets: [{ id: "b", category: "Overall", monthly_limit: 5000, period_start: "2026-09-01" }], transactions: [transaction("expense", -200)] }));
  assert.equal(result.recommendation?.category, "bills");
  assert.equal(result.recommendation?.priority, "high");
});
