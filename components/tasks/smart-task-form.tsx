"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createTask } from "@/lib/actions/tasks";
import type { Goal, Tier } from "@/lib/types";

const DURATIONS = ["15 min", "30 min", "45 min", "60 min", "90 min"];
const ENERGY = ["Low", "Medium", "High"];

export function SmartTaskForm({ goals }: { goals: Goal[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [goalId, setGoalId] = useState(goals[0]?.id ?? "");
  const [tier, setTier] = useState<Tier>("important");
  const [duration, setDuration] = useState("30 min");
  const [energy, setEnergy] = useState("Medium");
  const [schedule, setSchedule] = useState("Today · 4:30 PM");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit() {
    if (!title.trim()) {
      setError("Give the task a clear outcome.");
      return;
    }
    const formData = new FormData();
    formData.set("title", title.trim());
    formData.set("tier", tier);
    formData.set("goalId", goalId);
    const dueAt = scheduleToISOString(schedule);
    if (dueAt) formData.set("dueAt", dueAt);
    startTransition(async () => {
      const result = await createTask(formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.push("/tasks");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <section className="py-card p-[18px]">
        <label className="block text-[12px] font-semibold text-text-2">What needs to happen?</label>
        <textarea
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="e.g. Finish onboarding prototype"
          rows={3}
          className="py-input mt-2 resize-none"
        />
      </section>

      <section className="rounded-[18px] border border-border bg-[var(--surface-2)] p-4">
        <div className="flex gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-[12px] font-bold text-white">AI</span>
          <div>
            <div className="text-[13px] font-semibold text-text-1">Smart defaults</div>
            <p className="m-0 mt-1 text-[12.5px] leading-relaxed text-text-2">I&apos;ll protect existing commitments and use your goal, energy, duration, and priority to place this in the best open window.</p>
          </div>
        </div>
      </section>

      <section className="py-card p-[18px]">
        <Field label="Linked goal">
          <select value={goalId} onChange={(event) => setGoalId(event.target.value)} className="py-input">
            <option value="">No linked goal</option>
            {goals.map((goal) => <option key={goal.id} value={goal.id}>{goal.title}</option>)}
          </select>
        </Field>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Field label="Duration">
            <select value={duration} onChange={(event) => setDuration(event.target.value)} className="py-input">{DURATIONS.map((value) => <option key={value}>{value}</option>)}</select>
          </Field>
          <Field label="Energy">
            <select value={energy} onChange={(event) => setEnergy(event.target.value)} className="py-input">{ENERGY.map((value) => <option key={value}>{value}</option>)}</select>
          </Field>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Field label="Priority">
            <select value={tier} onChange={(event) => setTier(event.target.value as Tier)} className="py-input">
              <option value="critical">Critical</option>
              <option value="important">Important</option>
              <option value="optional">Optional</option>
            </select>
          </Field>
          <Field label="Schedule">
            <select value={schedule} onChange={(event) => setSchedule(event.target.value)} className="py-input">
              <option>Today · 4:30 PM</option>
              <option>Today · 6:00 PM</option>
              <option>Tomorrow morning</option>
              <option>Let AI decide</option>
            </select>
          </Field>
        </div>
      </section>

      <section className="py-card p-4">
        <div className="text-[11px] font-semibold uppercase tracking-[0.13em] text-text-3">Calendar check</div>
        <div className="mt-2 flex items-center justify-between gap-3">
          <div>
            <div className="text-[14px] font-semibold text-text-1">{schedule}</div>
            <div className="mt-0.5 text-[12px] text-text-2">{duration} · {energy} energy · no conflicts</div>
          </div>
          <span className="rounded-full bg-positive-soft px-2.5 py-1 text-[11px] font-semibold text-positive">Open</span>
        </div>
      </section>

      {error && <p className="m-0 text-[12.5px] text-danger">{error}</p>}
      <button onClick={submit} disabled={isPending} className="py-button-primary w-full disabled:opacity-60">{isPending ? "Adding task…" : "Add to my plan"}</button>
    </div>
  );
}

function scheduleToISOString(schedule: string): string | null {
  const date = new Date();
  if (schedule.startsWith("Tomorrow")) { date.setDate(date.getDate() + 1); date.setHours(9, 0, 0, 0); return date.toISOString(); }
  if (schedule.includes("4:30 PM")) { date.setHours(16, 30, 0, 0); return date.toISOString(); }
  if (schedule.includes("6:00 PM")) { date.setHours(18, 0, 0, 0); return date.toISOString(); }
  return null;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-[11.5px] font-semibold text-text-2">{label}</span>{children}</label>;
}
