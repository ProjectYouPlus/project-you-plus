import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ACHIEVEMENTS } from "@/lib/progression/achievements";
import type { CelebrationEvent } from "@/lib/celebrations/types";

const TYPES = ["progression.one_percent_earned", "milestone.unlocked", "achievement.unlocked"];

export async function GET() {
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return NextResponse.json({ events: [] }, { status: 401 });
  const admin = createAdminClient();
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const { data: rows, error } = await admin.from("behavior_events").select("id,event_type,occurred_at,payload").eq("user_id", user.id).in("event_type", TYPES).gte("occurred_at", since).order("occurred_at", { ascending: true }).limit(30);
  if (error) return NextResponse.json({ events: [] }, { status: 500 });
  const ids = (rows ?? []).map((row) => row.id);
  if (!ids.length) return NextResponse.json({ events: [] });
  const { data: receipts } = await admin.from("celebration_receipts").select("event_id").eq("user_id", user.id).in("event_id", ids);
  const seen = new Set((receipts ?? []).map((row) => row.event_id));
  const candidates = (rows ?? []).filter((row) => !seen.has(row.id)).sort((a,b) => priority(b.event_type) - priority(a.event_type)).slice(0, 4);
  const claimed: CelebrationEvent[] = [];
  for (const row of candidates) {
    const { data } = await admin.from("celebration_receipts").upsert({ user_id: user.id, event_id: row.id, first_presented_at: new Date().toISOString() }, { onConflict: "user_id,event_id", ignoreDuplicates: true }).select("event_id").maybeSingle();
    if (data) claimed.push(toEvent(row));
  }
  return NextResponse.json({ events: claimed }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const body = await request.json().catch(() => ({})) as { eventIds?: unknown; skipped?: unknown };
  const ids = Array.isArray(body.eventIds) ? body.eventIds.filter((id): id is string => typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id)).slice(0, 10) : [];
  if (!ids.length) return NextResponse.json({ ok: false }, { status: 400 });
  const admin = createAdminClient();
  const { error } = await admin.from("celebration_receipts").update({ acknowledged_at: new Date().toISOString(), skipped: Boolean(body.skipped) }).eq("user_id", user.id).in("event_id", ids);
  return NextResponse.json({ ok: !error }, { status: error ? 500 : 200 });
}

function priority(type: string) { return type === "progression.one_percent_earned" ? 3 : type === "milestone.unlocked" ? 2 : 1; }
function toEvent(row: { id: string; event_type: string; occurred_at: string; payload: unknown }): CelebrationEvent {
  const payload = row.payload && typeof row.payload === "object" ? row.payload as Record<string, unknown> : {};
  if (row.event_type === "progression.one_percent_earned") return { eventId: row.id, kind: "one", key: "one_percent", title: "1%", description: "You didn’t get here in a day.", earnedAt: row.occurred_at, level: 99 };
  if (row.event_type === "milestone.unlocked") { const level = Number(payload.level); const stage = String(payload.stage ?? "Milestone"); return { eventId: row.id, kind: level === 99 ? "one" : "milestone", key: `milestone_${level}`, title: stage, description: milestoneCopy(level), earnedAt: row.occurred_at, level }; }
  const key = String(payload.key ?? "achievement"); const definition = ACHIEVEMENTS.find((item) => item.key === key);
  return { eventId: row.id, kind: "achievement", key, title: definition?.title ?? String(payload.title ?? "Achievement unlocked"), description: achievementCopy(key, definition?.description), earnedAt: row.occurred_at, tier: definition?.tier ?? String(payload.tier ?? "standard") };
}
function milestoneCopy(level:number){return ({60:"You’ve built the base.",70:"You’re no longer starting from zero.",80:"More of your life is working together.",90:"High performance. Sustained.",99:"You didn’t get here in a day."} as Record<number,string>)[level]??"Your trajectory changed."}
function achievementCopy(key:string,fallback?:string){return ({first_day_completed:"The first loop is closed.",first_full_week:"Seven days, completed with intent.",seven_day_consistency:"Seven days of showing up.",first_goal_completed:"A promise became proof.",three_workout_week:"The plan was completed.",first_weekly_review:"You looked back to move forward.",budget_month_completed:"The month closed with control.",thirty_day_discipline:"Consistency became a standard."} as Record<string,string>)[key]??fallback??"Progress became proof."}
