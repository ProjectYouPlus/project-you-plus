import type { AIInsight } from "@/lib/types";

export function AICoachCallout({ insight }: { insight: AIInsight }) {
  return (
    <div className="rounded-md bg-accent-soft p-[18px] pb-4">
      <div className="mb-[9px] flex items-center gap-1.5 text-[12px] font-semibold text-accent-text">
        <span className="h-[5px] w-[5px] rounded-full bg-accent-text" />
        AI Coach
      </div>
      <p className="m-0 text-[14.5px] leading-relaxed text-text-1">{insight.content}</p>
    </div>
  );
}
