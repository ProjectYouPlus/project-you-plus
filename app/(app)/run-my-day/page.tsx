import Link from "next/link";
import { mockRunMyDayPlan } from "@/lib/mock-data";

export default function RunMyDayPage() {
  return (
    <main className="py-shell-narrow">
      <header className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="py-eyebrow mb-2 text-accent-text">AI daily plan</div>
          <h1 className="py-title">Run My Day</h1>
          <p className="py-subtitle max-w-[620px]">An optimized plan built around your priorities, commitments, health, habits and current 1% Score.</p>
        </div>
        <button className="py-button-secondary w-fit">Regenerate</button>
      </header>

      <section className="py-accent-card p-5 sm:p-6">
        <div className="py-section-label text-accent-text">Why this plan</div>
        <p className="mb-0 mt-2 text-[14px] leading-6 text-text-1">{mockRunMyDayPlan.explanation}</p>
      </section>

      <section className="py-card mt-5 overflow-hidden">
        <div className="border-b border-border px-5 py-4 sm:px-6"><div className="py-section-label">Optimized schedule</div><h2 className="py-section-title">Your day, rebuilt around what matters</h2></div>
        <div className="px-5 py-2 sm:px-6">
          {mockRunMyDayPlan.items.map((item, i) => (
            <div key={`${item.time}-${item.title}`} className="grid grid-cols-[74px_16px_1fr] gap-3 border-b border-border py-4 last:border-b-0">
              <div className="pt-0.5 text-[12px] font-medium text-text-3">{item.time}</div>
              <div className="relative flex justify-center"><span className={`mt-1.5 h-2.5 w-2.5 rounded-full ${i===2?'bg-accent shadow-[0_0_18px_rgba(139,92,246,.8)]':'bg-[var(--border-strong)]'}`} /></div>
              <div><div className="text-[14px] font-semibold text-text-1">{item.title}</div>{item.note && <div className="mt-1 text-[12.5px] leading-relaxed text-text-3">{item.note}</div>}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <button className="py-button-primary w-full">Accept plan</button>
        <button className="py-button-secondary w-full">Adjust plan</button>
      </div>
      <p className="mt-3 text-center text-[11px] text-text-3">External calendar changes stay disabled until you connect a calendar integration.</p>
      <div className="mt-6 text-center"><Link href="/today" className="text-[13px] font-semibold text-accent-text">← Back to Today</Link></div>
    </main>
  );
}
