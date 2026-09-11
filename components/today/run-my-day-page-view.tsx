"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import type { RunMyDayPlan } from "@/lib/types";

export function RunMyDayPageView({ initialPlan }: { initialPlan: RunMyDayPlan }) {
  const [plan, setPlan] = useState(initialPlan);
  const [mode, setMode] = useState("live context");
  const [pending, startTransition] = useTransition();

  function regenerate() {
    startTransition(() => { void (async () => {
      const response = await fetch("/api/run-my-day", { method: "POST" });
      const data = await response.json() as { plan?: RunMyDayPlan; mode?: string };
      if (!response.ok || !data.plan) return;
      setPlan(data.plan);
      setMode(data.mode?.includes("local") ? "live context" : "AI optimized");
    })(); });
  }

  return <main className="py-shell-narrow">
    <header className="mb-7 flex items-end justify-between gap-4"><div><div className="py-eyebrow mb-2 text-accent-text">Today · {mode}</div><h1 className="py-title">Run My Day</h1><p className="py-subtitle max-w-[620px]">Built from your actual tasks, calendar, habits, training, health, and financial context.</p></div><button onClick={regenerate} disabled={pending} className="py-button-secondary w-fit shrink-0 disabled:opacity-50">{pending ? "Rebuilding…" : "Regenerate"}</button></header>
    <section className="py-accent-card p-5 sm:p-6"><div className="py-section-label text-accent-text">Why this plan</div><p className="mb-0 mt-2 text-[14px] leading-6 text-text-1">{pending ? "Reading your latest Project You+ activity…" : plan.explanation}</p></section>
    <section className="py-card mt-5 overflow-hidden"><div className="border-b border-border px-5 py-4 sm:px-6"><div className="py-section-label">Optimized schedule</div><h2 className="py-section-title">Your real priorities, in order</h2></div><div className="px-5 py-2 sm:px-6">{plan.items.length ? plan.items.map((item, i) => <div key={`${item.time}-${item.title}`} className="grid grid-cols-[74px_16px_1fr] gap-3 border-b border-border py-4 last:border-b-0"><div className="pt-0.5 text-[12px] font-medium text-text-3">{item.time}</div><div className="relative flex justify-center"><span className={`mt-1.5 h-2.5 w-2.5 rounded-full ${i===0?"bg-accent shadow-[0_0_18px_rgba(139,92,246,.8)]":"bg-[var(--border-strong)]"}`}/></div><div><div className="text-[14px] font-semibold text-text-1">{item.title}</div>{item.note&&<div className="mt-1 text-[12.5px] leading-relaxed text-text-3">{item.note}</div>}</div></div>) : <div className="py-8 text-center"><div className="text-[13px] font-semibold text-text-1">Your day is open</div><p className="mx-auto mb-0 mt-2 max-w-[300px] text-[11.5px] leading-relaxed text-text-3">Add a task or connect your calendar, then regenerate to build a useful plan.</p></div>}</div></section>
    <div className="mt-5 grid gap-3 sm:grid-cols-2"><Link href="/today" className="py-button-primary w-full">Use this plan</Link><Link href="/tasks/new" className="py-button-secondary w-full">Add a task</Link></div><p className="mt-3 text-center text-[11px] text-text-3">Nothing here is sample data. The plan changes as your Project You+ data changes.</p><div className="mt-6 text-center"><Link href="/dashboard" className="text-[13px] font-semibold text-accent-text">← Back to Dashboard</Link></div>
  </main>;
}
