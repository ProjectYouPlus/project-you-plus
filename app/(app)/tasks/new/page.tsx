import Link from "next/link";
import { getGoals } from "@/lib/data/goals";
import { SmartTaskForm } from "@/components/tasks/smart-task-form";

export default async function NewTaskPage() {
  const goals = await getGoals();
  return (
    <main className="py-mobile-shell md:py-shell-narrow">
      <header className="mb-6 flex items-start gap-3">
        <Link href="/tasks" className="mt-1 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-[22px] text-text-2">‹</Link>
        <div>
          <div className="py-eyebrow mb-1">Quick add</div>
          <h1 className="m-0 text-[28px] font-bold tracking-[-0.04em] text-text-1">Add a task</h1>
          <p className="py-subtitle">Give AI enough context to schedule it intelligently.</p>
        </div>
      </header>
      <SmartTaskForm goals={goals} />
    </main>
  );
}
