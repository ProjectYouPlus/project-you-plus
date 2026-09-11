import type { HealthOverview } from "@/lib/data/health";
import { HealthQuickEntry } from "./health-quick-entry";
const METRICS = [
  { key: "sleep_minutes", label: "Sleep", unit: "min" },
  { key: "steps", label: "Steps", unit: "steps" },
  { key: "weight_kg", label: "Weight", unit: "kg" },
  { key: "resting_hr", label: "Resting HR", unit: "bpm" },
  { key: "recovery_pct", label: "Recovery", unit: "%" },
];
export function VitalsRecovery({
  metrics,
  error,
  timezone,
}: {
  timezone: string;
  metrics: HealthOverview["metrics"];
  error: boolean;
}) {
  return (
    <section id="recovery" className="space-y-3">
      <h2 className="m-0 text-xl font-semibold">Vitals & Recovery</h2>
      <p className="text-xs text-text-3">
        Optional data that helps Project You+ understand recovery and physical
        trends.
      </p>
      {error ? (
        <p role="alert" className="py-glass-soft p-4 text-sm">
          Recovery data is temporarily unavailable.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {METRICS.map((meta) => {
            const rows = metrics.filter((x) => x.metric_type === meta.key),
              latest = rows[0],
              earliest = rows.at(-1),
              delta =
                latest && earliest && rows.length > 1
                  ? Number(latest.value) - Number(earliest.value)
                  : null;
            return (
              <div key={meta.key} className="py-glass-soft p-4">
                <p className="m-0 text-xs text-text-3">{meta.label}</p>
                <p className="mb-1 mt-2 text-xl font-semibold">
                  {latest
                    ? meta.key === "sleep_minutes"
                      ? `${Math.floor(Number(latest.value) / 60)}h ${Math.round(Number(latest.value) % 60)}m`
                      : `${Number(latest.value)} ${meta.unit}`
                    : "No data"}
                </p>
                {latest && (
                  <p className="text-[10px] text-text-3">
                    Recorded{" "}
                    {new Date(latest.recorded_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      timeZone: timezone,
                    })}
                    {delta !== null &&
                      ` · ${delta >= 0 ? "+" : ""}${Math.round(delta * 10) / 10} ${meta.unit} across ${rows.length} entries`}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
      <details>
        <summary className="cursor-pointer text-xs text-accent-text">
          Add optional data
        </summary>
        <div className="mt-3">
          <HealthQuickEntry />
        </div>
      </details>
    </section>
  );
}
