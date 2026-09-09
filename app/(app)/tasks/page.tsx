import Link from "next/link";
import { TaskBoard } from "@/components/tasks/task-board";
import { getTasks } from "@/lib/data/tasks";
import { getGoals } from "@/lib/data/goals";

export default async function TasksPage() {
  const [tasks, goals] = await Promise.all([getTasks(), getGoals()]);
  const openTasks = tasks.filter((task) => !task.completedAt);
  const critical = openTasks.filter((task) => task.tier === "critical");
  const linked = openTasks.filter((task) => task.goalId);

  return (
    <main className="py-mobile-shell md:py-shell">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="py-eyebrow mb-1.5">Execution</div>
          <h1 className="py-title">Tasks</h1>
          <p className="py-subtitle">Do the work that actually moves your goals forward.</p>
        </div>
        <Link href="/tasks/new" className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface text-[22px] text-text-1">+</Link>
      </header>

      <section className="py-accent-card p-[18px] sm:p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="py-eyebrow text-accent-text">Today</div>
            <div className="mt-1 text-[25px] font-bold tracking-[-0.035em] text-text-1">{openTasks.length} tasks · 2h 40m</div>
            <div className="mt-1 text-[12.5px] text-text-2">{critical.length || 1} high-impact action first</div>
          </div>
          <span className="flex h-14 w-14 items-center justify-center rounded-full border-[6px] border-accent text-[12px] font-bold text-text-1">50%</span>
        </div>
      </section>

      <section className="mt-4 rounded-[18px] border border-border bg-[var(--surface-2)] p-4">
        <div className="flex gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-[12px] font-bold text-white">AI</span>
          <div>
            <div className="text-[13px] font-semibold text-text-1">AI priority</div>
            <p className="m-0 mt-1 text-[12.5px] leading-relaxed text-text-2">{openTasks[0]?.title ? `Start with “${openTasks[0].title}.” It has the strongest combination of urgency and goal impact.` : "Your plan is clear. Use the next open block on your highest-impact goal."}</p>
          </div>
        </div>
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.35fr_.65fr]">
        <section className="py-card p-[18px] sm:p-6"><TaskBoard initialTasks={tasks} goals={goals} /></section>
        <aside className="space-y-4">
          <section className="py-card p-[18px]">
            <div className="py-eyebrow">Today at a glance</div>
            <div className="mt-4 grid grid-cols-3 gap-3">
              <div><div className="text-[24px] font-bold text-text-1">{openTasks.length}</div><div className="text-[11.5px] text-text-3">Open</div></div>
              <div><div className="text-[24px] font-bold text-danger">{critical.length}</div><div className="text-[11.5px] text-text-3">Critical</div></div>
              <div><div className="text-[24px] font-bold text-positive">{linked.length}</div><div className="text-[11.5px] text-text-3">Goal-linked</div></div>
            </div>
          </section>
          <Link href="/tasks/new" className="py-button-primary w-full">Add smart task</Link>
        </aside>
      </div>
    </main>
  );
}
