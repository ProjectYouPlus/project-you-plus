import Link from "next/link";
import { BillPlanner } from "@/components/money/bill-planner";
import { FinanceBudgetSetup } from "@/components/money/finance-budget-setup";
import { FinanceCoreMetrics } from "@/components/money/finance-core-metrics";
import { FinanceScoreCard } from "@/components/money/finance-score-card";
import { FinancialGoals } from "@/components/money/financial-goals";
import { PlaidConnectionStatus } from "@/components/money/plaid-connection-status";
import { getFinanceOverview } from "@/lib/data/finance";

export default async function MoneyPage() {
  const overview = await getFinanceOverview();
  return <main className="py-mobile-shell md:py-shell-narrow">
    <header className="mb-5 flex items-start justify-between gap-4">
      <div><div className="text-[11px] text-text-3">Financial operating picture</div><h1 className="py-title mt-1">Finance</h1><p className="py-subtitle">Know whether your current behavior is keeping you on track.</p></div>
      <Link href="/money/connect" className="py-glass rounded-full px-3.5 py-2.5 text-[11px] font-semibold text-accent-text">{overview.connection.status === "connected" ? "Manage" : "Connect"}</Link>
    </header>

    <FinanceScoreCard score={overview.score}/>
    <FinanceCoreMetrics metrics={overview.metrics}/>

    <section className="mt-4 py-glass-soft p-4">
      <div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-soft text-[10px] font-bold text-accent-text">AI</span><div><div className="text-[9.5px] font-semibold uppercase tracking-[.12em] text-text-3">Finance Agent</div><h2 className="m-0 mt-0.5 text-[16px] font-semibold text-text-1">{overview.recommendation ? "What matters most now" : "Waiting for a financial signal"}</h2></div></div>
      {overview.recommendation ? <div className="mt-3"><p className="m-0 text-[12.5px] font-medium leading-relaxed text-text-1">{overview.recommendation.observation}</p><p className="m-0 mt-1.5 text-[11px] leading-relaxed text-text-3">{overview.recommendation.impact}</p>{overview.recommendation.recommendedAction && <p className="m-0 mt-3 border-t border-white/[.06] pt-3 text-[11.5px] font-medium leading-relaxed text-accent-text">Recommendation: {overview.recommendation.recommendedAction}</p>}</div> : <p className="m-0 mt-3 text-[11.5px] leading-relaxed text-text-3">Add a budget, confirmed transactions, or a financial goal. Coach will wait for evidence before making a recommendation.</p>}
      <Link href="/coach" className="mt-3 inline-block text-[11px] font-semibold text-accent-text">Ask Coach about this →</Link>
    </section>

    <FinanceBudgetSetup month={overview.score.calculatedAt.slice(0, 7)} budgets={overview.categories.filter((row) => row.budget !== null).map((row) => ({ category: row.name, monthlyLimit: row.budget! }))} overallBudget={overview.metrics.budgetTotal}/>
    <FinancialGoals goals={overview.goals} accounts={overview.accounts}/>
    <BillPlanner bills={overview.bills.items.map((bill) => ({ ...bill, amount: Number(bill.amount), paid: Boolean(bill.paid) }))}/>

    <section className="mt-7"><div className="mb-3 flex items-end justify-between"><div><div className="text-[11px] text-text-3">Accounts</div><h2 className="m-0 mt-1 text-[21px] font-semibold tracking-[-.03em] text-text-1">Cash and balances</h2></div><Link href="/money/connect" className="text-[11px] font-semibold text-accent-text">Add or connect</Link></div>
      {overview.accounts.length ? <div className="py-glass-soft divide-y divide-white/[.055] px-4">{overview.accounts.map((account) => <div key={account.id} className="flex items-center gap-3 py-3.5"><span className={`flex h-9 w-9 items-center justify-center rounded-full text-[11px] font-bold ${account.connected_via === "plaid" ? "bg-accent-soft text-accent-text" : "bg-white/[.035] text-text-2"}`}>{account.account_type === "investment" ? "↗" : account.account_type === "credit" ? "C" : "$"}</span><span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-semibold text-text-1">{account.name}</span><span className="mt-0.5 block truncate text-[10px] capitalize text-text-3">{account.institution ? `${account.institution} · ` : ""}{account.account_type ?? "account"}{account.mask ? ` · •••• ${account.mask}` : ""}</span></span><span className={`text-[12px] font-semibold ${account.account_type === "credit" ? "text-warn" : "text-text-1"}`}>{money(Number(account.balance ?? 0))}</span></div>)}</div> : <div className="py-glass-soft p-4 text-[12px] text-text-3">No financial accounts are connected or entered yet.</div>}
    </section>

    {overview.investments.holdings.length > 0 && <section className="mt-7"><div className="mb-3"><div className="text-[11px] text-text-3">Investments</div><h2 className="m-0 mt-1 text-[21px] font-semibold tracking-[-.03em] text-text-1">Tracked holdings</h2></div><div className="py-glass-soft divide-y divide-white/[.055] px-4">{overview.investments.holdings.map((holding) => <div key={holding.id} className="flex items-center gap-3 py-3.5"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-positive-soft text-[10px] font-bold text-positive">{holding.ticker?.slice(0, 4) || "INV"}</span><span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-semibold text-text-1">{holding.name}</span><span className="mt-0.5 block text-[10px] text-text-3">Updated {date(holding.asOf)}</span></span><span className="text-[12px] font-semibold text-text-1">{money(holding.value)}</span></div>)}</div><p className="m-0 mt-2 px-1 text-[9.5px] leading-relaxed text-text-3">Values reflect the latest provider data. Project You+ does not estimate future returns.</p></section>}

    {overview.recentTransactions.length > 0 && <section className="mt-7"><div className="mb-3"><div className="text-[11px] text-text-3">Activity</div><h2 className="m-0 mt-1 text-[21px] font-semibold tracking-[-.03em] text-text-1">Recent confirmed movement</h2></div><div className="py-glass-soft divide-y divide-white/[.055] px-4">{overview.recentTransactions.slice(0, 8).map((item) => <div key={item.id} className="flex items-center gap-3 py-3"><span className="min-w-0 flex-1"><span className="block truncate text-[12.5px] font-semibold text-text-1">{item.merchant || item.category || "Transaction"}</span><span className="mt-0.5 block text-[9.5px] text-text-3">{date(item.occurred_at)}{item.pending ? " · pending, excluded from score" : ""}</span></span><span className={`text-[11.5px] font-semibold ${Number(item.amount) >= 0 ? "text-positive" : "text-text-2"}`}>{Number(item.amount) >= 0 ? "+" : "−"}{money(Math.abs(Number(item.amount)))}</span></div>)}</div></section>}

    <PlaidConnectionStatus connection={overview.connection}/>
    {overview.errors.length > 0 && <div className="mt-4 rounded-2xl border border-warn/20 bg-warn-soft p-3 text-[10.5px] leading-relaxed text-warn">Some Finance sources could not load. Available values are shown; affected values remain unavailable.</div>}
  </main>;
}

function money(value: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value); }
function date(value: string) { return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" }); }
