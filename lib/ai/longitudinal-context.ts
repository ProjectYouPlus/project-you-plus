import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type LongitudinalEvent = {
  id: string;
  event_type: string;
  occurred_at: string;
  source_table: string | null;
  source_id: string | null;
  payload: Record<string, unknown>;
};

export async function loadLongitudinalContext(userId: string, options: { days?: number; limit?: number } = {}) {
  const days = Math.min(365, Math.max(1, options.days ?? 60));
  const limit = Math.min(500, Math.max(1, options.limit ?? 200));
  const since = new Date();
  since.setDate(since.getDate() - days);
  const { data, error } = await createAdminClient()
    .from("behavior_events")
    .select("id,event_type,occurred_at,source_table,source_id,payload")
    .eq("user_id", userId)
    .gte("occurred_at", since.toISOString())
    .order("occurred_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);
  const events = (data ?? []) as LongitudinalEvent[];
  const counts = events.reduce<Record<string, number>>((out, event) => {
    out[event.event_type] = (out[event.event_type] ?? 0) + 1;
    return out;
  }, {});
  return { windowDays: days, events, counts, evidenceIds: events.map((event) => event.id) };
}
