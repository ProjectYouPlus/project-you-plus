"use client";

import { useState, useTransition } from "react";
import { createHabit, logHabitToday } from "@/lib/actions/habits";
import type { Habit } from "@/lib/types";

export function HabitBoard({ initialHabits }: { initialHabits: Habit[] }) {
  const [habits, setHabits] = useState(initialHabits);
  const [loggedToday, setLoggedToday] = useState<Set<string>>(new Set());
  const [showForm, setShowForm] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleLog(habit: Habit) {
    if (loggedToday.has(habit.id)) return;
    setLoggedToday((s) => new Set(s).add(habit.id));
    setHabits((hs) =>
      hs.map((h) => (h.id === habit.id ? { ...h, streakDays: h.streakDays + 1, consistencyPct: Math.min(100, h.consistencyPct + 3) } : h))
    );
    startTransition(() => {
      void logHabitToday(habit.id);
    });
  }

  function handleCreate(formData: FormData) {
    const title = String(formData.get("title") ?? "").trim();
    if (!title) return;
    const targetFrequency = String(formData.get("targetFrequency") ?? "daily") as Habit["targetFrequency"];

    setHabits((hs) => [{ id: `temp-${Date.now()}`, title, targetFrequency, consistencyPct: 0, streakDays: 0 }, ...hs]);
    setShowForm(false);
    startTransition(() => {
      void createHabit(formData);
    });
  }

  return (
    <div>
      {habits.map((habit) => (
        <div key={habit.id} className="border-t border-border py-4 first:border-t-0">
          <div className="mb-2.5 flex items-center justify-between">
            <div>
              <div className="text-[15.5px] font-medium text-text-1">{habit.title}</div>
              <div className="mt-0.5 text-[12.5px] text-text-3">
                {habit.consistencyPct}% consistency · {habit.streakDays}-day streak
              </div>
            </div>
            <button
              onClick={() => handleLog(habit)}
              disabled={loggedToday.has(habit.id)}
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border-[1.5px] border-border transition-colors disabled:border-accent disabled:bg-accent"
            >
              {loggedToday.has(habit.id) ? (
                <svg viewBox="0 0 24 24" className="h-4 w-4 stroke-white" fill="none" strokeWidth={3}>
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="h-4 w-4 stroke-text-2" fill="none" strokeWidth={2}>
                  <path d="M12 5v14M5 12h14" />
                </svg>
              )}
            </button>
          </div>
          <div className="h-[5px] overflow-hidden rounded-full bg-border">
            <div className="h-full rounded-full bg-accent" style={{ width: `${habit.consistencyPct}%` }} />
          </div>
        </div>
      ))}

      {showForm ? (
        <form action={handleCreate} className="mt-4 flex flex-col gap-2.5 rounded-md border border-border p-4">
          <input
            name="title"
            required
            autoFocus
            placeholder="e.g. Meditate"
            className="rounded-sm border border-border bg-surface px-3 py-2.5 text-[14.5px] text-text-1 outline-none focus:border-accent"
          />
          <select name="targetFrequency" defaultValue="daily" className="rounded-sm border border-border bg-surface px-2.5 py-2 text-[13.5px] text-text-1">
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="n_per_week">A few times a week</option>
          </select>
          <div className="flex gap-2">
            <button type="submit" className="rounded-sm bg-accent px-4 py-2 text-[13.5px] font-semibold text-white">
              Add habit
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="rounded-sm border border-border px-4 py-2 text-[13.5px] font-semibold text-text-1">
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-sm border border-dashed border-border py-3 text-[14px] font-medium text-text-2"
        >
          + Add a habit
        </button>
      )}
    </div>
  );
}
