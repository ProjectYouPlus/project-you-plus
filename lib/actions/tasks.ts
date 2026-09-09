"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/demo-mode";
import type { Tier } from "@/lib/types";

export async function createTask(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const tier = (String(formData.get("tier") ?? "optional") as Tier);
  const dueAt = String(formData.get("dueAt") ?? "") || null;
  const goalId = String(formData.get("goalId") ?? "") || null;

  if (!title) return { error: "Give the task a title." };
  if (isDemoMode) {
    const cookieStore = await cookies();
    let demoTasks: Array<{ id: string; goalId: string | null; title: string; tier: Tier; dueAt: string | null; completedAt: string | null; meta?: string }> = [];
    try { demoTasks = JSON.parse(cookieStore.get("py_demo_tasks")?.value ?? "[]"); } catch {}
    demoTasks.unshift({ id: `demo-${Date.now()}`, goalId, title, tier, dueAt, completedAt: null, meta: goalId ? "Added with smart task flow · Goal-linked" : "Added with smart task flow" });
    cookieStore.set("py_demo_tasks", JSON.stringify(demoTasks.slice(0, 12)), { path: "/", maxAge: 60 * 60 * 24 * 7 });
    revalidatePath("/tasks");
    revalidatePath("/today");
    return { error: null };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { error } = await supabase.from("tasks").insert({
    user_id: user.id,
    title,
    tier,
    due_at: dueAt,
    goal_id: goalId,
  });

  if (error) return { error: error.message };

  revalidatePath("/tasks");
  revalidatePath("/today");
  return { error: null };
}

export async function toggleTaskComplete(taskId: string, completed: boolean) {
  if (isDemoMode) return;

  const supabase = await createClient();
  await supabase
    .from("tasks")
    .update({ completed_at: completed ? new Date().toISOString() : null })
    .eq("id", taskId);

  revalidatePath("/tasks");
  revalidatePath("/today");
}

export async function deleteTask(taskId: string) {
  if (isDemoMode) return;

  const supabase = await createClient();
  await supabase.from("tasks").delete().eq("id", taskId);
  revalidatePath("/tasks");
  revalidatePath("/today");
}

export async function updateTask(
  taskId: string,
  updates: { title?: string; tier?: Tier; dueAt?: string | null; goalId?: string | null }
) {
  if (isDemoMode) return;

  const supabase = await createClient();
  const patch: Record<string, unknown> = {};
  if (updates.title !== undefined) patch.title = updates.title;
  if (updates.tier !== undefined) patch.tier = updates.tier;
  if (updates.dueAt !== undefined) patch.due_at = updates.dueAt;
  if (updates.goalId !== undefined) patch.goal_id = updates.goalId;

  await supabase.from("tasks").update(patch).eq("id", taskId);
  revalidatePath("/tasks");
  revalidatePath("/today");
}
