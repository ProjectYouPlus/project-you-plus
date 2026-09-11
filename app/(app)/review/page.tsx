import Link from "next/link";
import { completeWeeklyReview } from "@/lib/actions/review";
import { getGoals } from "@/lib/data/goals";
import { getTasks } from "@/lib/data/tasks";
import { getHabits } from "@/lib/data/habits";
import { shiftDate, userDate, weekday } from "@/lib/health/schedule";
import { createClient } from "@/lib/supabase/server";

export default async function ReviewPage() {
  const [goals, tasks, habits] = await Promise.all([getGoals(), getTasks(), getHabits()]);
  const active = goals.filter((goal) => goal.status === "active");
  const done = tasks.filter((task) => task.completedAt);
  const open = tasks.filter((task) => !task.completedAt);
  const habitAvg = habits.length ? Math.round(habits.reduce((sum, habit) => sum + habit.consistencyPct, 0) / habits.length) : 0;
  const hasEnough = active.length > 0 || tasks.length > 0 || habits.length > 0;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = user ? await supabase.from("profiles").select("timezone").eq("id", user.id).maybeSingle() : { data: null };
  const today = userDate(new Date(), profile?.timezone ?? "UTC");
  const weekStart = shiftDate(today, -((weekday(today) + 6) % 7));
  const { data: completedReview } = user
    ? await supabase.from("weekly_reviews").select("id").eq("user_id", user.id).eq("week_start", weekStart).maybeSingle()
    : { data: null };

  return (
    <main className="py-mobile-shell md:py-shell-narrow">
      <header className="py-animate-in mb-7">
        <div className="py-eyebrow mb-1.5 text-accent-text">Weekly review</div>
        <h1 className="py-title">Learn from the week</h1>
        <p className="py-subtitle">A grounded review of what you actually tracked—never a fabricated performance story.</p>
      </header>

      {!hasEnough ? (
        <section className="py-glass-hero py-animate-in py-stagger-1 p-5">
          <div className="py-eyebrow text-[#C8AEFF]">Not enough history yet</div>
          <h2 className="m-0 mt-3 text-[25px] font-bold tracking-[-.04em] text-white">Use Project You+ for a few real actions first.</h2>
          <p className="m-0 mt-2 text-[13px] leading-relaxed text-[#C2BED0]">Once you have a goal, tasks and habit logs, this review becomes useful instead of generic.</p>
          <Link href="/today" className="py-liquid-button mt-5 w-full">Go to Today</Link>
        </section>
      ) : (
        <>
          <section className="py-animate-in py-stagger-1 grid grid-cols-3 gap-2.5">
            <Metric label="Goals" value={String(active.length)} sub="active" />
            <Metric label="Actions" value={`${done.length}/${tasks.length}`} sub="complete" />
            <Metric label="Habits" value={`${habitAvg}%`} sub="consistency" />
          </section>
          <section className="py-glass-soft py-animate-in py-stagger-2 mt-6 p-4">
            <div className="py-eyebrow text-accent-text">What went well</div>
            <p className="m-0 mt-2 text-[13px] leading-relaxed text-text-1">
              {done.length
                ? `You completed ${done.length} tracked action${done.length === 1 ? "" : "s"}. The strongest review question is whether those actions moved your active goals, not just whether they were checked off.`
                : "You created structure this week. The next win is converting that structure into completed, goal-linked actions."}
            </p>
          </section>
          <section className="py-glass-soft py-animate-in py-stagger-3 mt-3 p-4">
            <div className="py-eyebrow text-warn">Needs attention</div>
            <p className="m-0 mt-2 text-[13px] leading-relaxed text-text-1">
              {open.length
                ? `${open.length} action${open.length === 1 ? " remains" : "s remain"} open. Review any task that is urgent but not linked to a goal; it may be stealing attention from higher-impact work.`
                : "Your action list is clear. Protect the habits that keep your active goals moving."}
            </p>
          </section>
          {completedReview ? (
            <div className="py-glass-soft py-animate-in py-stagger-4 mt-5 p-4 text-center text-[13px] font-semibold text-success">
              Weekly Review completed
            </div>
          ) : (
            <form action={completeWeeklyReview} className="py-animate-in py-stagger-4 mt-5">
              <button type="submit" className="py-liquid-button w-full">Complete Weekly Review</button>
            </form>
          )}
          <Link href="/coach" className="mt-3 block text-center text-[13px] font-semibold text-accent-text">Plan next week with Coach</Link>
        </>
      )}
    </main>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="py-glass-soft p-3.5">
      <div className="py-eyebrow">{label}</div>
      <div className="mt-2 text-[22px] font-bold text-text-1">{value}</div>
      <div className="mt-1 text-[10px] text-text-3">{sub}</div>
    </div>
  );
}
