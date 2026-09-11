import type { SupabaseClient } from "@supabase/supabase-js";

export type UserIntelligenceEventName =
  | "task.completed"
  | "task.missed"
  | "habit.completed"
  | "habit.missed"
  | "workout.completed"
  | "workout.missed"
  | "meal.logged"
  | "supplement.completed"
  | "calendar.changed"
  | "spending.threshold"
  | "goal.progress_changed"
  | "score.changed"
  | "first_week.completed"
  | "streak.changed"
  | "achievement.unlocked"
  | "milestone.unlocked";

export type UserIntelligenceDomain = "planner" | "health" | "finance" | "progress" | "general";

export interface RecordUserEventInput {
  userId: string;
  eventName: UserIntelligenceEventName;
  domain?: UserIntelligenceDomain;
  entityType?: string | null;
  entityId?: string | null;
  occurredAt?: string;
  value?: number | null;
  metadata?: Record<string, unknown>;
}

export async function recordUserEvent(supabase: SupabaseClient, input: RecordUserEventInput) {
  const { error } = await supabase.from("user_intelligence_events").insert({
    user_id: input.userId,
    event_name: input.eventName,
    domain: input.domain ?? inferDomain(input.eventName),
    entity_type: input.entityType ?? null,
    entity_id: input.entityId ?? null,
    occurred_at: input.occurredAt ?? new Date().toISOString(),
    value: input.value ?? null,
    metadata: input.metadata ?? {},
  });
  if (error) throw error;
}

export async function getRecentUserEvents(supabase: SupabaseClient, userId: string, days = 30, limit = 120) {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const { data, error } = await supabase
    .from("user_intelligence_events")
    .select("event_name,domain,entity_type,entity_id,occurred_at,value,metadata")
    .eq("user_id", userId)
    .gte("occurred_at", since)
    .order("occurred_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return data ?? [];
}

function inferDomain(eventName: UserIntelligenceEventName): UserIntelligenceDomain {
  if (eventName.startsWith("workout") || eventName.startsWith("meal") || eventName.startsWith("supplement")) return "health";
  if (eventName.startsWith("spending")) return "finance";
  if (eventName.startsWith("score") || eventName.startsWith("achievement") || eventName.startsWith("milestone") || eventName.startsWith("streak") || eventName.startsWith("first_week")) return "progress";
  if (eventName.startsWith("task") || eventName.startsWith("habit") || eventName.startsWith("calendar") || eventName.startsWith("goal")) return "planner";
  return "general";
}
