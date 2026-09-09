import Link from "next/link";
import { buildProjectYouContext } from "@/lib/ai/context";
import { PriorityList } from "@/components/today/priority-list";
import { ScheduleTimeline } from "@/components/today/schedule-timeline";
import { ScoreRing } from "@/components/ui/score-ring";

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

export default async function TodayPage() {
  const context = await buildProjectYouContext();
  const { profile, tasks, schedule, insights, habits } = context;
  const firstName = (profile.fullName ?? "there").split(" ")[0];
  const dailyScore = context.score.score;
  const openTasks = tasks.filter((task) => !task.completedAt);
  const focusTasks = openTasks.slice(0, 3);
  const leadInsight = insights[0]?.content ?? "Protect your best focus window for the one action that most directly advances your top goal.";
  const habitStreak = Math.max(5, ...habits.map((habit) => habit.streakDays));

  const scheduleRows = schedule.map((event) => ({
    time: new Date(event.startAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
    title: event.title,
    sub: event.location ?? undefined,
    isCurrent: event.isCurrent,
  }));

  return (
    <main className="py-mobile-shell md:py-shell">
      <header className="mb-[18px] flex items-center justify-between gap-4">
        <div>
          <div className="text-[13px] font-medium text-text-2">Good morning</div>
          <h1 className="m-0 mt-0.5 text-[29px] font-bold tracking-[-0.04em] text-text-1">{firstName}</h1>
        </div>
        <Link href="/profile" className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-[var(--surface-2)] text-[12px] font-bold text-text-1">
          {firstName.slice(0, 2).toUpperCase()}
        </Link>
      </header>

      <section className="py-accent-card p-[18px] sm:p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="py-eyebrow text-accent-text">Today&apos;s score</div>
            <div className="mt-1 text-[42px] font-bold tracking-[-0.05em] text-text-1">{dailyScore.score}</div>
            <div className="mt-0.5 text-[12.5px] text-text-2">Ahead of your weekly pace</div>
          </div>
          <ScoreRing score={dailyScore.score} size={78} />
        </div>
        <div className="mt-4 py-progress-track">
          <div className="py-progress-fill" style={{ width: `${Math.min(100, dailyScore.score)}%` }} />
        </div>
      </section>

      <section className="mt-4 py-card p-[18px]">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="m-0 text-[20px] font-semibold tracking-[-0.025em] text-text-1">Today&apos;s focus</h2>
          <span className="rounded-full bg-accent-soft px-2.5 py-1 text-[11px] font-semibold text-accent-text">{openTasks.length} left</span>
        </div>
        <PriorityList tasks={focusTasks} />
        <Link href="/tasks" className="mt-2 inline-block text-[12.5px] font-semibold text-accent-text">View all tasks →</Link>
      </section>

      <section className="mt-4 grid grid-cols-2 gap-3">
        <Link href="/health" className="py-card p-4">
          <div className="py-eyebrow">Health</div>
          <div className="mt-2 text-[27px] font-bold tracking-[-0.035em] text-text-1">1,640</div>
          <div className="mt-0.5 text-[11.5px] text-text-2">kcal today</div>
          <div className="mt-2 text-[11.5px] font-semibold text-positive">+12% protein pace</div>
        </Link>
        <Link href="/money" className="py-card p-4">
          <div className="py-eyebrow">Money</div>
          <div className="mt-2 text-[27px] font-bold tracking-[-0.035em] text-text-1">$4.8k</div>
          <div className="mt-0.5 text-[11.5px] text-text-2">monthly cash flow</div>
          <div className="mt-2 text-[11.5px] font-semibold text-positive">On track</div>
        </Link>
      </section>

      <section className="mt-4 py-card p-[18px]">
        <div className="flex items-center justify-between gap-3">
          <h2 className="m-0 text-[20px] font-semibold tracking-[-0.025em] text-text-1">Habits</h2>
          <span className="text-[12px] font-semibold text-warn">{habitStreak} day streak</span>
        </div>
        <div className="mt-4 grid grid-cols-7 gap-2">
          {DAY_LABELS.map((day, index) => (
            <div key={`${day}-${index}`} className={`flex h-9 items-center justify-center rounded-[12px] text-[12px] font-semibold ${index < 5 ? "bg-accent text-white" : "bg-[var(--surface-2)] text-text-2"}`}>
              {day}
            </div>
          ))}
        </div>
      </section>

      <Link href="/coach" className="mt-4 flex items-center gap-3 rounded-[18px] border border-border bg-[var(--surface-2)] p-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-[12px] font-bold text-white">AI</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-semibold text-text-1">AI Coach</span>
          <span className="mt-0.5 block text-[12.5px] leading-relaxed text-text-2">{leadInsight}</span>
        </span>
        <span className="text-[22px] text-text-3">›</span>
      </Link>

      <section className="mt-6 py-card p-[18px]">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="py-eyebrow">Today</div>
            <h2 className="py-section-title">Schedule</h2>
          </div>
          <Link href="/calendar" className="text-[12.5px] font-semibold text-accent-text">Calendar</Link>
        </div>
        <ScheduleTimeline rows={scheduleRows} />
      </section>
    </main>
  );
}
