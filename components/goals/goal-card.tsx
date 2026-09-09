import Link from "next/link";
import type { Goal } from "@/lib/types";

const CATEGORY_LABEL: Record<Goal["category"], string> = {
  fitness: "Fitness",
  finance: "Finance",
  career: "Career",
  learning: "Learning",
  health: "Health",
  custom: "Personal",
};

export function GoalCard({ goal }: { goal: Goal }) {
  return (
    <Link href={`/goals/${goal.id}`} className="block border-t border-border py-5 first:border-t-0">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[12px] font-semibold uppercase tracking-wide text-text-3">
          {CATEGORY_LABEL[goal.category]}
        </span>
        {goal.deadline && (
          <span className="text-[12.5px] text-text-3">
            Due {new Date(goal.deadline).toLocaleDateString(undefined, { month: "short", year: "numeric" })}
          </span>
        )}
      </div>
      <h3 className="m-0 mb-3 text-[17px] font-semibold tracking-tight text-text-1">{goal.title}</h3>
      <div className="flex items-center gap-3">
        <div className="h-[6px] flex-1 overflow-hidden rounded-full bg-border">
          <div className="h-full rounded-full bg-accent" style={{ width: `${goal.progress}%` }} />
        </div>
        <span className="w-9 text-right text-[13px] font-semibold text-text-2">{goal.progress}%</span>
      </div>
    </Link>
  );
}
