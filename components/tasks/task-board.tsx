"use client";

import { useMemo, useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { createTask, toggleTaskComplete, deleteTask, updateTask } from "@/lib/actions/tasks";
import type { Task, Tier, Goal } from "@/lib/types";

type Tab = "today" | "upcoming" | "completed";

const TIER_OPTIONS: Tier[] = ["critical", "important", "optional"];

export function TaskBoard({ initialTasks, goals }: { initialTasks: Task[]; goals: Goal[] }) {
  const [tasks, setTasks] = useState(initialTasks);
  const [tab, setTab] = useState<Tab>("today");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isToday = (dueAt: string | null) => {
    if (!dueAt) return true; // undated tasks show up in Today so nothing gets lost
    const d = new Date(dueAt);
    const now = new Date();
    return d.toDateString() === now.toDateString() || d < now;
  };

  const filtered = useMemo(() => {
    if (tab === "completed") return tasks.filter((t) => t.completedAt);
    const incomplete = tasks.filter((t) => !t.completedAt);
    return tab === "today" ? incomplete.filter((t) => isToday(t.dueAt)) : incomplete.filter((t) => !isToday(t.dueAt));
  }, [tasks, tab]);

  function handleToggle(task: Task) {
    const completed = !task.completedAt;
    setTasks((ts) => ts.map((t) => (t.id === task.id ? { ...t, completedAt: completed ? new Date().toISOString() : null } : t)));
    startTransition(() => {
      void toggleTaskComplete(task.id, completed);
    });
  }

  function handleDelete(taskId: string) {
    setTasks((ts) => ts.filter((t) => t.id !== taskId));
    startTransition(() => {
      void deleteTask(taskId);
    });
  }

  function handleCreate(formData: FormData) {
    const title = String(formData.get("title") ?? "").trim();
    if (!title) return;
    const tier = (String(formData.get("tier") ?? "optional") as Tier);
    const dueAtRaw = String(formData.get("dueAt") ?? "");
    const goalId = String(formData.get("goalId") ?? "") || null;

    const optimistic: Task = {
      id: `temp-${Date.now()}`,
      goalId,
      title,
      tier,
      dueAt: dueAtRaw || null,
      completedAt: null,
    };
    setTasks((ts) => [optimistic, ...ts]);
    setShowForm(false);
    startTransition(() => {
      void createTask(formData);
    });
  }

  function handleEdit(taskId: string, updates: { title: string; tier: Tier; dueAt: string | null }) {
    setTasks((ts) => ts.map((t) => (t.id === taskId ? { ...t, ...updates } : t)));
    setEditingId(null);
    startTransition(() => {
      void updateTask(taskId, updates);
    });
  }

  return (
    <div>
      <div className="mb-6 flex gap-1 rounded-full bg-surface p-1" style={{ border: "1px solid var(--border)" }}>
        {(["today", "upcoming", "completed"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "flex-1 rounded-full py-2 text-[13.5px] font-semibold capitalize transition-colors",
              tab === t ? "bg-text-1 text-bg" : "text-text-2"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-[14.5px] text-text-3">Nothing here.</p>
      ) : (
        <div>
          {filtered.map((task) =>
            editingId === task.id ? (
              <EditTaskRow key={task.id} task={task} onSave={(u) => handleEdit(task.id, u)} onCancel={() => setEditingId(null)} />
            ) : (
              <TaskRow
                key={task.id}
                task={task}
                goalTitle={goals.find((g) => g.id === task.goalId)?.title}
                onToggle={() => handleToggle(task)}
                onEdit={() => setEditingId(task.id)}
                onDelete={() => handleDelete(task.id)}
              />
            )
          )}
        </div>
      )}

      {showForm ? (
        <NewTaskForm goals={goals} onSubmit={handleCreate} onCancel={() => setShowForm(false)} />
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-sm border border-dashed border-border py-3 text-[14px] font-medium text-text-2"
        >
          + Add a task
        </button>
      )}
    </div>
  );
}

function TaskRow({
  task,
  goalTitle,
  onToggle,
  onEdit,
  onDelete,
}: {
  task: Task;
  goalTitle?: string;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const done = !!task.completedAt;
  return (
    <div className="flex items-start gap-3 border-t border-border py-3 first:border-t-0">
      <button
        onClick={onToggle}
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
      </button>

      <div className="flex-1">
        <div className={cn("text-[15px] font-medium text-text-1", done && "text-text-3 line-through")}>{task.title}</div>
        <div className="mt-0.5 flex flex-wrap gap-x-2 text-[12.5px] text-text-3">
          <span className="capitalize">{task.tier}</span>
          {goalTitle && <span>· {goalTitle}</span>}
          {task.dueAt && <span>· Due {new Date(task.dueAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>}
        </div>
      </div>

      <button onClick={onEdit} className="text-[12.5px] text-text-3">
        Edit
      </button>
      <button onClick={onDelete} className="text-[12.5px] text-danger">
        Delete
      </button>
    </div>
  );
}

function EditTaskRow({
  task,
  onSave,
  onCancel,
}: {
  task: Task;
  onSave: (updates: { title: string; tier: Tier; dueAt: string | null }) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [tier, setTier] = useState<Tier>(task.tier);
  const [dueAt, setDueAt] = useState(task.dueAt?.slice(0, 10) ?? "");

  return (
    <div className="flex flex-col gap-2.5 border-t border-border py-3 first:border-t-0">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="rounded-sm border border-border bg-surface px-3 py-2 text-[14.5px] text-text-1 outline-none focus:border-accent"
      />
      <div className="flex gap-2">
        <select value={tier} onChange={(e) => setTier(e.target.value as Tier)} className="rounded-sm border border-border bg-surface px-2.5 py-2 text-[13.5px] text-text-1">
          {TIER_OPTIONS.map((t) => (
            <option key={t} value={t}>
              {t[0].toUpperCase() + t.slice(1)}
            </option>
          ))}
        </select>
        <input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} className="rounded-sm border border-border bg-surface px-2.5 py-2 text-[13.5px] text-text-1" />
      </div>
      <div className="flex gap-2">
        <button onClick={() => onSave({ title, tier, dueAt: dueAt || null })} className="rounded-sm bg-accent px-3 py-1.5 text-[13px] font-semibold text-white">
          Save
        </button>
        <button onClick={onCancel} className="rounded-sm border border-border px-3 py-1.5 text-[13px] font-semibold text-text-1">
          Cancel
        </button>
      </div>
    </div>
  );
}

function NewTaskForm({ goals, onSubmit, onCancel }: { goals: Goal[]; onSubmit: (formData: FormData) => void; onCancel: () => void }) {
  return (
    <form action={onSubmit} className="mt-4 flex flex-col gap-2.5 rounded-md border border-border p-4">
      <input
        name="title"
        required
        autoFocus
        placeholder="What needs doing?"
        className="rounded-sm border border-border bg-surface px-3 py-2.5 text-[14.5px] text-text-1 outline-none focus:border-accent"
      />
      <div className="flex gap-2">
        <select name="tier" defaultValue="optional" className="flex-1 rounded-sm border border-border bg-surface px-2.5 py-2 text-[13.5px] text-text-1">
          {TIER_OPTIONS.map((t) => (
            <option key={t} value={t}>
              {t[0].toUpperCase() + t.slice(1)}
            </option>
          ))}
        </select>
        <input type="date" name="dueAt" className="flex-1 rounded-sm border border-border bg-surface px-2.5 py-2 text-[13.5px] text-text-1" />
      </div>
      {goals.length > 0 && (
        <select name="goalId" defaultValue="" className="rounded-sm border border-border bg-surface px-2.5 py-2 text-[13.5px] text-text-1">
          <option value="">No linked goal</option>
          {goals.map((g) => (
            <option key={g.id} value={g.id}>
              {g.title}
            </option>
          ))}
        </select>
      )}
      <div className="flex gap-2">
        <button type="submit" className="rounded-sm bg-accent px-4 py-2 text-[13.5px] font-semibold text-white">
          Add task
        </button>
        <button type="button" onClick={onCancel} className="rounded-sm border border-border px-4 py-2 text-[13.5px] font-semibold text-text-1">
          Cancel
        </button>
      </div>
    </form>
  );
}
