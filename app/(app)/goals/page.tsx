import Link from "next/link";
import { GoalCard } from "@/components/goals/goal-card";
import { getGoals } from "@/lib/data/goals";

export default async function GoalsPage() {
  const goals = await getGoals();
  const active = goals.filter((g) => g.status === "active");
  const other = goals.filter((g) => g.status !== "active");
  const avgProgress = active.length ? Math.round(active.reduce((sum, g) => sum + g.progress, 0) / active.length) : 0;
  const strongest = [...active].sort((a, b) => b.progress - a.progress)[0];
  const weakest = [...active].sort((a, b) => a.progress - b.progress)[0];

  return (
    <main className="py-shell">
      <header className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 text-[12px] font-semibold uppercase tracking-[0.16em] text-text-3">Direction</div>
          <h1 className="m-0 py-title">Goals</h1>
          <p className="mt-2 text-[14px] text-text-2">Turn long-term ambition into visible weekly progress.</p>
        </div>
        <Link href="/goals/new" className="inline-flex w-fit rounded-lg bg-text-1 px-4 py-2.5 text-[13.5px] font-semibold text-bg">New goal</Link>
      </header>

      {active.length > 0 && (
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <div className="py-card p-5"><div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-3">Overall progress</div><div className="mt-2 text-[34px] font-bold tracking-tight text-text-1">{avgProgress}%</div><div className="mt-1 text-[13px] text-text-2">across active goals</div></div>
          <div className="py-card p-5"><div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-3">Strongest trajectory</div><div className="mt-2 text-[18px] font-bold text-text-1">{strongest?.title}</div><div className="mt-1 text-[13px] text-positive">{strongest?.progress}% complete</div></div>
          <div className="py-card p-5"><div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-accent-text">AI focus</div><div className="mt-2 text-[18px] font-bold text-text-1">{weakest?.title}</div><div className="mt-1 text-[13px] leading-relaxed text-text-2">This goal needs the clearest next milestone this week.</div></div>
        </div>
      )}

      {active.length === 0 && other.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-14 text-center"><p className="m-0 mb-4 text-[14.5px] text-text-2">No goals yet — your biggest ambitions start here.</p><Link href="/goals/new" className="text-[14px] font-semibold text-accent-text">Create your first goal</Link></div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.35fr_.65fr]">
          <section className="py-card p-5 sm:p-6">
            <div className="mb-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-text-3">Active goals</div>
            {active.map((goal) => <GoalCard key={goal.id} goal={goal} />)}
          </section>
          <aside className="py-card p-5 sm:p-6">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-accent-text">AI Goal Coach</div>
            <h2 className="m-0 mt-2 text-[20px] font-semibold tracking-tight text-text-1">What matters next</h2>
            <p className="mt-3 text-[14px] leading-relaxed text-text-2">Your savings goal has the strongest momentum. The side-business goal is the one most dependent on completing a specific next action.</p>
            <div className="mt-5 border-t border-border pt-4"><div className="text-[12px] font-semibold text-text-2">Recommended next action</div><div className="mt-1.5 text-[14px] font-medium leading-relaxed text-text-1">Finish and send the client proposal before adding another business task.</div></div>
          </aside>
        </div>
      )}

      {other.length > 0 && <section className="mt-6 py-card p-5 sm:p-6"><div className="mb-1 text-[13px] font-semibold text-text-2">Completed & paused</div>{other.map((goal) => <GoalCard key={goal.id} goal={goal} />)}</section>}
    </main>
  );
}
