import Link from "next/link";
import { NavIcon } from "@/components/layout/nav-icon";
import { buildProjectYouContext } from "@/lib/ai/context";
import { mockHabits, mockHealth, mockMoney } from "@/lib/mock-data";

const core = [
  { href: "/health", icon: "health", title: "Health", value: "74", sub: "Nutrition, sleep, recovery" },
  { href: "/fitness", icon: "fitness", title: "Fitness", value: "84", sub: "Training and progression" },
  { href: "/money", icon: "money", title: "Money", value: "79", sub: "Cash flow and investments" },
  { href: "/habits", icon: "habits", title: "Habits", value: "90", sub: "Consistency and streaks" },
];

const more = [
  { href: "/progress", icon: "progress", title: "Progress", sub: "Your cross-life trend" },
  { href: "/review", icon: "review", title: "Weekly Review", sub: "Reflect, learn, reset" },
  { href: "/integrations", icon: "integrations", title: "Integrations", sub: "Health, calendar, accounts" },
  { href: "/settings", icon: "settings", title: "Settings", sub: "Preferences and privacy" },
];

export default async function YouPage() {
  const context = await buildProjectYouContext();
  const name = (context.profile.fullName ?? "You").split(" ")[0];
  const dailyScore = context.score.score;
  const habitAverage = Math.round(mockHabits.reduce((sum, habit) => sum + habit.consistencyPct, 0) / mockHabits.length);

  return (
    <main className="py-mobile-shell md:py-shell-narrow">
      <header className="mb-6 flex items-center justify-between gap-4">
        <div>
          <div className="py-eyebrow mb-1.5">Your system</div>
          <h1 className="py-title">{name}</h1>
          <p className="py-subtitle">Everything that makes you better, connected.</p>
        </div>
        <Link href="/profile" className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-[var(--surface-2)] text-[13px] font-bold text-text-1">
          {name.slice(0, 2).toUpperCase()}
        </Link>
      </header>

      <section className="py-accent-card p-[18px] sm:p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="py-eyebrow text-accent-text">Project You+ score</div>
            <div className="mt-1 text-[42px] font-bold tracking-[-0.05em] text-text-1">{dailyScore.score}</div>
            <div className="text-[13px] font-semibold text-positive">↑ {dailyScore.weeklyDeltaPct}% this week</div>
          </div>
          <div className="text-right">
            <div className="text-[12px] text-text-3">Momentum</div>
            <div className="mt-1 text-[17px] font-semibold text-text-1">Strong</div>
            <Link href="/progress" className="mt-2 inline-block text-[12px] font-semibold text-accent-text">View progress →</Link>
          </div>
        </div>
      </section>

      <section className="mt-5 grid grid-cols-2 gap-3">
        {core.map((item) => (
          <Link key={item.href} href={item.href} className="py-card min-h-[132px] p-4 transition active:scale-[.99]">
            <div className="flex items-start justify-between">
              <span className="py-icon-tile text-accent-text"><NavIcon name={item.icon} className="h-5 w-5" /></span>
              <span className="text-[21px] font-bold tracking-tight text-text-1">{item.value}</span>
            </div>
            <div className="mt-3 text-[15px] font-semibold text-text-1">{item.title}</div>
            <div className="mt-1 text-[11.5px] leading-relaxed text-text-2">{item.sub}</div>
          </Link>
        ))}
      </section>

      <section className="mt-5 rounded-[18px] border border-border bg-[var(--surface-2)] p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-[12px] font-bold text-white">AI</span>
          <div>
            <div className="text-[13px] font-semibold text-text-1">What matters most right now</div>
            <p className="m-0 mt-1 text-[12.5px] leading-relaxed text-text-2">
              Recovery is {mockHealth.recoveryPct}%, habit consistency is {habitAverage}%, and your weekly budget is {mockMoney.weeklyBudgetPctUsed}% used. Sleep is still the clearest lever for improving the whole system.
            </p>
          </div>
        </div>
      </section>

      <section className="mt-6 py-card px-4">
        {more.map((item) => (
          <Link key={item.href} href={item.href} className="py-list-row">
            <span className="py-icon-tile"><NavIcon name={item.icon} className="h-[18px] w-[18px]" /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-semibold text-text-1">{item.title}</span>
              <span className="mt-0.5 block text-[12px] text-text-2">{item.sub}</span>
            </span>
            <span className="text-[20px] text-text-3">›</span>
          </Link>
        ))}
      </section>
    </main>
  );
}
