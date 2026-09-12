import Link from "next/link";
import { startResetAction } from "@/lib/actions/reset";
import { getResetView } from "@/lib/reset/service";

export async function ResetCard({ surface = "today" }: { surface?: "today" | "coach" | "progress" | "review" | "you" }) {
  let view;
  try { view = await getResetView(); } catch { return null; }
  if (!view.available) {
    if (!view.canStartManually || surface === "review") return null;
    return <section className="py-glass-soft py-animate-in mb-4 p-4 sm:p-[18px]" aria-label="7-Day Project You+ Reset">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-accent/10 text-[11px] font-bold text-accent-text">7D</div>
        <div className="min-w-0 flex-1"><div className="py-eyebrow text-accent-text">7-Day Project You+ Reset</div><h2 className="m-0 mt-1 text-[17px] font-semibold tracking-[-.02em] text-text-1">Turn your current plan into a week you can follow.</h2><p className="m-0 mt-1.5 text-[12px] leading-relaxed text-text-2">Uses your existing goals, actions, schedule, Coach preferences, and Weekly Review. Nothing is rebuilt.</p></div>
      </div>
      <form action={startResetAction} className="mt-4"><button className="py-liquid-button min-h-11 w-full" type="submit">Start my 7-Day Reset</button></form>
    </section>;
  }
  if (view.preparationEvening || view.day === 0) return <section className="py-glass-soft py-animate-in mb-4 p-4 sm:p-[18px]" aria-label="7-Day Project You+ Reset preparation">
    <div className="flex items-center justify-between gap-3"><div className="py-eyebrow text-accent-text">Your 7-Day Project You+ Reset</div><span className="py-glass-pill text-[10px] text-text-2">Prep evening</span></div>
    <h2 className="m-0 mt-2 text-[19px] font-semibold tracking-[-.025em] text-text-1">Tomorrow starts with a realistic Day 1.</h2>
    <p className="m-0 mt-1.5 text-[12.5px] leading-relaxed text-text-2">Your first week is designed to turn your plan into a system you can actually follow. Tonight, your plan stays light.</p>
    <Link href="/reset" className="mt-4 inline-flex min-h-11 items-center text-[12px] font-semibold text-accent-text">See tomorrow’s direction →</Link>
  </section>;

  const next = view.priorities.find((item) => !item.completed)?.title ?? view.minimumDay.find((item) => !item.completed)?.title ?? (view.day === 7 ? "Open your first Weekly Review" : "Close today when you’re ready");
  const progress = Math.max(1, Math.min(7, view.day));
  return <section className="py-glass-soft py-animate-in mb-4 overflow-hidden p-4 sm:p-[18px]" aria-label={`Day ${view.day} of 7 Project You+ Reset`}>
    <div className="flex items-center justify-between gap-3"><div className="py-eyebrow text-accent-text">7-Day Project You+ Reset</div><span className="py-glass-pill text-[10px] text-text-2">Day {view.day} of 7</span></div>
    <div className="mt-3 py-progress-track"><div className="py-progress-fill transition-all duration-200" style={{ width: `${Math.round(progress / 7 * 100)}%` }}/></div>
    <h2 className="m-0 mt-3 text-[18px] font-semibold tracking-[-.025em] text-text-1">{view.definition?.theme}</h2>
    <p className="m-0 mt-1 text-[12px] leading-relaxed text-text-2">{view.definition?.focus}</p>
    {view.recovery.active && <div className="mt-3 rounded-[14px] border border-accent/15 bg-accent/[.06] px-3 py-2.5 text-[11.5px] leading-relaxed text-[#D8CAFA]">You returned. {view.recovery.message}</div>}
    <div className="mt-3 flex items-center gap-3 rounded-[14px] border border-white/[.06] bg-white/[.025] px-3 py-3"><span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-text-1">{next}</span><Link href="/reset" className="shrink-0 text-[11px] font-semibold text-accent-text">Open</Link></div>
  </section>;
}
