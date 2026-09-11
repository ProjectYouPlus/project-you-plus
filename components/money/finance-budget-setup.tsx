"use client";

import { useState, useTransition } from "react";
import { saveMonthlyBudget } from "@/lib/actions/finance";

export function FinanceBudgetSetup({ month, budgets, overallBudget }: { month: string; budgets: Array<{ category: string; monthlyLimit: number }>; overallBudget: number | null }) {
  const [open, setOpen] = useState(false); const [pending, startTransition] = useTransition(); const [message, setMessage] = useState<string | null>(null);
  function submit(formData: FormData) { setMessage(null); startTransition(() => { void saveMonthlyBudget(formData).then((result) => { setMessage(result.error); if (!result.error) setOpen(false); }); }); }
  return <section className="mt-7"><div className="mb-3 flex items-end justify-between"><div><div className="text-[11px] text-text-3">Spending plan</div><h2 className="m-0 mt-1 text-[21px] font-semibold tracking-[-.03em] text-text-1">Monthly budget</h2></div><button type="button" onClick={() => setOpen((value) => !value)} className="text-[11px] font-semibold text-accent-text">{open ? "Close" : overallBudget === null ? "+ Set budget" : "Edit budget"}</button></div>
    {open && <form action={submit} className="py-glass-soft mb-3 grid gap-2.5 p-4 sm:grid-cols-[1fr_130px_auto]"><input type="hidden" name="periodStart" value={`${month}-01`}/><input name="category" defaultValue="Overall" required placeholder="Overall or category" className="py-input min-h-[44px] py-2 text-[13px]"/><input name="monthlyLimit" required min="0.01" max="1000000000" step="0.01" type="number" placeholder="Amount" className="py-input min-h-[44px] py-2 text-[13px]"/><button disabled={pending} className="py-button-primary min-h-[44px] disabled:opacity-50">{pending ? "Saving…" : "Confirm"}</button>{message && <p className="m-0 text-[11px] text-danger sm:col-span-3">{message}</p>}</form>}
    {overallBudget === null ? <div className="py-glass-soft p-4 text-[12px] leading-relaxed text-text-3">No monthly budget is configured. Budget and consistency factors remain unscored until you confirm one.</div> : <div className="py-glass-soft p-4"><div className="flex items-center justify-between"><span className="text-[12px] font-semibold text-text-1">{money(overallBudget)} planned</span><span className="text-[9.5px] text-text-3">{month}</span></div>{budgets.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{budgets.map((budget) => <span key={budget.category} className="py-glass-pill text-[9px] text-text-2">{budget.category} · {money(budget.monthlyLimit)}</span>)}</div>}</div>}
  </section>;
}

function money(value: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value); }
