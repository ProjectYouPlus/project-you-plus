import { cn } from "@/lib/utils";

export interface TimelineRow {
  time: string;
  title: string;
  sub?: string;
  isCurrent?: boolean;
}

export function ScheduleTimeline({ rows }: { rows: TimelineRow[] }) {
  return (
    <div>
      {rows.map((row, i) => (
        <div key={i} className="flex gap-3.5 py-2.5">
          <div className="w-[54px] flex-shrink-0 pt-[1px] text-[12.5px] text-text-3">{row.time}</div>
          <div className={cn("w-[2px] flex-shrink-0 rounded-full bg-border", row.isCurrent && "bg-accent")} />
          <div className="pb-0.5">
            <div className="text-[14.5px] font-medium text-text-1">{row.title}</div>
            {row.sub && <div className="mt-[1px] text-[12.5px] text-text-3">{row.sub}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}
