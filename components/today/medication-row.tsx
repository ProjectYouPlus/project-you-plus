"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export function MedicationRow({ name, schedule }: { name: string; schedule: string }) {
  const [taken, setTaken] = useState(false);

  return (
    <div className="flex items-center justify-between rounded-md border border-border px-4 py-3.5">
      <div>
        <div className="text-[14.5px] font-medium text-text-1">{name}</div>
        <div className="mt-0.5 text-[12.5px] text-text-3">{schedule}</div>
      </div>
      <button
        onClick={() => setTaken((t) => !t)}
        className={cn(
          "rounded-sm px-3.5 py-2 text-[13px] font-semibold transition-colors",
          taken ? "bg-positive-soft text-positive" : "bg-text-1 text-bg"
        )}
      >
        {taken ? "Taken ✓" : "Mark taken"}
      </button>
    </div>
  );
}
