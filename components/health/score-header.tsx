import type { HealthOverview } from "@/lib/data/health";
export function HealthScoreHeader({ overview }: { overview: HealthOverview }) {
  const { score, training, nutrition, supplements, metrics } = overview;
  return (
    <header className="py-glass-hero p-4 sm:p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="m-0 text-xs text-text-3">Your health today</p>
          <h1 className="m-0 mt-1 text-3xl font-semibold tracking-tight">
            Health Score
          </h1>
        </div>
        <div
          className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full"
          style={{
            background: `conic-gradient(var(--accent) ${(score.overall ?? 0) * 3.6}deg,var(--surface-3) 0deg)`,
          }}
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-surface text-3xl font-semibold">
            {score.overall ?? "—"}
          </span>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-4 gap-1.5">
        {[
          ["Training", score.training],
          ["Diet", score.diet],
          ["Supplements", score.supplements],
          ["Consistency", score.consistency],
        ].map(([label, value]) => (
          <div
            key={label}
            className="min-w-0 rounded-xl border border-border bg-surface/40 px-1 py-2 text-center"
          >
            <div className="text-base font-semibold">{value ?? "—"}</div>
            <div className="text-[9px] text-text-3">{label}</div>
          </div>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-text-2">
        <a href="#training">
          {training.todayWorkout
            ? `${training.todayWorkout.title} · ${training.status.replaceAll("_", " ")}`
            : training.activePlan
              ? "Recovery day"
              : "Set up a workout plan"}
        </a>
        <a href="#diet">
          {nutrition.meals.length} meals · {nutrition.totals.calories} kcal
        </a>
        <a href="#supplements">
          {supplements.filter((x) => x.due && !x.done).length} supplements
          remaining
        </a>
        <a href="#recovery">
          {metrics.length
            ? "Recovery signals available"
            : "Recovery data optional"}
        </a>
      </div>
      <details className="mt-4 border-t border-border pt-3">
        <summary className="cursor-pointer text-xs font-semibold text-accent-text">
          What affects my score?
        </summary>
        <p className="text-xs text-text-3">
          Last 7 local days. Training 35%, Diet 30%, Supplements 20%,
          Consistency 15%. Missing domains are excluded and remaining weights
          are normalized.
          Diet measures days with meals logged, not dietary quality. Consistency is the average of the available completion rates.
        </p>
        <ul className="space-y-2 pl-4 text-xs text-text-2">
          {score.factors.map((factor) => (
            <li key={factor.id}>
              {factor.status === "positive" ? "✓ " : ""}
              {factor.label}
            </li>
          ))}
        </ul>
      </details>
    </header>
  );
}
