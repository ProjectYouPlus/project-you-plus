import type { FinanceOverview } from "@/lib/finance/types";

export function FinanceCoreMetrics({ metrics }: { metrics: FinanceOverview["metrics"] }) {
  const items = [
    { label: "Cash available", value: cash(metrics.cashAvailable), note: metrics.cashAvailable === null ? "Add a cash account" : "Checking + savings + cash" },
    { label: "Monthly spending", value: cash(metrics.monthlySpending), note: metrics.monthlySpending === null ? "No confirmed activity" : "Transfers and pending excluded" },
    { label: "Budget remaining", value: cash(metrics.budgetRemaining), note: metrics.budgetTotal === null ? "Set a monthly budget" : metrics.spendingPacePct === null ? "Current month" : `${metrics.spendingPacePct}% of expected pace` },
    { label: "Savings rate", value: metrics.savingsRate === null ? "—" : `${Math.round(metrics.savingsRate * 100)}%`, note: metrics.savingsRate === null ? "Needs confirmed income" : "Confirmed month to date" },
  ];
  return <section className="mt-3 grid grid-cols-2 gap-2.5">{items.map((item) => <div key={item.label} className="py-glass-soft p-3.5"><div className="text-[9.5px] text-text-3">{item.label}</div><div className="mt-2 truncate text-[18px] font-bold tracking-[-.04em] text-text-1">{item.value}</div><div className="mt-1 text-[8.5px] leading-snug text-text-3">{item.note}</div></div>)}</section>;
}

function cash(value: number | null) { return value === null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value); }
