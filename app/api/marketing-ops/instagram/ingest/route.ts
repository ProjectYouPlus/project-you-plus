import { NextResponse } from "next/server";
import { requireMarketingOwner } from "@/lib/marketing/server";

export async function POST(request: Request) {
  const { allowed, user, supabase } = await requireMarketingOwner();
  if (!allowed || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as {
    metric_date?: string;
    followers?: number; reach?: number; impressions?: number; profile_visits?: number;
    website_clicks?: number; shares?: number; saves?: number; comments?: number; likes?: number;
    reels_watch_time_seconds?: number; signups?: number; metadata?: Record<string, unknown>;
  };

  const metricDate = body.metric_date || new Date().toISOString().slice(0, 10);
  const row = {
    owner_id: user.id,
    metric_date: metricDate,
    followers: body.followers ?? null,
    reach: body.reach ?? null,
    impressions: body.impressions ?? null,
    profile_visits: body.profile_visits ?? null,
    website_clicks: body.website_clicks ?? null,
    shares: body.shares ?? null,
    saves: body.saves ?? null,
    comments: body.comments ?? null,
    likes: body.likes ?? null,
    reels_watch_time_seconds: body.reels_watch_time_seconds ?? null,
    signups: body.signups ?? null,
    metadata: { source: "instagram_ingest", ...(body.metadata || {}) },
  };

  const { data, error } = await supabase
    .from("marketing_daily_metrics")
    .upsert(row, { onConflict: "owner_id,metric_date" })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}
