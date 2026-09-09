import { HabitBoard } from "@/components/habits/habit-board";
import { getHabits } from "@/lib/data/habits";

export default async function HabitsPage() {
  const habits = await getHabits();
  const avgConsistency = habits.length > 0 ? Math.round(habits.reduce((sum, h) => sum + h.consistencyPct, 0) / habits.length) : 0;
  const best = [...habits].sort((a, b) => b.consistencyPct - a.consistencyPct)[0];
  const weakest = [...habits].sort((a, b) => a.consistencyPct - b.consistencyPct)[0];

  return (
    <main className="py-shell">
      <header className="mb-7">
        <div className="mb-2 text-[12px] font-semibold uppercase tracking-[0.16em] text-text-3">Consistency</div>
        <h1 className="m-0 py-title">Habits</h1>
        <p className="mt-2 text-[14px] text-text-2">Build the small behaviors that make your larger goals easier.</p>
      </header>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="py-card p-5"><div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-3">Consistency</div><div className="mt-2 text-[36px] font-bold tracking-tight text-text-1">{avgConsistency}%</div><div className="mt-1 text-[13px] text-text-2">this month</div></div>
        <div className="py-card p-5"><div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-3">Best habit</div><div className="mt-2 text-[17px] font-bold text-text-1">{best?.title ?? "—"}</div><div className="mt-1 text-[13px] text-positive">{best?.consistencyPct ?? 0}% consistent</div></div>
        <div className="py-card p-5"><div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-accent-text">AI opportunity</div><div className="mt-2 text-[17px] font-bold text-text-1">{weakest?.title ?? "—"}</div><div className="mt-1 text-[13px] leading-relaxed text-text-2">This is the habit most likely to lift your overall score if improved.</div></div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.35fr_.65fr]">
        <section className="py-card p-5 sm:p-6"><HabitBoard initialHabits={habits} /></section>
        <aside className="py-card p-5 sm:p-6"><div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-accent-text">Coach note</div><h2 className="m-0 mt-2 text-[20px] font-semibold text-text-1">Protect the weak link</h2><p className="mt-3 text-[14px] leading-relaxed text-text-2">Your habit system is strong overall. Sleep consistency is the exception, and it is likely spilling into recovery and focus.</p><div className="mt-5 border-t border-border pt-4"><div className="text-[12px] font-semibold text-text-2">Tonight</div><div className="mt-1.5 text-[14px] font-medium text-text-1">Start wind-down at 10:30 PM.</div></div></aside>
      </div>
    </main>
  );
}
