import Link from "next/link";
import { NavIcon } from "@/components/layout/nav-icon";
import { buildProjectYouContext } from "@/lib/ai/context";

const sections = [
  {
    href: "/goals",
    icon: "goals",
    title: "Goals",
    description: "Long-term direction and next milestones",
    meta: "4 active",
  },
  {
    href: "/tasks",
    icon: "tasks",
    title: "Tasks",
    description: "Priorities, smart defaults, and next actions",
    meta: "6 today",
  },
  {
    href: "/calendar",
    icon: "calendar",
    title: "Calendar",
    description: "Time blocks, commitments, and open capacity",
    meta: "1h 35m open",
  },
];

export default async function PlanPage() {
  const context = await buildProjectYouContext();
  const openTasks = context.tasks.filter((task) => !task.completedAt).length;
  const leadGoal = context.goals?.find((goal) => goal.status === "active");

  return (
    <main className="py-mobile-shell md:py-shell-narrow">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="py-eyebrow mb-1.5">Your week</div>
          <h1 className="py-title">Plan</h1>
          <p className="py-subtitle">Turn goals into time-protected action.</p>
        </div>
        <Link href="/tasks/new" className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface text-[22px] text-text-1">+</Link>
      </header>

      <section className="py-accent-card p-[18px] sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="py-eyebrow text-accent-text">Weekly capacity</div>
            <div className="mt-2 text-[30px] font-bold tracking-[-0.04em] text-text-1">7h 10m planned</div>
            <div className="mt-1 text-[13px] text-text-2">1h 35m open time remaining</div>
          </div>
          <span className="rounded-full bg-positive-soft px-3 py-1.5 text-[11px] font-semibold text-positive">Balanced</span>
        </div>
        <div className="mt-5 py-progress-track">
          <div className="py-progress-fill" style={{ width: "82%" }} />
        </div>
      </section>

      <section className="mt-4 rounded-[18px] border border-border bg-[var(--surface-2)] p-4">
        <div className="flex gap-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-[13px] font-bold text-white">AI</span>
          <div>
            <div className="text-[13px] font-semibold text-text-1">Best planning move</div>
            <p className="m-0 mt-1 text-[13px] leading-relaxed text-text-2">
              Protect your next open 90-minute block for {leadGoal?.title ?? "your highest-priority goal"}. You have {openTasks} open tasks, but only one needs deep focus.
            </p>
          </div>
        </div>
      </section>

      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="m-0 text-[20px] font-semibold tracking-[-0.025em] text-text-1">Plan your life</h2>
          <span className="text-[12px] text-text-3">AI connected</span>
        </div>
        <div className="space-y-3">
          {sections.map((section) => (
            <Link key={section.href} href={section.href} className="py-card flex items-center gap-4 p-4 transition active:scale-[.99]">
              <span className="py-icon-tile text-accent-text">
                <NavIcon name={section.icon} className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold text-text-1">{section.title}</span>
                <span className="mt-0.5 block text-[12.5px] leading-relaxed text-text-2">{section.description}</span>
              </span>
              <span className="text-right">
                <span className="block text-[11px] font-semibold text-accent-text">{section.meta}</span>
                <span className="mt-1 block text-[20px] leading-none text-text-3">›</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-6 py-card p-[18px]">
        <div className="flex items-center justify-between">
          <div>
            <div className="py-eyebrow">Next protected block</div>
            <div className="mt-1 text-[18px] font-semibold text-text-1">4:30 PM · Strength workout</div>
            <div className="mt-1 text-[12.5px] text-text-2">45 minutes · AI scheduled</div>
          </div>
          <Link href="/calendar" className="text-[13px] font-semibold text-accent-text">View</Link>
        </div>
      </section>
    </main>
  );
}
