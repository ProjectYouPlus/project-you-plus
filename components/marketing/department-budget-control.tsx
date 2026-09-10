"use client";

import { useEffect, useState } from "react";

type BudgetState = {
  monthlyBudgetCents: number;
  estimatedSpendCents: number;
  remainingCents: number;
  developmentEnabled: boolean;
  growthEnabled: boolean;
  budgetMonth: string;
};

export function DepartmentBudgetControl() {
  const [budget, setBudget] = useState<BudgetState | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/ai-budget")
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Could not load AI budget");
        setBudget(data);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load AI budget"));
  }, []);

  async function patch(key: "developmentEnabled" | "growthEnabled", value: boolean) {
    if (!budget) return;
    setSaving(key);
    setError("");
    const previous = budget;
    setBudget({ ...budget, [key]: value });
    try {
      const res = await fetch("/api/ai-budget", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not update AI budget");
      setBudget(data);
    } catch (err) {
      setBudget(previous);
      setError(err instanceof Error ? err.message : "Could not update AI budget");
    } finally {
      setSaving(null);
    }
  }

  if (!budget) {
    return <div className="mb-4 rounded-[24px] border border-white/10 bg-white/[0.03] p-4 text-sm text-white/45">{error || "Loading AI operating budget…"}</div>;
  }

  const percent = budget.monthlyBudgetCents ? Math.min(100, (budget.estimatedSpendCents / budget.monthlyBudgetCents) * 100) : 0;
  const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  return (
    <section className="mb-4 rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,rgba(124,58,237,.13),rgba(255,255,255,.025))] p-5 sm:p-6">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-300/80">AI Operating Budget</p>
          <div className="mt-2 flex items-baseline gap-3">
            <span className="text-3xl font-semibold tracking-[-0.04em]">{money(budget.monthlyBudgetCents)}/mo</span>
            <span className="text-sm text-white/40">shared across Development + Growth</span>
          </div>
          <p className="mt-2 text-xs text-white/40">{money(budget.estimatedSpendCents)} estimated used · {money(budget.remainingCents)} remaining</p>
          <div className="mt-3 h-2 w-full max-w-xl overflow-hidden rounded-full bg-white/[0.06]">
            <div className="h-full rounded-full bg-violet-500 transition-all" style={{ width: `${percent}%` }} />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <DepartmentToggle
            title="Development Team"
            subtitle="Build, QA, backend, design, product"
            enabled={budget.developmentEnabled}
            disabled={saving !== null}
            onChange={(value) => patch("developmentEnabled", value)}
          />
          <DepartmentToggle
            title="Growth Department"
            subtitle="Strategy, content, trends, analytics"
            enabled={budget.growthEnabled}
            disabled={saving !== null}
            onChange={(value) => patch("growthEnabled", value)}
          />
        </div>
      </div>
      {error ? <div className="mt-4 text-xs text-red-300">{error}</div> : null}
    </section>
  );
}

function DepartmentToggle({ title, subtitle, enabled, disabled, onChange }: { title: string; subtitle: string; enabled: boolean; disabled: boolean; onChange: (value: boolean) => void }) {
  return (
    <div className="flex min-w-[250px] items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/20 p-4">
      <div>
        <div className="text-sm font-medium text-white">{title}</div>
        <div className="mt-1 text-[11px] text-white/35">{subtitle}</div>
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(!enabled)}
        className={`relative h-7 w-12 rounded-full border transition ${enabled ? "border-emerald-400/30 bg-emerald-400/25" : "border-white/10 bg-white/[0.06]"} disabled:opacity-50`}
        aria-label={`${enabled ? "Turn off" : "Turn on"} ${title}`}
      >
        <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${enabled ? "left-6" : "left-1"}`} />
      </button>
    </div>
  );
}
