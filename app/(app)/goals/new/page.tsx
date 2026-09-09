"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { createGoal } from "@/lib/actions/goals";

const CATEGORIES = [
  { value: "finance", label: "Finance" },
  { value: "fitness", label: "Fitness" },
  { value: "career", label: "Career" },
  { value: "learning", label: "Learning" },
  { value: "health", label: "Health" },
  { value: "custom", label: "Personal" },
];

export default function NewGoalPage() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(() => {
      void (async () => {
        const result = await createGoal(formData);
        if (result?.error) setError(result.error);
      })();
    });
  }

  return (
    <main className="mx-auto w-full max-w-[720px] px-5 pb-24 pt-7 sm:px-7 md:px-8">
      <Link href="/goals" className="mb-4 inline-block text-[13.5px] text-text-2">
        ← Back to goals
      </Link>
      <h1 className="m-0 mb-6 text-[22px] font-bold tracking-tight text-text-1">New goal</h1>

      <form action={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-text-2">Title</span>
          <input
            name="title"
            required
            placeholder="e.g. Save $20,000"
            className="rounded-sm border border-border bg-surface px-4 py-3 text-[15px] text-text-1 outline-none focus:border-accent"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-text-2">Category</span>
          <select
            name="category"
            className="rounded-sm border border-border bg-surface px-4 py-3 text-[15px] text-text-1 outline-none focus:border-accent"
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-text-2">Target (optional)</span>
          <input
            name="target"
            placeholder="e.g. $20,000 saved"
            className="rounded-sm border border-border bg-surface px-4 py-3 text-[15px] text-text-1 outline-none focus:border-accent"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-text-2">Deadline (optional)</span>
          <input
            type="date"
            name="deadline"
            className="rounded-sm border border-border bg-surface px-4 py-3 text-[15px] text-text-1 outline-none focus:border-accent"
          />
        </label>

        {error && <div className="text-[13.5px] text-danger">{error}</div>}

        <button
          type="submit"
          disabled={isPending}
          className="mt-2 rounded-sm bg-accent py-3.5 text-[15px] font-semibold text-white disabled:opacity-60"
        >
          {isPending ? "Creating…" : "Create goal"}
        </button>
      </form>
    </main>
  );
}
