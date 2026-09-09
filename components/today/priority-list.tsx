"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import type { Task } from "@/lib/types";
import { toggleTaskComplete } from "@/lib/actions/tasks";

const tierStyles: Record<Task["tier"], string> = {
  critical: "bg-danger/10 text-danger",
  important: "bg-warn-soft text-warn",
  optional: "bg-border text-text-2",
};

interface PriorityListProps {
  tasks: Task[];
}

export function PriorityList({ tasks }: PriorityListProps) {
  // Optimistic local state; the real completion write happens in onToggle.
  const [completedIds, setCompletedIds] = useState(
    new Set(tasks.filter((t) => t.completedAt).map((t) => t.id))
  );

  const [, startTransition] = useTransition();

  function toggle(task: Task) {
    const next = new Set(completedIds);
    const willBeCompleted = !next.has(task.id);
    willBeCompleted ? next.add(task.id) : next.delete(task.id);
    setCompletedIds(next);
    startTransition(() => {
      void toggleTaskComplete(task.id, willBeCompleted);
    });
  }

  return (
    <div>
      {tasks.map((task) => {
        const done = completedIds.has(task.id);
        return (
          <div
            key={task.id}
            onClick={() => toggle(task)}
            className="flex items-start gap-3 py-[11px] first:pt-0 cursor-pointer"
          >
            {done || task.tier === "optional" ? (
              <span
                className={cn(
                  "mt-[1px] flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-[6px] border-[1.5px] border-border transition-colors",
                  done && "border-accent bg-accent"
                )}
              >
                {done && (
                  <svg viewBox="0 0 24 24" className="h-3 w-3 stroke-white" fill="none" strokeWidth={3}>
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                )}
              </span>
            ) : (
              <span className={cn("mt-[1px] flex-shrink-0 rounded-[5px] px-[7px] py-[2px] text-[11px] font-semibold", tierStyles[task.tier])}>
                {task.tier[0].toUpperCase() + task.tier.slice(1)}
              </span>
            )}
            <div>
              <div className={cn("text-[15px] font-medium leading-snug", done && "text-text-3 line-through")}>
                {task.title}
              </div>
              {task.meta && <div className="mt-[2px] text-[12.5px] text-text-3">{task.meta}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
