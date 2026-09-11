import { NextResponse } from "next/server";
import { calculateGrowthScore, requireMarketingOwner } from "@/lib/marketing/server";

export async function GET() {
  const { allowed, user, supabase } = await requireMarketingOwner();
  if (!allowed || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const since = new Date(Date.now() - 7 * 86400000).toISOString();
  const [content, trends, metrics, community, partnerships, learnings, campaigns, runs, instagram] = await Promise.all([
    supabase.from("marketing_content_items").select("*").order("created_at", { ascending: false }).limit(100),
    supabase.from("marketing_trend_signals").select("*").order("created_at", { ascending: false }).limit(30),
    supabase.from("marketing_daily_metrics").select("*").order("metric_date", { ascending: false }).limit(30),
    supabase.from("marketing_community_actions").select("*").order("created_at", { ascending: false }).limit(50),
    supabase.from("marketing_partnerships").select("*").order("updated_at", { ascending: false }).limit(50),
    supabase.from("marketing_learnings").select("*").order("impact_score", { ascending: false }).limit(30),
    supabase.from("marketing_campaigns").select("*").order("updated_at", { ascending: false }).limit(20),
    supabase.from("marketing_agent_runs").select("*").order("created_at", { ascending: false }).limit(30),
    supabase.from("integrations").select("status,connected_at,metadata").eq("provider", "instagram").maybeSingle(),
  ]);

  const published7d = (content.data || []).filter((item) => item.published_at && item.published_at >= since).length;
  const growthScore = calculateGrowthScore(metrics.data || [], published7d);

  return NextResponse.json({
    content: content.data || [], trends: trends.data || [], metrics: metrics.data || [],
    community: community.data || [], partnerships: partnerships.data || [], learnings: learnings.data || [],
    campaigns: campaigns.data || [], runs: runs.data || [], growthScore, instagram: instagram.data || null,
  });
}
