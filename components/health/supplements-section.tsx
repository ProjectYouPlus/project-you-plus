"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import type { HealthOverview, HealthSupplement } from "@/lib/data/health";
import {
  logSupplementToday,
  updateSupplementSchedule,
  saveSupplementReminder,
} from "@/lib/actions/supplements";
import { HealthAction } from "./health-action";
import { scheduleLabel, WEEKDAYS } from "@/lib/health/schedule";
export function SupplementsSection({
  items,
  reminders,
  error,
}: {
  items: HealthSupplement[];
  reminders: HealthOverview["reminders"];
  error: boolean;
}) {
  return (
    <section id="supplements" className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="m-0 text-xl font-semibold">Supplements</h2>
        <Link href="/supplements" className="text-xs text-accent-text">
          + Add / Manage
        </Link>
      </div>
      <div className="py-glass-soft divide-y divide-border px-4">
        {error ? (
          <p role="alert" className="py-3 text-sm">
            Supplements are temporarily unavailable.
          </p>
        ) : items.length ? (
          items.map((item) => (
            <SupplementRow
              key={`${item.id}:${item.frequency}`}
              item={item}
              reminder={reminders.find((x) => x.target_id === item.id)}
            />
          ))
        ) : (
          <p className="py-3 text-sm text-text-3">
            No supplements added. Add your own tracking information when you
            need it.
          </p>
        )}
      </div>
    </section>
  );
}
function SupplementRow({
  item,
  reminder,
}: {
  item: HealthSupplement;
  reminder?: HealthOverview["reminders"][number];
}) {
  const timeRef = useRef<HTMLInputElement>(null);
  const [frequency, setFrequency] = useState(item.frequency),
    [days, setDays] = useState<number[]>(
      item.frequency.startsWith("days:")
        ? item.frequency.slice(5).split(",").map(Number)
        : [],
    ),
    [time, setTime] = useState(reminder?.time_of_day?.slice(0, 5) ?? ""),
    [enabled, setEnabled] = useState(reminder?.enabled ?? false);
  return (
    <div className="py-4">
      <div className="flex items-start gap-3">
        <HealthAction
          disabled={item.done || (!item.due && item.frequency !== "as_needed")}
          className={`py-check !h-11 !w-11 ${item.done ? "py-check-done" : ""}`}
          action={() => logSupplementToday(item.id)}
        >
          <span className="sr-only">Complete {item.name}</span>
          {item.done ? "✓" : "○"}
        </HealthAction>
        <div className="min-w-0 flex-1">
          <h3 className="m-0 text-sm font-semibold">{item.name}</h3>
          <p className="m-0 mt-1 text-xs text-text-3">
            {item.dosage || "Amount not entered"} ·{" "}
            {scheduleLabel(item.frequency)}
          </p>
          <p className="m-0 mt-1 text-xs text-accent-text">
            {item.done
              ? "Completed today"
              : item.due
                ? "Due today"
                : item.frequency === "as_needed"
                  ? "Optional today"
                  : "Not due today"}
          </p>
          {item.notes && <p className="text-xs text-text-3">{item.notes}</p>}
        </div>
      </div>
      <details className="mt-3">
        <summary className="cursor-pointer text-xs text-accent-text">
          Schedule / Set Reminder
        </summary>
        <label className="mt-3 block text-xs">
          Schedule
          <select
            className="py-input mt-1 w-full"
            value={frequency.startsWith("days:") ? "specific" : frequency}
            onChange={(e) => setFrequency(e.target.value)}
          >
            <option value="daily">Daily</option>
            <option value="weekdays">Weekdays</option>
            <option value="training_days">Training days</option>
            <option value="specific">Specific weekdays</option>
            <option value="as_needed">As needed</option>
            {item.frequency.startsWith("weekly") && (
              <option value={item.frequency}>
                {scheduleLabel(item.frequency)}
              </option>
            )}
          </select>
        </label>
        {(frequency === "specific" || frequency.startsWith("days:")) && (
          <div className="my-2 grid grid-cols-7 gap-1">
            {[1, 2, 3, 4, 5, 6, 0].map((day) => (
              <button
                type="button"
                key={day}
                aria-label={`${item.name} on ${WEEKDAYS[day]}`}
                aria-pressed={days.includes(day)}
                onClick={() =>
                  setDays((xs) =>
                    xs.includes(day)
                      ? xs.filter((x) => x !== day)
                      : [...xs, day],
                  )
                }
                className={`min-h-11 rounded-lg border text-xs ${days.includes(day) ? "border-accent bg-accent-soft" : "border-border"}`}
              >
                {WEEKDAYS[day][0]}
              </button>
            ))}
          </div>
        )}
        <div className="mt-3">
          <HealthAction
            action={() =>
              updateSupplementSchedule(
                item.id,
                frequency === "specific" || frequency.startsWith("days:")
                  ? `days:${days.sort().join(",")}`
                  : frequency,
              )
            }
          >
            Save schedule
          </HealthAction>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            Reminder enabled
          </label>
          <label className="text-xs">
            Time
            <input
              aria-label={`Reminder time for ${item.name}`}
              ref={timeRef}
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="py-input mt-1"
            />
          </label>
        </div>
        <p className="text-xs text-text-3">
          Uses this supplement’s saved schedule. Reminder configuration is
          saved; push delivery is not available yet.
        </p>
        <HealthAction
          action={() =>
            saveSupplementReminder(
              item.id,
              timeRef.current?.value ?? time,
              enabled,
            )
          }
        >
          Save reminder
        </HealthAction>
      </details>
    </div>
  );
}
