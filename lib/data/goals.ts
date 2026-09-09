import { isDemoMode } from "@/lib/demo-mode";
import { mockGoals } from "@/lib/mock-data";
import { createClient } from "@/lib/supabase/server";
import type { Goal } from "@/lib/types";

export async function getGoals(): Promise<Goal[]> {
  if (isDemoMode) return mockGoals;

  const supabase = await createClient();
  const { data, error } = await supabase.from("goals").select("*").order("created_at", { ascending: false });
  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    title: row.title,
    category: row.category ?? "custom",
    target: row.target,
    deadline: row.deadline,
    progress: row.progress ?? 0,
    vision12mo: row.vision_12mo,
    objective90day: row.objective_90day,
    status: row.status ?? "active",
  }));
}

export async function getGoal(id: string): Promise<Goal | null> {
  if (isDemoMode) return mockGoals.find((g) => g.id === id) ?? null;

  const supabase = await createClient();
  const { data, error } = await supabase.from("goals").select("*").eq("id", id).single();
  if (error || !data) return null;

  return {
    id: data.id,
    title: data.title,
    category: data.category ?? "custom",
    target: data.target,
    deadline: data.deadline,
    progress: data.progress ?? 0,
    vision12mo: data.vision_12mo,
    objective90day: data.objective_90day,
    status: data.status ?? "active",
  };
}
