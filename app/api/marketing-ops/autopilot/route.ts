import { NextResponse } from "next/server";
import { callOpenAIText, isOpenAIConfigured } from "@/lib/ai/openai";
import { assertDepartmentCanSpend, recordEstimatedSpend } from "@/lib/ai/department-budget";
import { MARKETING_AGENT_MAP } from "@/lib/marketing/agents";
import { requireMarketingOwner } from "@/lib/marketing/server";

type AutopilotPlan = {
  campaign: { name: string; objective: string; thesis: string };
  summary: string;
  tasks: Array<{ title: string; priority: number; agent: string; status: string; owner_minutes: number; action: string }>;
  content: Array<{ title: string; format: "reel" | "carousel" | "story" | "static" | "live" | "other"; pillar: string; hypothesis: string; hook: string; script: string; caption: string; cta: string; creative_brief: string; founder_task: string; filming_instructions?: { camera?: string; location?: string; delivery?: string; b_roll?: string; estimated_minutes?: number }; priority: number }>;
  trends: Array<{ title: string; opportunity: string; relevance_score: number; velocity_score: number; brand_fit_score: number }>;
  community: Array<{ action_type: string; context: string; suggested_reply: string; priority: number }>;
  partnerships: Array<{ name: string; category: string; collaboration_idea: string; outreach_angle: string; fit_score: number }>;
  experiments: Array<{ name: string; hypothesis: string; variant_a: string; variant_b: string; primary_metric: string; target_sample: number }>;
};

function parseJson<T>(raw: string): T {
  const cleaned = raw.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
  return JSON.parse(cleaned) as T;
}

export async function POST(request: Request) {
  const { allowed, user, supabase } = await requireMarketingOwner();
  if (!allowed || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isOpenAIConfigured()) return NextResponse.json({ error: "OPENAI_API_KEY is not configured." }, { status: 503 });

  const body = (await request.json().catch(() => ({}))) as { objective?: string; context?: string; kind?: "morning" | "hype" };
  const today = new Date().toISOString().slice(0, 10);
  const kind = body.kind || "morning";
  const prompt = `Create Project You+'s ${kind === "hype" ? "pre-launch hype campaign and production queue" : "Instagram-first morning growth plan"} for ${today}.\nObjective: ${body.objective || "Build anticipation for Project You+ before launch."}\nContext: ${body.context || "Premium AI life operating system. Founder-led, aspirational, intelligent and slightly mysterious. Prioritize curiosity, conversation, shares, saves, qualified profile visits, follows and waitlist intent."}\n\nProject You+ unifies Today, Plan, Health, Fitness, Goals, Finances, Progress, Habits and Accountability through one intelligent Coach. It is not a task manager, habit tracker or generic chatbot. Avoid productivity listicles, generic motivation, AI news and hustle clichés. Favor contrarian hooks, strong POVs, identity, product reveals, founder-build storytelling, cultural tension, instantly recognized pain and high-retention visual concepts.\n\nReturn ONLY valid JSON with this exact shape:\n{"campaign":{"name":"","objective":"","thesis":""},"summary":"","tasks":[{"title":"","priority":1,"agent":"Atlas","status":"ready","owner_minutes":5,"action":"review"}],"content":[{"title":"","format":"reel","pillar":"","hypothesis":"","hook":"","script":"","caption":"","cta":"","creative_brief":"","founder_task":"","filming_instructions":{"camera":"","location":"","delivery":"","b_roll":"","estimated_minutes":4},"priority":1}],"trends":[{"title":"","opportunity":"","relevance_score":80,"velocity_score":80,"brand_fit_score":90}],"community":[{"action_type":"engage","context":"","suggested_reply":"","priority":1}],"partnerships":[{"name":"Creator archetype: ...","category":"creator","collaboration_idea":"","outreach_angle":"","fit_score":85}],"experiments":[{"name":"","hypothesis":"","variant_a":"","variant_b":"","primary_metric":"profile_to_follow","target_sample":20000}]}\nCreate 7 distinct content items with at least 3 priority Reels, 6 practical tasks, 3 brand-fit opportunities, 3 community actions, 3 partnership archetypes and 2 disciplined experiments. Founder tasks and filming instructions must be specific and fast. Scores describe strategic recommendations, never live measurements. Do not invent live trend statistics, creator handles, audiences, performance or Instagram data.`;

  try {
    await assertDepartmentCanSpend(supabase, user.id, "growth", 8);
    const { data: atlasSetting } = await supabase.from("marketing_agent_settings").select("enabled").eq("owner_id", user.id).eq("agent_id", "orchestrator").maybeSingle();
    if (atlasSetting?.enabled === false) return NextResponse.json({ error: "Atlas is turned off." }, { status: 429 });
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
      hypothesis: item.hypothesis,
      cta: item.cta,
      filming_instructions: item.filming_instructions || {},
      source_agent_id: "orchestrator",
      score: Math.max(1, Math.min(100, 105 - item.priority * 5)),
      metrics: { founder_task: item.founder_task, priority: item.priority, autopilot_date: today },
    }));
    if (contentRows.length) await supabase.from("marketing_content_items").insert(contentRows);

    if (plan.trends?.length) await supabase.from("marketing_trend_signals").insert(plan.trends.map((item) => ({ ...item, owner_id: user.id, source: "autopilot", status: "new" })));
    if (plan.community?.length) await supabase.from("marketing_community_actions").insert(plan.community.map((item) => ({ ...item, owner_id: user.id, channel: "instagram", status: "open" })));
    if (plan.partnerships?.length) await supabase.from("marketing_partnerships").insert(plan.partnerships.map((item) => ({ ...item, owner_id: user.id, status: "prospect" })));

    if (kind === "morning") {
      await supabase.from("marketing_daily_plans").upsert({
        owner_id: user.id,
        campaign_id: campaign.id,
        plan_date: today,
        objective: plan.campaign.objective || body.objective || "Build anticipation for Project You+ before launch.",
        summary: plan.summary || plan.campaign.thesis,
        tasks: plan.tasks || [],
        status: "active",
        updated_at: new Date().toISOString(),
      }, { onConflict: "owner_id,plan_date" });
    }

    if (plan.experiments?.length) await supabase.from("marketing_experiments").insert(plan.experiments.map((item) => ({
      ...item,
      owner_id: user.id,
      campaign_id: campaign.id,
      status: "proposed",
    })));

    await supabase.from("marketing_agent_runs").insert({ owner_id: user.id, agent_id: "orchestrator", status: "completed", objective: body.objective, context: body.context, output, metadata: { type: kind === "hype" ? "hype_ideas" : "morning_autopilot", campaign_id: campaign.id, agent_name: "Atlas" } });
    await recordEstimatedSpend(supabase, user.id, "growth", 8, "orchestrator", kind === "hype" ? "hype_ideas" : "morning_autopilot");

    return NextResponse.json({ campaign, plan });
  } catch (error) {
    console.error("Morning Autopilot failed", error);
    const message = error instanceof Error ? error.message : "Morning Autopilot failed.";
    return NextResponse.json({ error: message }, { status: message.includes("turned off") || message.includes("budget reached") ? 429 : 500 });
  }
}
