import { cn } from "@/lib/utils";

export interface StatItem {
  label: string;
  value: string;
  tone?: "default" | "warn" | "positive";
  progressPct?: number;
}

const toneText: Record<NonNullable<StatItem["tone"]>, string> = {
  default: "text-text-1",
  warn: "text-warn",
  positive: "text-positive",
};

const toneBar: Record<NonNullable<StatItem["tone"]>, string> = {
  default: "bg-accent",
  warn: "bg-warn",
  positive: "bg-positive",
};

export function StatGrid({ items, columns = "3" }: { items: StatItem[]; columns?: "2" | "3" }) {
  return (
    <div className={cn("grid gap-x-4 gap-y-5", columns === "2" ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3")}>
      {items.map((item, i) => (
        <div key={i}>
          <div className="mb-1.5 text-[12px] font-medium text-text-2">{item.label}</div>
          <div className={cn("text-[20px] font-bold tracking-[-0.025em]", toneText[item.tone ?? "default"])}>{item.value}</div>
          {item.progressPct !== undefined && (
            <div className="mt-2 h-[4px] overflow-hidden rounded-full bg-border">
              <div className={cn("h-full rounded-full", toneBar[item.tone ?? "default"])} style={{ width: `${Math.min(item.progressPct, 100)}%` }} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
