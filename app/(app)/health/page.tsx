import Link from "next/link";
import { mockHealth } from "@/lib/mock-data";

const MEALS = [
  { title: "Chicken burrito bowl", meta: "620 kcal · 54g protein", time: "12:42 PM" },
  { title: "Protein oats + eggs", meta: "510 kcal · 43g protein", time: "8:10 AM" },
];

export default function HealthPage({ searchParams }: { searchParams?: { mealSaved?: string } }) {
  const sleepHours = Math.floor(mockHealth.sleepMinutes / 60);
  const sleepMins = mockHealth.sleepMinutes % 60;

  return (
    <main className="py-mobile-shell md:py-shell-narrow">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="py-eyebrow mb-1.5">Wednesday, Sep 9</div>
          <h1 className="py-title">Health</h1>
        </div>
        <Link href="/health/scan-meal" className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface text-[22px] text-text-1">+</Link>
      </header>

      {searchParams?.mealSaved === "1" && <div className="mb-4 rounded-[16px] border border-positive/30 bg-positive-soft px-4 py-3 text-[12.5px] font-semibold text-positive">Meal saved. Today’s nutrition has been updated.</div>}

      <section className="py-card p-[18px] sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="m-0 text-[21px] font-semibold text-text-1">Nutrition today</h2>
            <div className="mt-1 text-[12.5px] text-text-2">1,640 of 2,200 kcal</div>
          </div>
          <div className="text-[24px] font-bold text-accent-text">74%</div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {[
            ["Protein", "128g", "160g goal"],
            ["Carbs", "146g", "220g goal"],
            ["Fat", "48g", "70g goal"],
          ].map(([label, value, goal]) => (
            <div key={label} className="rounded-[14px] bg-[var(--surface-2)] p-3">
              <div className="text-[10.5px] font-semibold text-text-3">{label}</div>
              <div className="mt-1 text-[18px] font-bold text-text-1">{value}</div>
              <div className="mt-1 text-[10px] text-text-3">{goal}</div>
            </div>
          ))}
        </div>
      </section>

      <Link href="/health/scan-meal" className="mt-4 flex items-center gap-3 rounded-[18px] border border-accent/40 bg-accent-soft p-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[15px] bg-accent text-[24px] text-white">◎</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold text-text-1">Scan your meal</span>
          <span className="mt-0.5 block text-[12px] text-text-2">Take a photo and AI estimates macros</span>
        </span>
        <span className="text-[22px] text-text-3">›</span>
      </Link>

      <section className="mt-4 py-card px-4 pt-4">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="m-0 text-[19px] font-semibold text-text-1">Recent meals</h2>
          <span className="text-[12px] font-semibold text-accent-text">See all</span>
        </div>
        {MEALS.map((meal) => (
          <div key={meal.title} className="py-list-row">
            <span className="h-11 w-11 rounded-[14px] bg-[var(--surface-2)]" />
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-semibold text-text-1">{meal.title}</span>
              <span className="mt-0.5 block text-[11.5px] text-text-2">{meal.meta}</span>
            </span>
            <span className="text-[10.5px] text-text-3">{meal.time}</span>
          </div>
        ))}
      </section>

      <section className="mt-4 grid grid-cols-3 gap-2">
        <Metric label="Water" value="64 oz" sub="80 oz goal" />
        <Metric label="Steps" value={mockHealth.steps.toLocaleString()} sub="10k goal" />
        <Metric label="Sleep" value={`${sleepHours}h ${sleepMins}m`} sub="Good" positive />
      </section>

      <section className="mt-4 rounded-[18px] border border-border bg-[var(--surface-2)] p-4">
        <div className="flex gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-[12px] font-bold text-white">AI</span>
          <div>
            <div className="text-[12.5px] font-semibold text-text-1">Project You+ insight</div>
            <p className="m-0 mt-1 text-[12px] leading-relaxed text-text-2">Protein is pacing well. One high-protein dinner puts you near today&apos;s target. Recovery is {mockHealth.recoveryPct}%, so the planned workout still fits.</p>
          </div>
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value, sub, positive = false }: { label: string; value: string; sub: string; positive?: boolean }) {
  return (
    <div className="py-card p-3.5">
      <div className="text-[10.5px] font-semibold text-text-3">{label}</div>
      <div className="mt-1 text-[17px] font-bold text-text-1">{value}</div>
      <div className={`mt-1 text-[10px] ${positive ? "text-positive" : "text-text-3"}`}>{sub}</div>
    </div>
  );
}
