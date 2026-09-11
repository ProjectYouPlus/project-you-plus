"use client";

import { useEffect, useState } from "react";

type GrowthMode = "manual" | "assisted" | "autopilot";
type BudgetState = {
  monthlyBudgetCents: number; estimatedSpendCents: number; remainingCents: number;
  developmentSpendCents: number; growthSpendCents: number;
  developmentEnabled: boolean; growthEnabled: boolean; growthMode: GrowthMode; budgetMonth: string;
};

export function DepartmentBudgetControl() {
  const [budget, setBudget] = useState<BudgetState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/ai-budget", { cache: "no-store" }).then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load AI budget");
      setBudget(data);
    }).catch((reason) => setError(reason instanceof Error ? reason.message : "Could not load AI budget"));
  }, []);

  async function update(values: Partial<Pick<BudgetState, "developmentEnabled" | "growthEnabled" | "growthMode">>) {
    if (!budget) return;
    const previous = budget;
    setBudget({ ...budget, ...values });
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/ai-budget", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(values) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not update AI controls");
      setBudget(data);
    } catch (reason) {
      setBudget(previous);
      setError(reason instanceof Error ? reason.message : "Could not update AI controls");
    } finally { setSaving(false); }
  }

  if (!budget) return <div className="rounded-xl border border-[#26344b] bg-[#09111e] p-5 text-[11px] text-[#7e8ba2]">{error || "Loading department controls…"}</div>;

  const percent = budget.monthlyBudgetCents ? Math.min(100, (budget.estimatedSpendCents / budget.monthlyBudgetCents) * 100) : 0;
  const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  const nextReset = new Date(); nextReset.setMonth(nextReset.getMonth() + 1, 1);

  return (
    <section className="rounded-xl border border-[#2a2750] bg-[radial-gradient(circle_at_12%_0%,rgba(115,73,255,.15),transparent_34%),linear-gradient(180deg,#0d1423,#080e18)] p-4 shadow-[0_20px_70px_rgba(0,0,0,.28)]">
      <div className="grid gap-4 2xl:grid-cols-[1.2fr_.9fr_1fr]">
        <div className="rounded-xl border border-[#27354b] bg-[#080e18]/80 p-4">
          <div className="flex items-start justify-between gap-4"><div><div className="text-[9px] font-semibold uppercase tracking-[.2em] text-[#9a83ee]">AI Operating Budget</div><div className="mt-2 text-[22px] font-semibold tracking-[-.04em]">{money(budget.estimatedSpendCents)} <span className="text-[12px] font-normal text-[#77849a]">/ {money(budget.monthlyBudgetCents)}</span></div></div><div className="rounded-full border border-[#3d356b] bg-[#18132d] px-2.5 py-1 text-[9px] text-[#baabf2]">Estimated usage</div></div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#151e2d]"><div className="h-full rounded-full bg-[linear-gradient(90deg,#7050ff,#9c73ff)] transition-all" style={{ width: `${percent}%` }} /></div>
          <div className="mt-3 grid grid-cols-3 gap-3 text-[9px]"><BudgetFact label="Used" value={`${percent.toFixed(1)}%`} /><BudgetFact label="Remaining" value={money(budget.remainingCents)} /><BudgetFact label="Reset" value={nextReset.toLocaleDateString("en-US", { month: "short", day: "numeric" })} /></div>
          <div className="mt-3 flex gap-4 border-t border-[#1d293b] pt-3 text-[9px] text-[#7f8ca1]"><span>Development <b className="font-medium text-[#c6cedc]">{money(budget.developmentSpendCents)}</b></span><span>Growth <b className="font-medium text-[#c6cedc]">{money(budget.growthSpendCents)}</b></span></div>
        </div>
        <div className="rounded-xl border border-[#27354b] bg-[#080e18]/80 p-4">
          <div className="text-[9px] font-semibold uppercase tracking-[.2em] text-[#8794aa]">Growth Department</div>
          <div className="mt-3 flex items-center justify-between gap-4"><div><div className="text-[15px] font-semibold">{budget.growthEnabled ? "Online" : "Paused"}</div><p className="mt-1 text-[9px] leading-4 text-[#738096]">OFF blocks new AI marketing runs. Passive Instagram analytics may continue.</p></div><Toggle enabled={budget.growthEnabled} disabled={saving} label="Growth Department" onChange={(enabled) => update({ growthEnabled: enabled })} /></div>
          <div className="mt-4 flex items-center justify-between border-t border-[#1d293b] pt-3 text-[9px]"><span className="text-[#718097]">Development Team</span><button type="button" disabled={saving} onClick={() => update({ developmentEnabled: !budget.developmentEnabled })} className={budget.developmentEnabled ? "text-emerald-300" : "text-[#6f7b90]"}>{budget.developmentEnabled ? "● ON" : "○ OFF"}</button></div>
        </div>
        <div className="rounded-xl border border-[#27354b] bg-[#080e18]/80 p-4">
          <div className="flex items-center justify-between"><div className="text-[9px] font-semibold uppercase tracking-[.2em] text-[#8794aa]">Mode</div><span className="text-[9px] text-emerald-300">Approval gated</span></div>
          <div className="mt-3 grid grid-cols-3 rounded-lg border border-[#27354b] bg-[#070c14] p-1">{(["manual", "assisted", "autopilot"] as GrowthMode[]).map((mode) => <button key={mode} type="button" disabled={saving || mode !== "assisted"} title={mode === "assisted" ? "Current mode" : "Coming later"} onClick={() => update({ growthMode: mode })} className={`rounded-md px-2 py-2 text-[9px] font-medium capitalize transition ${budget.growthMode === mode ? "bg-[#392477] text-[#e0d8ff] shadow-sm" : "text-[#4f5a6c]"}`}>{mode}</button>)}</div>
          <p className="mt-3 text-[9px] leading-4 text-[#738096]">Assisted lets agents analyze, generate and prepare queues. Outreach, sensitive replies, spending and publishing remain owner controlled.</p>
        </div>
      </div>
      {error ? <p className="mt-3 text-[10px] text-red-300">{error}</p> : null}
    </section>
  );
}

function BudgetFact({ label, value }: { label: string; value: string }) { return <div><div className="text-[#68758a]">{label}</div><div className="mt-0.5 font-medium text-[#c8cfdd]">{value}</div></div>; }
function Toggle({ enabled, disabled, label, onChange }: { enabled: boolean; disabled: boolean; label: string; onChange: (value: boolean) => void }) { return <button type="button" role="switch" aria-checked={enabled} aria-label={`${enabled ? "Turn off" : "Turn on"} ${label}`} disabled={disabled} onClick={() => onChange(!enabled)} className={`relative h-7 w-12 shrink-0 rounded-full border transition ${enabled ? "border-emerald-400/35 bg-emerald-400/20" : "border-[#313b4b] bg-[#141b27]"} disabled:opacity-50`}><span className={`absolute top-1 h-[18px] w-[18px] rounded-full bg-white shadow transition-all ${enabled ? "left-6" : "left-1"}`} /></button>; }
