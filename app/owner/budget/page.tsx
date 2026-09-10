import Link from "next/link";
import { requireAdmin } from "@/lib/owner/access";
import { getDepartmentBudget } from "@/lib/ai/department-budget";
import { updateDepartmentBudget, updateMonthlyBudget } from "@/lib/actions/ai-budget";

export const dynamic = "force-dynamic";

export default async function AIBudgetPage() {
  const { supabase } = await requireAdmin();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Unauthorized");
  const budget = await getDepartmentBudget(supabase, auth.user.id);
  const percent = budget.monthly_budget_cents ? Math.min(100, Math.round((budget.estimated_spend_cents / budget.monthly_budget_cents) * 100)) : 0;
  const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  return (
    <main className="min-h-screen bg-bg text-text-1">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <div className="text-[9px] font-bold uppercase tracking-[.18em] text-accent-text">Owner Controls</div>
            <h1 className="mt-2 text-[36px] font-bold tracking-[-.045em]">AI Operating Budget</h1>
            <p className="mt-2 text-[13px] text-text-2">One shared monthly cap across the Development Team and Growth Department.</p>
          </div>
          <Link href="/owner/agents" className="rounded-xl border border-border px-4 py-2.5 text-[11px] font-bold text-text-2 hover:text-white">Back to AI Team</Link>
        </div>

        <section className="rounded-[24px] border border-accent/20 bg-[linear-gradient(135deg,rgba(139,92,246,.12),rgba(34,211,238,.03))] p-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[.14em] text-text-3">Monthly budget</div>
              <div className="mt-2 text-[44px] font-bold tracking-[-.05em]">{money(budget.monthly_budget_cents)}</div>
              <div className="mt-1 text-[11px] text-text-2">{money(budget.estimated_spend_cents)} estimated used · {money(Math.max(0, budget.monthly_budget_cents - budget.estimated_spend_cents))} remaining</div>
            </div>
            <form action={updateMonthlyBudget} className="flex items-end gap-2">
              <label className="text-[10px] font-bold uppercase tracking-[.1em] text-text-3">Change cap<input name="dollars" type="number" min="0" step="1" defaultValue={budget.monthly_budget_cents / 100} className="mt-2 block w-28 rounded-xl border border-border bg-bg px-3 py-2.5 text-[13px] text-white outline-none" /></label>
              <button className="rounded-xl bg-accent px-4 py-2.5 text-[11px] font-bold text-white">Save</button>
            </form>
          </div>
          <div className="mt-6 h-2 overflow-hidden rounded-full bg-white/[.06]"><div className="h-full rounded-full bg-accent" style={{ width: `${percent}%` }} /></div>
        </section>

        <section className="mt-5 grid gap-4 md:grid-cols-2">
          <DepartmentCard name="Development Team" enabled={budget.development_enabled} department="development" description="Orchestrator, Builder, QA, Backend, Design and Product agents." />
          <DepartmentCard name="Growth Department" enabled={budget.growth_enabled} department="growth" description="Strategy, Reels, Creative, Copy, Trends, Analytics, Community, Partnerships and Atlas." />
        </section>

        <div className="mt-5 rounded-[20px] border border-border bg-surface p-5 text-[11px] leading-relaxed text-text-2">
          Turning a department off blocks new AI work from that department at the server layer. Existing completed work remains available. The monthly cap resets automatically at the start of each month.
        </div>
      </div>
    </main>
  );
}

function DepartmentCard({ name, enabled, department, description }: { name: string; enabled: boolean; department: "development" | "growth"; description: string }) {
  return (
    <article className="rounded-[22px] border border-border bg-surface p-5">
      <div className="flex items-start justify-between gap-4">
        <div><h2 className="text-[17px] font-bold">{name}</h2><p className="mt-2 text-[11px] leading-relaxed text-text-2">{description}</p></div>
        <span className={`rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-[.08em] ${enabled ? "bg-positive-soft text-positive" : "bg-white/[.04] text-text-3"}`}>{enabled ? "On" : "Off"}</span>
      </div>
      <form action={updateDepartmentBudget} className="mt-5">
        <input type="hidden" name="department" value={department} />
        <input type="hidden" name="enabled" value={String(!enabled)} />
        <button className={`w-full rounded-xl border px-4 py-3 text-[11px] font-bold ${enabled ? "border-negative/20 bg-negative/5 text-negative" : "border-positive/20 bg-positive-soft text-positive"}`}>{enabled ? `Turn ${name} Off` : `Turn ${name} On`}</button>
      </form>
    </article>
  );
}
