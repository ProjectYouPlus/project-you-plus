"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { ScheduleTimeline } from "./schedule-timeline";
import type { RunMyDayPlan } from "@/lib/types";

interface RunMyDaySheetProps {
  plan: RunMyDayPlan;
  onAccept?: () => void;
}

export function RunMyDaySheet({ plan: initialPlan, onAccept }: RunMyDaySheetProps) {
  const [open, setOpen] = useState(false);
  const [plan, setPlan] = useState(initialPlan);
  const [mode, setMode] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function generate() {
    startTransition(() => {
      void (async () => {
        try {
          const response = await fetch("/api/run-my-day", { method: "POST" });
          if (!response.ok) throw new Error("Unable to generate plan");
          const data = (await response.json()) as { plan?: RunMyDayPlan; mode?: string };
          if (data.plan) setPlan(data.plan);
          setMode(data.mode ?? null);
        } catch {
          setMode("local-fallback");
        }
      })();
    });
  }

  function openAndGenerate() {
    setOpen(true);
    generate();
  }

  return (
    <>
      <button
        onClick={openAndGenerate}
        className="py-button-primary mt-4 w-full gap-2"
      >
        <svg viewBox="0 0 24 24" className="h-[15px] w-[15px]" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
        </svg>
        Run My Day
      </button>

      <div
        className={cn(
          "fixed inset-0 z-50 flex items-end justify-center bg-black/40 transition-opacity",
          open ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={(e) => e.target === e.currentTarget && setOpen(false)}
      >
        <div
          className={cn(
            "max-h-[84vh] w-full max-w-[560px] overflow-y-auto rounded-t-[26px] border border-border bg-surface px-6 pb-8 pt-2.5 shadow-[0_-24px_70px_rgba(0,0,0,.35)] transition-transform duration-300",
            open ? "translate-y-0" : "translate-y-full"
          )}
        >
          <div className="mx-auto mb-[18px] mt-2 h-1 w-9 rounded-full bg-border" />

          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="m-0 mb-1 text-[19px] font-bold tracking-tight text-text-1">Your optimized day</h3>
              <p className="m-0 text-[13.5px] text-text-2">Built from your priorities, calendar, score, habits, health, and money context</p>
            </div>
            {mode && <span className="whitespace-nowrap rounded-full border border-border px-2 py-1 text-[10.5px] font-semibold text-text-3">{mode === "claude" ? "AI generated" : "Local plan"}</span>}
          </div>

          <div className="my-4 py-accent-card p-4 text-[13.5px] leading-relaxed text-text-1">
            {isPending ? "Analyzing today's context and rebuilding your plan…" : plan.explanation}
          </div>

          {!isPending && <ScheduleTimeline rows={plan.items.map((item) => ({ time: item.time, title: item.title, sub: item.note }))} />}

          <div className="mt-5 flex gap-2.5">
            <button
              onClick={generate}
              disabled={isPending}
              className="py-button-secondary flex-1 disabled:opacity-50"
            >
              {isPending ? "Generating…" : "Regenerate"}
            </button>
            <button
              onClick={() => {
                onAccept?.();
                setOpen(false);
              }}
              disabled={isPending}
              className="py-button-primary flex-1 disabled:opacity-50"
            >
              Accept plan
            </button>
          </div>
          <p className="mb-0 mt-3 text-center text-[11px] text-text-3">Accepting does not write to an external calendar until a calendar integration is connected.</p>
        </div>
      </div>
    </>
  );
}
