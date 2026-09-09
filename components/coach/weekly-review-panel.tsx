"use client";

import { useState, useTransition, type ReactNode } from "react";
import type { WeeklyReviewData } from "@/lib/types";

export function WeeklyReviewPanel({ initialReview }: { initialReview: WeeklyReviewData }) {
  const [review, setReview] = useState(initialReview);
  const [built, setBuilt] = useState(false);
  const [mode, setMode] = useState<string>("local");
  const [isPending, startTransition] = useTransition();

  function refreshReview() {
    startTransition(() => {
      void (async () => {
        try {
          const response = await fetch("/api/weekly-review", { method: "POST" });
          if (!response.ok) throw new Error("Review request failed");
          const data = (await response.json()) as { review?: WeeklyReviewData; mode?: string };
          if (data.review) setReview(data.review);
          if (data.mode) setMode(data.mode);
        } catch {
          setMode("local-fallback");
        }
      })();
    });
  }

  return (
    <>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-3">{mode === "claude" ? "Claude review" : "Project You+ review"}</div>
        <button onClick={refreshReview} disabled={isPending} className="py-button-secondary min-h-0 px-3 py-2 text-[12px] disabled:opacity-50">{isPending ? "Analyzing…" : "Refresh intelligence"}</button>
      </div>

      <div className="grid grid-cols-2 gap-y-5 sm:grid-cols-4">
        <Stat label="1% Score" value={String(review.score)} />
        <Stat label="Weekly change" value={`${review.weeklyDeltaPct >= 0 ? "+" : ""}${review.weeklyDeltaPct}%`} tone={review.weeklyDeltaPct >= 0 ? "positive" : "warn"} />
        <Stat label="Tasks completed" value={review.tasksCompletedLabel} />
        <Stat label="Goals progressed" value={review.goalsProgressedLabel} />
        <Stat label="Habit consistency" value={`${review.habitConsistencyPct}%`} />
        <Stat label="Fitness" value={String(review.fitnessScore)} />
        <Stat label="Sleep" value={String(review.sleepScore)} tone={review.sleepScore < 75 ? "warn" : undefined} />
        <Stat label="Money" value={String(review.moneyScore)} />
      </div>

      <Section title="What went well"><p className="m-0 text-[15px] leading-relaxed text-text-1">{review.whatWentWell}</p></Section>
      <Section title="Needs attention"><p className="m-0 text-[15px] leading-relaxed text-text-1">{review.needsAttention}</p></Section>
      <Section title="Biggest opportunity"><div className="py-accent-card p-4"><p className="m-0 text-[14.5px] leading-relaxed text-text-1">{review.biggestOpportunity}</p></div></Section>
      <Section title="Next week's plan"><ul className="m-0 flex list-none flex-col gap-2 p-0">{review.nextWeekPlan.map((item, i) => <li key={i} className="flex gap-2.5 text-[14.5px] text-text-1"><span className="mt-2 h-1 w-1 flex-shrink-0 rounded-full bg-text-3" />{item}</li>)}</ul></Section>

      <button onClick={() => setBuilt(true)} disabled={built} className="py-button-primary mt-8 w-full disabled:opacity-60">{built ? "Next week is staged for planning" : "Build my week"}</button>
      <p className="mb-0 mt-3 text-center text-[11px] text-text-3">External calendar changes will remain off until you connect and authorize a calendar provider.</p>
    </>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "positive" | "warn" }) {
  const color = tone === "positive" ? "var(--positive)" : tone === "warn" ? "var(--warn)" : "var(--text-1)";
  return <div><div className="mb-1 text-[12px] text-text-2">{label}</div><div className="text-[17px] font-bold tracking-tight" style={{ color }}>{value}</div></div>;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <div className="border-t border-border py-5"><div className="mb-2.5 text-[13px] font-semibold text-text-2">{title}</div>{children}</div>;
}
