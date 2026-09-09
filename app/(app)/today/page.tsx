import Link from "next/link";
import { getProfile } from "@/lib/data/profile";
import { getGoals } from "@/lib/data/goals";
import { getTasks } from "@/lib/data/tasks";
import { getHabits } from "@/lib/data/habits";
import { createClient } from "@/lib/supabase/server";
import type { Goal, Task } from "@/lib/types";

const tierWeight: Record<Task["tier"], number> = { critical: 30, important: 20, optional: 10 };

function taskScore(task: Task, activeGoalIds: Set<string>) {
  let score = tierWeight[task.tier];
  if (task.goalId && activeGoalIds.has(task.goalId)) score += 100;
  if (task.dueAt) {
    const hours = (new Date(task.dueAt).getTime() - Date.now()) / 36e5;
    if (hours <= 0) score += 45;
    else if (hours <= 24) score += 30;
    else if (hours <= 72) score += 15;
  }
  return score;
}

function dueLabel(dueAt: string | null) {
  if (!dueAt) return "Flexible";
  const date = new Date(dueAt);
  const diffDays = Math.ceil((date.getTime() - Date.now()) / 86400000);
  if (diffDays <= 0) return "Due today";
  if (diffDays === 1) return "Due tomorrow";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default async function TodayPage() {
  const [profile, goals, tasks, habits, signals] = await Promise.all([
    getProfile(),
    getGoals(),
    getTasks(),
    getHabits(),
    getSetupSignals(),
  ]);

  const firstName = (profile.fullName ?? "there").split(" ")[0];
  const activeGoals = goals.filter((goal) => goal.status === "active");
  const activeGoalIds = new Set(activeGoals.map((goal) => goal.id));
  const goalById = new Map(activeGoals.map((goal) => [goal.id, goal]));
  const openTasks = tasks
    .filter((task) => !task.completedAt)
    .sort((a, b) => taskScore(b, activeGoalIds) - taskScore(a, activeGoalIds));
  const topMoves = openTasks.slice(0, 3);
  const bestTask = topMoves[0];
  const prioritizedHabits = [...habits]
    .sort((a, b) => Number(Boolean(b.goalId)) - Number(Boolean(a.goalId)) || a.consistencyPct - b.consistencyPct)
    .slice(0, 3);

  const setupItems = [
    { label: "Define a meaningful goal", href: "/goals/new", done: activeGoals.length > 0 },
    { label: "Add a next action", href: "/tasks/new", done: tasks.length > 0 },
    { label: "Create a supporting habit", href: "/habits", done: habits.length > 0 },
    { label: "Add health context", href: "/health", done: signals.health },
    { label: "Build your money picture", href: "/money", done: signals.money },
    { label: "Put something on your calendar", href: "/calendar", done: signals.calendar },
  ];
  const setupDone = setupItems.filter((item) => item.done).length;
  const setupPercent = Math.round((setupDone / setupItems.length) * 100);

  return (
    <main className="py-mobile-shell md:py-shell-narrow">
      <header className="py-animate-in mb-7 flex items-center justify-between gap-4">
        <div>
          <div className="text-[13px] font-medium text-text-2">{greeting()}</div>
          <h1 className="m-0 mt-0.5 text-[32px] font-bold tracking-[-0.045em] text-text-1">{firstName}</h1>
          <div className="mt-1 text-[12px] text-text-3">{new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</div>
        </div>
        <Link href="/profile" className="py-glass flex h-11 w-11 items-center justify-center rounded-full text-[12px] font-bold text-text-1">
          {firstName.slice(0, 2).toUpperCase()}
        </Link>
      </header>

      {setupPercent < 100 && (
        <section className="py-glass-soft py-animate-in py-stagger-1 mb-4 p-[18px]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="py-eyebrow text-accent-text">Make Project You+ yours</div>
              <h2 className="m-0 mt-1.5 text-[20px] font-semibold tracking-[-0.025em] text-text-1">Your setup is {setupPercent}% complete</h2>
              <p className="m-0 mt-1.5 max-w-[340px] text-[12.5px] leading-relaxed text-text-2">The more real context you add, the better Project You+ can prioritize your day.</p>
            </div>
            <span className="py-glass-pill text-accent-text">{setupDone}/{setupItems.length}</span>
          </div>
          <div className="mt-4 py-progress-track"><div className="py-progress-fill" style={{ width: `${setupPercent}%` }} /></div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {setupItems.filter((item) => !item.done).slice(0, 4).map((item) => (
              <Link key={item.label} href={item.href} className="py-pressable flex items-center gap-2 rounded-[14px] border border-white/5 bg-white/[.025] px-3 py-2.5 text-[12px] font-medium text-text-2">
                <span className="h-2 w-2 rounded-full border border-accent" />
                <span>{item.label}</span>
                <span className="ml-auto text-text-3">›</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="py-glass-hero py-animate-in py-stagger-2 p-5 sm:p-6">
        <div className="flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[.15em] text-[#C8AEFF]">
          <span className="py-pulse-dot h-2 w-2 rounded-full bg-accent-2" />
          Next best action
        </div>
        {bestTask ? (
          <>
            <h2 className="m-0 mt-4 max-w-[410px] text-[27px] font-bold leading-[1.08] tracking-[-0.04em] text-white">{bestTask.title}</h2>
            <p className="m-0 mt-2 text-[13px] leading-relaxed text-[#C2BED0]">
              {bestTask.goalId && goalById.get(bestTask.goalId)
                ? <>Moves <span className="font-semibold text-white">{goalById.get(bestTask.goalId)?.title}</span> forward.</>
                : "This is the highest-impact open action in your current plan."}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="py-glass-pill capitalize text-white">{bestTask.tier}</span>
              <span className="py-glass-pill">{dueLabel(bestTask.dueAt)}</span>
              {bestTask.goalId && <span className="py-glass-pill text-[#C8AEFF]">Goal-linked</span>}
            </div>
            <div className="mt-5 flex gap-2.5">
              <Link href="/tasks" className="py-liquid-button flex-1">Open task</Link>
              <Link href="/coach" className="py-glass flex min-h-[46px] items-center justify-center rounded-[16px] px-4 text-[13px] font-semibold text-white">Ask Coach</Link>
            </div>
          </>
        ) : activeGoals[0] ? (
          <>
            <h2 className="m-0 mt-4 text-[27px] font-bold tracking-[-0.04em] text-white">Give {activeGoals[0].title} a next move.</h2>
            <p className="m-0 mt-2 text-[13px] leading-relaxed text-[#C2BED0]">Your goal is clear. Add one concrete action so Today can start prioritizing for you.</p>
            <Link href="/tasks/new" className="py-liquid-button mt-5 w-full">Create next action</Link>
          </>
        ) : (
          <>
            <h2 className="m-0 mt-4 text-[27px] font-bold tracking-[-0.04em] text-white">Give Project You+ something worth optimizing.</h2>
            <p className="m-0 mt-2 text-[13px] leading-relaxed text-[#C2BED0]">Start with one real goal. We’ll turn it into actions, habits, and visible momentum.</p>
            <Link href="/goals/new" className="py-liquid-button mt-5 w-full">Create your first goal</Link>
          </>
        )}
      </section>

      <section className="py-animate-in py-stagger-3 mt-7">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div><div className="py-eyebrow">Execution</div><h2 className="m-0 mt-1 text-[22px] font-semibold tracking-[-0.03em] text-text-1">Your 3 moves</h2></div>
          <Link href="/tasks" className="text-[12px] font-semibold text-accent-text">All tasks</Link>
        </div>
        {topMoves.length ? (
          <div className="py-glass-soft divide-y divide-white/[.06] px-4">
            {topMoves.map((task, index) => {
              const goal = task.goalId ? goalById.get(task.goalId) : undefined;
              return (
                <Link key={task.id} href="/tasks" className="py-pressable flex items-center gap-3 py-4">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[.035] text-[11px] font-bold text-text-2">0{index + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14.5px] font-semibold text-text-1">{task.title}</span>
                    <span className="mt-0.5 block truncate text-[11.5px] text-text-3">{goal ? `→ ${goal.title}` : "Unlinked action"}</span>
                  </span>
                  <span className="text-[11px] font-medium text-text-3">{dueLabel(task.dueAt)}</span>
                </Link>
              );
            })}
          </div>
        ) : (
          <EmptyRow href="/tasks/new" title="No actions yet" sub="Add one concrete next step and Project You+ will rank it here." cta="Add action" />
        )}
      </section>

      <section className="py-animate-in py-stagger-4 mt-7">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div><div className="py-eyebrow">Consistency</div><h2 className="m-0 mt-1 text-[22px] font-semibold tracking-[-0.03em] text-text-1">Habits supporting your goals</h2></div>
          <Link href="/habits" className="text-[12px] font-semibold text-accent-text">Habits</Link>
        </div>
        {prioritizedHabits.length ? (
          <div className="grid gap-2.5">
            {prioritizedHabits.map((habit) => {
              const goal = habit.goalId ? goalById.get(habit.goalId) : undefined;
              return (
                <Link key={habit.id} href="/habits" className="py-glass-soft py-pressable flex items-center gap-3 p-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-accent-soft text-[12px] font-bold text-accent-text">{habit.streakDays}d</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-semibold text-text-1">{habit.title}</span>
                    <span className="mt-0.5 block truncate text-[11.5px] text-text-3">{goal ? `Supports ${goal.title}` : "Link this habit to a goal for smarter prioritization"}</span>
                  </span>
                  <span className="text-[12px] font-semibold text-text-2">{habit.consistencyPct}%</span>
                </Link>
              );
            })}
          </div>
        ) : (
          <EmptyRow href="/habits" title="Build the behavior behind the goal" sub="Create a habit and link it to the outcome it supports." cta="Create habit" />
        )}
      </section>

      <section className="py-animate-in py-stagger-5 mt-7">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div><div className="py-eyebrow">Direction</div><h2 className="m-0 mt-1 text-[22px] font-semibold tracking-[-0.03em] text-text-1">Goal momentum</h2></div>
          <Link href="/goals" className="text-[12px] font-semibold text-accent-text">Goals</Link>
        </div>
        {activeGoals.length ? (
          <div className="py-glass-soft divide-y divide-white/[.06] px-4">
            {activeGoals.slice(0, 3).map((goal) => {
              const goalTasks = openTasks.filter((task) => task.goalId === goal.id).length;
              const goalHabits = habits.filter((habit) => habit.goalId === goal.id).length;
              return (
                <Link key={goal.id} href={`/goals/${goal.id}`} className="py-pressable block py-4">
                  <div className="flex items-center justify-between gap-4"><span className="truncate text-[14px] font-semibold text-text-1">{goal.title}</span><span className="text-[12px] font-bold text-accent-text">{goal.progress}%</span></div>
                  <div className="mt-2.5 py-progress-track"><div className="py-progress-fill" style={{ width: `${goal.progress}%` }} /></div>
                  <div className="mt-2 text-[10.5px] text-text-3">{goalTasks} open action{goalTasks === 1 ? "" : "s"} · {goalHabits} supporting habit{goalHabits === 1 ? "" : "s"}</div>
                </Link>
              );
            })}
          </div>
        ) : (
          <EmptyRow href="/goals/new" title="No active goals yet" sub="Goals give your tasks and habits a reason to exist." cta="Add goal" />
        )}
      </section>

      <Link href="/coach" className="py-glass-soft py-pressable mt-7 flex items-center gap-3 p-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[15px] bg-accent text-[11px] font-bold text-white">AI</span>
        <span className="min-w-0 flex-1"><span className="block text-[13px] font-semibold text-text-1">Coach read</span><span className="mt-0.5 block text-[12px] leading-relaxed text-text-2">{coachRead(bestTask, activeGoals, habits)}</span></span>
        <span className="text-[22px] text-text-3">›</span>
      </Link>
    </main>
  );
}

async function getSetupSignals() {
  const supabase = await createClient();
  const [{ count: health }, { count: money }, { count: calendar }] = await Promise.all([
    supabase.from("health_metrics").select("id", { count: "exact", head: true }),
    supabase.from("finance_accounts").select("id", { count: "exact", head: true }),
    supabase.from("calendar_events").select("id", { count: "exact", head: true }),
  ]);
  return { health: (health ?? 0) > 0, money: (money ?? 0) > 0, calendar: (calendar ?? 0) > 0 };
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function coachRead(bestTask: Task | undefined, goals: Goal[], habits: { goalId?: string | null }[]) {
  if (!goals.length) return "Create one meaningful goal first. Everything else becomes easier to prioritize once the destination is clear.";
  if (!bestTask) return `Your clearest gap is execution. Add one next action for ${goals[0].title}.`;
  const linkedHabits = habits.filter((habit) => habit.goalId === bestTask.goalId).length;
  if (bestTask.goalId && linkedHabits === 0) return "Your top action is linked to a goal, but that goal has no supporting habit yet. Add one repeatable behavior to protect momentum.";
  return `Start with “${bestTask.title}.” It is currently the strongest combination of goal alignment, urgency, and priority.`;
}

function EmptyRow({ href, title, sub, cta }: { href: string; title: string; sub: string; cta: string }) {
  return (
    <Link href={href} className="py-glass-soft py-pressable flex items-center gap-3 p-4">
      <span className="py-empty-icon">+</span>
      <span className="min-w-0 flex-1"><span className="block text-[14px] font-semibold text-text-1">{title}</span><span className="mt-0.5 block text-[11.5px] leading-relaxed text-text-3">{sub}</span></span>
      <span className="text-[11.5px] font-semibold text-accent-text">{cta}</span>
    </Link>
  );
}
