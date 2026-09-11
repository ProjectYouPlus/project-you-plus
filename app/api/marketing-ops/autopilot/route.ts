import { NextResponse } from "next/server";
import { callOpenAIStructuredText, isOpenAIConfigured } from "@/lib/ai/openai";
import { assertDepartmentCanSpend, recordEstimatedSpend } from "@/lib/ai/department-budget";
import { MARKETING_AGENT_MAP } from "@/lib/marketing/agents";
import { AUTOPILOT_PLAN_SCHEMA, type AutopilotPlan } from "@/lib/marketing/autopilot";
import { checkMarketingRunLimit, MARKETING_DEPARTMENT_DAILY_LIMIT, utcDayStart } from "@/lib/marketing/run-limits";
import { requireMarketingOwner } from "@/lib/marketing/server";

const AUTOPILOT_DAILY_LIMIT = 3;
const AUTOPILOT_COOLDOWN_MS = 60_000;

export async function POST(request: Request) {
  const { allowed, user, supabase } = await requireMarketingOwner();
  if (!allowed || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isOpenAIConfigured()) return NextResponse.json({ error: "OPENAI_API_KEY is not configured." }, { status: 503 });

  const body = (await request.json().catch(() => ({}))) as { objective?: string; context?: string; kind?: "morning" | "hype" };
  const today = new Date().toISOString().slice(0, 10);
  const kind = body.kind || "morning";
  const runType = kind === "hype" ? "hype_ideas" : "morning_autopilot";
  const prompt = `Create Project You+'s ${kind === "hype" ? "pre-launch hype campaign and production queue" : "Instagram-first morning growth plan"} for ${today}.
Objective: ${body.objective || "Build anticipation for Project You+ before launch."}
Context: ${body.context || "Premium AI life operating system. Founder-led, aspirational, intelligent and slightly mysterious. Prioritize curiosity, conversation, shares, saves, qualified profile visits, follows and waitlist intent."}

Project You+ unifies Today, Plan, Health, Fitness, Goals, Finances, Progress, Habits and Accountability through one intelligent Coach. It is not a task manager, habit tracker or generic chatbot. Avoid productivity listicles, generic motivation, AI news and hustle clichés. Favor contrarian hooks, strong POVs, identity, product reveals, founder-build storytelling, cultural tension, instantly recognized pain and high-retention visual concepts.

Create 7 distinct content items with at least 3 priority Reels, 6 practical tasks, 3 brand-fit opportunities, 3 community actions, 3 partnership archetypes and 2 disciplined experiments. Keep every script under 80 words, every caption under 60 words and all other text fields to one concise sentence. Founder tasks and filming instructions must be specific and fast. Scores describe strategic recommendations, never live measurements. Do not invent live trend statistics, creator handles, audiences, performance or Instagram data.`;

  let runId: string | null = null;
  try {
    await assertDepartmentCanSpend(supabase, user.id, "growth", 8);
    const { data: atlasSetting } = await supabase
      .from("marketing_agent_settings")
      .select("enabled")
      .eq("owner_id", user.id)
      .eq("agent_id", "orchestrator")
      .maybeSingle();
    if (atlasSetting?.enabled === false) return NextResponse.json({ error: "Atlas is turned off." }, { status: 429 });

    if (kind === "morning") {
      const { data: existingPlan, error: existingPlanError } = await supabase
        .from("marketing_daily_plans")
        .select("id,campaign_id,plan_date,objective,summary,tasks,status")
        .eq("owner_id", user.id)
        .eq("plan_date", today)
        .maybeSingle();
      if (existingPlanError) throw existingPlanError;
      if (existingPlan) return NextResponse.json({ reused: true, plan: existingPlan });
    }

    const { data: todayRuns, error: runsError } = await supabase
      .from("marketing_agent_runs")
      .select("status,created_at,metadata")
      .eq("owner_id", user.id)
      .gte("created_at", utcDayStart())
      .order("created_at", { ascending: false })
      .limit(50);
    if (runsError) throw runsError;
    const departmentDecision = checkMarketingRunLimit(todayRuns || [], {
      dailyLimit: MARKETING_DEPARTMENT_DAILY_LIMIT,
      cooldownMs: 10_000,
    });
    if (!departmentDecision.allowed) {
      return NextResponse.json(
        { error: departmentDecision.message, retryAfterSeconds: departmentDecision.retryAfterSeconds },
        { status: 429, headers: { "Retry-After": String(departmentDecision.retryAfterSeconds) } }
      );
    }
    const matchingRuns = (todayRuns || []).filter((run) => run.metadata?.type === runType);
    const decision = checkMarketingRunLimit(matchingRuns, {
      dailyLimit: AUTOPILOT_DAILY_LIMIT,
      cooldownMs: AUTOPILOT_COOLDOWN_MS,
    });
    if (!decision.allowed) {
      return NextResponse.json(
        { error: decision.message, retryAfterSeconds: decision.retryAfterSeconds },
        { status: 429, headers: { "Retry-After": String(decision.retryAfterSeconds) } }
      );
    }

    const { data: run, error: runError } = await supabase.from("marketing_agent_runs").insert({
      owner_id: user.id,
      agent_id: "orchestrator",
      status: "running",
      objective: body.objective || null,
      context: body.context || null,
      metadata: { type: runType, run_date: today, agent_name: "Atlas" },
    }).select("id").single();
    if (runError?.code === "23505") {
      return NextResponse.json(
        { error: "The Growth Department already has a run in progress.", retryAfterSeconds: 60 },
        { status: 429, headers: { "Retry-After": "60" } }
      );
    }
    if (runError) throw runError;
    runId = run.id;

    // Count every external AI call, including failed ones, against the owner's configured budget.
    await recordEstimatedSpend(supabase, user.id, "growth", 8, "orchestrator", runType);

    const { value: plan, raw: output } = await callOpenAIStructuredText<AutopilotPlan>({
      instructions: MARKETING_AGENT_MAP.orchestrator.systemPrompt + " Coordinate the strategy, Reels, creative, copy, trends, analytics, community and partnerships disciplines into one coherent operating plan.",
      messages: [{ role: "user", content: prompt }],
      schemaName: "marketing_autopilot_plan",
      schema: AUTOPILOT_PLAN_SCHEMA,
      maxOutputTokens: 4800,
      reasoningEffort: "medium",
      timeoutMs: 60_000,
    });

    const { data: campaign, error: campaignError } = await supabase.from("marketing_campaigns").insert({
      owner_id: user.id,
      name: plan.campaign.name,
      objective: plan.campaign.objective,
      channel: "instagram",
      status: "active",
      metadata: { thesis: plan.campaign.thesis, source: runType, date: today },
    }).select("*").single();
    if (campaignError) throw campaignError;

    const contentRows = plan.content.map((item) => ({
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
      filming_instructions: item.filming_instructions,
      source_agent_id: "orchestrator",
      score: Math.max(1, Math.min(100, 105 - item.priority * 5)),
      metrics: { founder_task: item.founder_task, priority: item.priority, autopilot_date: today },
    }));
    const { error: contentError } = await supabase.from("marketing_content_items").insert(contentRows);
    if (contentError) throw contentError;

    const { error: trendsError } = await supabase.from("marketing_trend_signals").insert(plan.trends.map((item) => ({ ...item, owner_id: user.id, source: "autopilot", status: "new" })));
    if (trendsError) throw trendsError;
    const { error: communityError } = await supabase.from("marketing_community_actions").insert(plan.community.map((item) => ({ ...item, owner_id: user.id, channel: "instagram", status: "open" })));
    if (communityError) throw communityError;
    const { error: partnershipsError } = await supabase.from("marketing_partnerships").insert(plan.partnerships.map((item) => ({ ...item, owner_id: user.id, status: "prospect" })));
    if (partnershipsError) throw partnershipsError;

    if (kind === "morning") {
      const { error: planError } = await supabase.from("marketing_daily_plans").upsert({
        owner_id: user.id,
        campaign_id: campaign.id,
        plan_date: today,
        objective: plan.campaign.objective || body.objective || "Build anticipation for Project You+ before launch.",
        summary: plan.summary || plan.campaign.thesis,
        tasks: plan.tasks,
        status: "active",
        updated_at: new Date().toISOString(),
      }, { onConflict: "owner_id,plan_date" });
      if (planError) throw planError;
    }

    const { error: experimentsError } = await supabase.from("marketing_experiments").insert(plan.experiments.map((item) => ({
      ...item,
      owner_id: user.id,
      campaign_id: campaign.id,
      status: "proposed",
    })));
    if (experimentsError) throw experimentsError;

    const { error: completedRunError } = await supabase.from("marketing_agent_runs").update({
      status: "completed",
      output,
      metadata: { type: runType, run_date: today, campaign_id: campaign.id, agent_name: "Atlas" },
    }).eq("id", runId);
    if (completedRunError) throw completedRunError;

    return NextResponse.json({ campaign, plan });
  } catch (error) {
    console.error("Morning Autopilot failed", error);
    const message = error instanceof Error ? error.message : "Morning Autopilot failed.";
    if (runId) {
      await supabase.from("marketing_agent_runs").update({
        status: "failed",
        metadata: { type: runType, run_date: today, agent_name: "Atlas", error: message },
      }).eq("id", runId);
    }
    const userMessage = message.includes("incomplete")
      ? "Atlas could not finish the plan cleanly. Wait one minute, then run Morning Autopilot again."
      : message;
    const status = message.includes("turned off") || message.includes("budget reached") ? 429 : 500;
    return NextResponse.json({ error: userMessage }, { status });
  }
}
