import { NextResponse } from "next/server";
import { callOpenAIText, isOpenAIConfigured } from "@/lib/ai/openai";
import { MARKETING_AGENT_MAP } from "@/lib/marketing/agents";
import { requireMarketingOwner } from "@/lib/marketing/server";

type AutopilotPlan = {
  campaign: { name: string; objective: string; thesis: string };
  content: Array<{ title: string; format: "reel" | "carousel" | "story"; pillar: string; hook: string; script: string; caption: string; creative_brief: string; founder_task: string; priority: number }>;
  trends: Array<{ title: string; opportunity: string; relevance_score: number; velocity_score: number; brand_fit_score: number }>;
  community: Array<{ action_type: string; context: string; suggested_reply: string; priority: number }>;
  partnerships: Array<{ name: string; category: string; collaboration_idea: string; outreach_angle: string; fit_score: number }>;
};

function parseJson<T>(raw: string): T {
  const cleaned = raw.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
  return JSON.parse(cleaned) as T;
}

export async function POST(request: Request) {
  const { allowed, user, supabase } = await requireMarketingOwner();
  if (!allowed || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isOpenAIConfigured()) return NextResponse.json({ error: "OPENAI_API_KEY is not configured." }, { status: 503 });

  const body = (await request.json().catch(() => ({}))) as { objective?: string; context?: string };
  const today = new Date().toISOString().slice(0, 10);
  const prompt = `Create Project You+'s Instagram-first organic growth plan for ${today}.\nObjective: ${body.objective || "Grow qualified awareness and waitlist intent while building a repeatable daily content engine."}\nContext: ${body.context || "Premium AI life operating system. Founder-led, aspirational but useful. Prioritize Reels, saves, shares, profile visits, follows and qualified signups."}\n\nReturn ONLY valid JSON with this exact shape:\n{"campaign":{"name":"","objective":"","thesis":""},"content":[{"title":"","format":"reel","pillar":"","hook":"","script":"","caption":"","creative_brief":"","founder_task":"","priority":1}],"trends":[{"title":"","opportunity":"","relevance_score":80,"velocity_score":80,"brand_fit_score":90}],"community":[{"action_type":"engage","context":"","suggested_reply":"","priority":1}],"partnerships":[{"name":"","category":"creator","collaboration_idea":"","outreach_angle":"","fit_score":85}]}\nCreate 5 content items (at least 3 Reels), 3 trend bets, 3 community actions and 3 partnership targets. Founder tasks must be specific filming instructions that can be completed quickly. Do not invent live trend statistics or real creator handles; use archetypes when live data is unavailable.`;

  try {
    const output = await callOpenAIText({
      instructions: MARKETING_AGENT_MAP.orchestrator.systemPrompt + " Coordinate the strategy, Reels, creative, copy, trends, analytics, community and partnerships disciplines into one coherent operating plan.",
      messages: [{ role: "user", content: prompt }],
      maxOutputTokens: 3600,
      reasoningEffort: "medium",
    });
    const plan = parseJson<AutopilotPlan>(output);

    const { data: campaign, error: campaignError } = await supabase.from("marketing_campaigns").insert({
      owner_id: user.id,
      name: plan.campaign.name,
      objective: plan.campaign.objective,
      channel: "instagram",
      status: "active",
      metadata: { thesis: plan.campaign.thesis, source: "morning_autopilot", date: today },
    }).select("*").single();
    if (campaignError) throw campaignError;

    const contentRows = (plan.content || []).map((item) => ({
      owner_id: user.id,
      campaign_id: campaign.id,
      title: item.title,
      format: item.format,
      pillar: item.pillar,
      stage: "production",
      approval_status: "pending",
      hook: item.hook,
      script: item.script,
      caption: item.caption,
      creative_brief: item.creative_brief,
      source_agent_id: "orchestrator",
      score: Math.max(1, Math.min(100, 105 - item.priority * 5)),
      metrics: { founder_task: item.founder_task, priority: item.priority, autopilot_date: today },
    }));
    if (contentRows.length) await supabase.from("marketing_content_items").insert(contentRows);

    if (plan.trends?.length) await supabase.from("marketing_trend_signals").insert(plan.trends.map((item) => ({ ...item, owner_id: user.id, source: "autopilot", status: "new" })));
    if (plan.community?.length) await supabase.from("marketing_community_actions").insert(plan.community.map((item) => ({ ...item, owner_id: user.id, channel: "instagram", status: "open" })));
    if (plan.partnerships?.length) await supabase.from("marketing_partnerships").insert(plan.partnerships.map((item) => ({ ...item, owner_id: user.id, status: "prospect" })));

    await supabase.from("marketing_agent_runs").insert({ owner_id: user.id, agent_id: "orchestrator", status: "completed", objective: body.objective, context: body.context, output, metadata: { type: "morning_autopilot", campaign_id: campaign.id } });

    return NextResponse.json({ campaign, plan });
  } catch (error) {
    console.error("Morning Autopilot failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Morning Autopilot failed." }, { status: 500 });
  }
}
