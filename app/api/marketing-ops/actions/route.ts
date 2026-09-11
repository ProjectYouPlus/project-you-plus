import { NextResponse } from "next/server";
import { requireMarketingOwner } from "@/lib/marketing/server";

const TABLES = {
  content: "marketing_content_items",
  trends: "marketing_trend_signals",
  community: "marketing_community_actions",
  partnerships: "marketing_partnerships",
  learnings: "marketing_learnings",
  campaigns: "marketing_campaigns",
  metrics: "marketing_daily_metrics",
} as const;

type Resource = keyof typeof TABLES;

export async function POST(request: Request) {
  const { allowed, user, supabase } = await requireMarketingOwner();
  if (!allowed || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as { resource?: Resource; values?: Record<string, unknown> };
  if (!body.resource || !TABLES[body.resource] || !body.values) {
    return NextResponse.json({ error: "Invalid resource or values." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from(TABLES[body.resource])
    .insert({ ...body.values, owner_id: user.id })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}

export async function PATCH(request: Request) {
  const { allowed, user, supabase } = await requireMarketingOwner();
  if (!allowed || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as { resource?: Resource; id?: string; values?: Record<string, unknown> };
  if (!body.resource || !TABLES[body.resource] || !body.id || !body.values) {
    return NextResponse.json({ error: "Invalid update request." }, { status: 400 });
  }

  const values = body.resource === "content" || body.resource === "partnerships" || body.resource === "campaigns"
    ? { ...body.values, updated_at: new Date().toISOString() }
    : body.values;

  const { data, error } = await supabase
    .from(TABLES[body.resource])
    .update(values)
    .eq("id", body.id)
    .eq("owner_id", user.id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}
