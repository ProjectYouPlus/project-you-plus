import { ScoreRing } from "@/components/ui/score-ring";
import { Sparkline } from "@/components/ui/sparkline";
import { mockWeeklyTrend, mockMonthlyTrend } from "@/lib/mock-data";
import { buildProjectYouContext } from "@/lib/ai/context";

const DOMAIN_LABEL: Record<string, string> = {
  fitness: "Fitness",
  sleep: "Sleep",
  money: "Money",
  productivity: "Productivity",
  habits: "Habits",
  goals: "Goals",
  learning: "Learning",
};

export default async function ProgressPage() {
  const context = await buildProjectYouContext();
  const dailyScore = context.score.score;
  const entries = Object.entries(dailyScore.breakdown).sort((a, b) => b[1] - a[1]);
  const lowest = entries[entries.length - 1];
  const opportunityInsight = context.insights.find((i) => i.id === "score-opportunity")?.content;
  const monthlyTrend = [...mockMonthlyTrend.slice(0, -1), dailyScore.score];
  const weeklyTrend = [...mockWeeklyTrend.slice(0, -1), dailyScore.score];
  const startScore = monthlyTrend[0];
  const pointDelta = dailyScore.score - startScore;

  return (
    <main className="py-shell">
      <header className="mb-7">
        <div className="mb-2 text-[12px] font-semibold uppercase tracking-[0.16em] text-text-3">Performance</div>
        <h1 className="m-0 py-title">Your progress</h1>
        <p className="mt-2 max-w-[620px] text-[14px] leading-relaxed text-text-2">Your 1% Score is calculated from tracked behaviors and outcomes. AI interprets the score; it does not invent it.</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <section className="py-card p-6 sm:p-7">
          <div className="flex items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <ScoreRing score={dailyScore.score} />
              <div>
                <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-text-3">1% Score</div>
                <div className={`mt-1 text-[15px] font-semibold ${dailyScore.weeklyDeltaPct >= 0 ? "text-positive" : "text-warn"}`}>{dailyScore.weeklyDeltaPct >= 0 ? "↑" : "↓"} {Math.abs(dailyScore.weeklyDeltaPct)}% this week</div>
                <div className="mt-2 text-[13px] text-text-3">Personal best {dailyScore.personalBest}</div>
              </div>
            </div>
            <div className="hidden text-right sm:block">
              <div className="text-[12px] text-text-3">Strongest area</div>
              <div className="mt-1 text-[18px] font-bold text-text-1">{DOMAIN_LABEL[entries[0][0]]}</div>
              <div className="text-[13px] text-positive">{entries[0][1]} / 100</div>
            </div>
          </div>
          <div className="mt-7 rounded-xl bg-accent-soft p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-accent-text">Intelligence read</div>
            <p className="m-0 mt-1.5 text-[14px] leading-relaxed text-text-1">{opportunityInsight ?? `${DOMAIN_LABEL[lowest[0]]} is currently your clearest opportunity.`}</p>
          </div>
        </section>

        <section className="py-card p-6 sm:p-7">
          <div className="flex items-end justify-between">
            <div><div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-text-3">30-day trend</div><div className="mt-1 text-[24px] font-bold tracking-tight text-text-1">{startScore} → {dailyScore.score}</div></div>
            <div className={`text-[13px] font-semibold ${pointDelta >= 0 ? "text-positive" : "text-warn"}`}>{pointDelta >= 0 ? "+" : ""}{pointDelta} points</div>
          </div>
          <div className="mt-5"><Sparkline data={monthlyTrend} height={110} /></div>
          <div className="mt-3 flex justify-between text-[11px] text-text-3"><span>4 weeks ago</span><span>Today</span></div>
        </section>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.35fr_.65fr]">
        <section className="py-card p-6 sm:p-7">
          <div className="mb-5 flex items-center justify-between"><div><div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-text-3">Your life</div><h2 className="m-0 mt-1 text-[19px] font-semibold text-text-1">Category breakdown</h2></div><div className="hidden w-[140px] sm:block"><Sparkline data={weeklyTrend} height={38} /></div></div>
          <div className="grid gap-x-7 gap-y-5 sm:grid-cols-2">
            {entries.map(([key, value]) => (
              <div key={key} title={context.score.rationale[key]}>
                <div className="mb-2 flex items-center justify-between text-[14px]"><span className="font-medium text-text-1">{DOMAIN_LABEL[key] ?? key}</span><span className="font-bold text-text-2">{value}</span></div>
                <div className="h-[6px] overflow-hidden rounded-full bg-border"><div className="h-full rounded-full bg-accent" style={{ width: `${value}%` }} /></div>
                <div className="mt-1.5 text-[11px] leading-relaxed text-text-3">{context.score.rationale[key]}</div>
              </div>
            ))}
          </div>
        </section>

        <aside className="py-card p-6 sm:p-7">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-accent-text">Biggest opportunity</div>
          <div className="mt-2 text-[27px] font-bold tracking-tight text-text-1">{DOMAIN_LABEL[lowest[0]]}</div>
          <div className="mt-1 text-[14px] font-semibold text-warn">{lowest[1]} / 100</div>
          <p className="mt-4 text-[14px] leading-relaxed text-text-2">{context.score.rationale[lowest[0]]}</p>
          <div className="mt-5 border-t border-border pt-4"><div className="text-[12px] font-semibold text-text-2">Next action</div><div className="mt-1.5 text-[14px] font-medium leading-relaxed text-text-1">{context.insights.find((i) => i.id === "habit-gap")?.content ?? "Choose one small repeatable behavior that improves this category."}</div></div>
        </aside>
      </div>
    </main>
  );
}
