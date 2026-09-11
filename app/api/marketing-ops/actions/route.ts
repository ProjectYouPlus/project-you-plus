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
  plans: "marketing_daily_plans",
  experiments: "marketing_experiments",
  reviews: "marketing_weekly_reviews",
  settings: "marketing_agent_settings",
} as const;

type Resource = keyof typeof TABLES;

export async function POST(request: Request) {
  const { allowed, user, supabase } = await requireMarketingOwner();
  if (!allowed || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as { resource?: Resource; values?: Record<string, unknown> };
  if (!body.resource || !TABLES[body.resource] || !body.values) {
    return NextResponse.json({ error: "Invalid resource or values." }, { status: 400 });
  }

  const table = supabase.from(TABLES[body.resource]);
  const mutation = body.resource === "settings"
    ? table.upsert({ ...body.values, owner_id: user.id }, { onConflict: "owner_id,agent_id" })
    : table.insert({ ...body.values, owner_id: user.id });
  const { data, error } = await mutation.select("*").single();

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

  if (body.resource === "trends" && body.values.status === "used") {
    const { data: trend } = await supabase.from("marketing_trend_signals").select("title,opportunity,status").eq("id", body.id).eq("owner_id", user.id).maybeSingle();
    if (trend && trend.status !== "used") {
      const { error: contentError } = await supabase.from("marketing_content_items").insert({
        owner_id: user.id,
        title: trend.title,
        format: "reel",
        pillar: "Opportunity",
        stage: "idea",
        approval_status: "pending",
        hook: trend.opportunity,
        creative_brief: trend.opportunity,
        hypothesis: "This brand-fit opportunity can create qualified curiosity while its window is open.",
        source_agent_id: "trends",
        metrics: { source_trend_id: body.id },
      });
      if (contentError) return NextResponse.json({ error: contentError.message }, { status: 400 });
    }
  }

  let values = body.resource === "content" || body.resource === "partnerships" || body.resource === "campaigns" || body.resource === "plans" || body.resource === "experiments" || body.resource === "settings"
    ? { ...body.values, updated_at: new Date().toISOString() }
    : body.values;

  if (body.resource === "content" && typeof body.values.approval_status === "string") {
    const { data: existing } = await supabase.from("marketing_content_items").select("metrics").eq("id", body.id).eq("owner_id", user.id).maybeSingle();
    values = {
      ...values,
      metrics: {
        ...(existing?.metrics || {}),
        approval: {
          status: body.values.approval_status,
          decided_by: user.id,
          decided_at: new Date().toISOString(),
        },
      },
    };
  }

  let query = supabase
    .from(TABLES[body.resource])
    .update(values)
    .eq("owner_id", user.id);
  query = body.resource === "settings" ? query.eq("agent_id", body.id) : query.eq("id", body.id);
  const { data, error } = await query
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}
