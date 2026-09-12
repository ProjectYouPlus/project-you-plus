import { callOpenAIStructuredText, isOpenAIConfigured } from "@/lib/ai/openai";
import { assertDepartmentCanSpend, recordEstimatedSpend } from "@/lib/ai/department-budget";
import { createAdminClient } from "@/lib/supabase/admin";
import { MARKETING_AGENT_MAP } from "@/lib/marketing/agents";

type DailyPlan = {
  campaign: { name: string; objective: string; thesis: string };
  summary: string;
  tasks: Array<{ title: string; priority: number; agent: string; status: string; owner_minutes: number; action: string }>;
  content: Array<{
    title: string;
    format: "reel" | "carousel" | "story" | "static";
    pillar: string;
    hypothesis: string;
    hook: string;
    script: string;
    caption: string;
    cta: string;
    creative_brief: string;
    priority: number;
  }>;
};

const string = { type: "string" };
const integer = { type: "integer" };
const DAILY_PLAN_SCHEMA: Record<string, unknown> = {
  type: "object", additionalProperties: false,
  required: ["campaign", "summary", "tasks", "content"],
  properties: {
    campaign: { type: "object", additionalProperties: false, required: ["name","objective","thesis"], properties: { name: string, objective: string, thesis: string } },
    summary: string,
    tasks: { type: "array", items: { type: "object", additionalProperties: false, required: ["title","priority","agent","status","owner_minutes","action"], properties: { title: string, priority: integer, agent: string, status: string, owner_minutes: integer, action: string } } },
    content: { type: "array", items: { type: "object", additionalProperties: false, required: ["title","format","pillar","hypothesis","hook","script","caption","cta","creative_brief","priority"], properties: {
      title: string, format: { type: "string", enum: ["reel","carousel","story","static"] }, pillar: string, hypothesis: string, hook: string, script: string, caption: string, cta: string, creative_brief: string, priority: integer,
    } } },
  },
};

export async function ensureDailyMarketingPlanForOwner(ownerId: string) {
  if (!isOpenAIConfigured()) return { status: "skipped", reason: "OpenAI is not configured" };
  const admin = createAdminClient();
  const local = newYorkClock();
  if (local.hour < 6) return { status: "skipped", reason: "Morning planning window has not opened", date: local.date };

  const { data: existing, error: existingError } = await admin.from("marketing_daily_plans")
    .select("id,campaign_id,plan_date,status").eq("owner_id", ownerId).eq("plan_date", local.date).maybeSingle();
  if (existingError) throw existingError;
  if (existing) return { status: "reused", planId: existing.id, date: local.date };

  await assertDepartmentCanSpend(admin, ownerId, "growth", 8);
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const [{ count: recentReels }, metrics, learnings] = await Promise.all([
    admin.from("marketing_content_items").select("id", { count: "exact", head: true }).eq("owner_id", ownerId).eq("format", "reel").gte("created_at", sevenDaysAgo),
    admin.from("marketing_daily_metrics").select("metric_date,followers,reach,likes,comments,shares,saves,profile_visits,website_clicks,signups").eq("owner_id", ownerId).order("metric_date", { ascending: false }).limit(3),
    admin.from("marketing_learnings").select("title,learning,impact_score").eq("owner_id", ownerId).order("impact_score", { ascending: false }).limit(5),
  ]);
  const reelsAllowed = Number(recentReels || 0) === 0;
  const prompt = `Create Project You+'s Instagram growth plan for ${local.date}.

The brand is a premium AI life operating system for ambitious adults. Daily content should feel like a restrained global technology campaign: intelligent, minimal, dark/violet, editorial, product-truthful and highly shareable. Avoid generic motivation, productivity listicles, hustle clichés, fake testimonials, UGC-style AI actors, fake interfaces and generated logos.

Create exactly 4 content items. Use mostly static/editorial posts, carousels and stories. ${reelsAllowed ? "You may include at most one Reel only if it is clearly the strongest idea of the week." : "Do not create a Reel because a Reel already exists in the current 7-day production window."} A Reel must be product-led motion typography with real Project You+ UI added in editing.

Recent metrics: ${JSON.stringify(metrics.data || [])}
Validated learnings: ${JSON.stringify(learnings.data || [])}

Keep captions under 60 words. Keep Reel scripts under 80 words. Creative briefs must explicitly state that generated media is supporting/background art only and that real Project You+ UI and the approved logo are added separately. Create 4 practical tasks. Do not invent live trend facts or performance.`;

  const startedAt = new Date().toISOString();
  const { data: run, error: runError } = await admin.from("marketing_agent_runs").insert({
    owner_id: ownerId, agent_id: "orchestrator", status: "running", task_type: "daily_plan",
    objective: "Create the daily premium Instagram production plan", started_at: startedAt,
    metadata: { type: "automatic_daily_plan", automatic: true, run_date: local.date, agent_name: "Atlas", execution_provider: "openai" },
  }).select("id").single();
  if (runError) throw runError;
  await recordEstimatedSpend(admin, ownerId, "growth", 8, "orchestrator", "automatic_daily_plan");

  try {
    const { value: plan, raw } = await callOpenAIStructuredText<DailyPlan>({
      instructions: MARKETING_AGENT_MAP.orchestrator.systemPrompt,
      messages: [{ role: "user", content: prompt }],
      schemaName: "marketing_daily_runtime_plan", schema: DAILY_PLAN_SCHEMA,
      maxOutputTokens: 3200, reasoningEffort: "medium", timeoutMs: 40_000,
    });
    const { data: campaign, error: campaignError } = await admin.from("marketing_campaigns").insert({
      owner_id: ownerId, name: plan.campaign.name, objective: plan.campaign.objective, channel: "instagram", status: "active",
      metadata: { thesis: plan.campaign.thesis, source: "automatic_daily_plan", date: local.date },
    }).select("id").single();
    if (campaignError) throw campaignError;

    const contentRows = plan.content.map((item) => ({
      owner_id: ownerId, campaign_id: campaign.id, title: item.title, format: item.format, pillar: item.pillar,
      stage: "production", sub_status: "creative_review", approval_status: "pending", assigned_agent_id: "creative",
      next_action: "Run Muse to review the creative package", source_agent_id: "orchestrator",
      hook: item.hook, script: item.script, caption: item.caption, cta: item.cta, creative_brief: item.creative_brief,
      hypothesis: item.hypothesis, priority: Math.max(1, Math.min(10, item.priority)),
      score: Math.max(60, Math.min(98, 100 - item.priority * 3)), metrics: { source: "automatic_daily_plan", plan_date: local.date },
    }));
    const { error: contentError } = await admin.from("marketing_content_items").insert(contentRows);
    if (contentError) throw contentError;

    const { data: savedPlan, error: planError } = await admin.from("marketing_daily_plans").insert({
      owner_id: ownerId, campaign_id: campaign.id, plan_date: local.date, objective: plan.campaign.objective,
      summary: plan.summary, tasks: plan.tasks, status: "active", updated_at: new Date().toISOString(),
    }).select("id").single();
    if (planError?.code === "23505") return { status: "reused", date: local.date };
    if (planError) throw planError;

    await admin.from("marketing_agent_runs").update({ status: "completed", output: raw, finished_at: new Date().toISOString(), metadata: { type: "automatic_daily_plan", automatic: true, run_date: local.date, campaign_id: campaign.id, agent_name: "Atlas", execution_provider: "openai" } }).eq("id", run.id);
    await admin.from("marketing_activity_events").insert({ owner_id: ownerId, campaign_id: campaign.id, agent_id: "orchestrator", event_type: "daily_plan_created", message: `Atlas created the ${local.date} premium content plan and assigned the creative queue.`, metadata: { plan_id: savedPlan.id, content_count: contentRows.length, reels_allowed: reelsAllowed } });
    return { status: "created", planId: savedPlan.id, campaignId: campaign.id, contentCount: contentRows.length, date: local.date };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Automatic daily planning failed";
    await admin.from("marketing_agent_runs").update({ status: "failed", finished_at: new Date().toISOString(), error_message: message, metadata: { type: "automatic_daily_plan", automatic: true, run_date: local.date, agent_name: "Atlas", error: message } }).eq("id", run.id);
    throw error;
  }
}

function newYorkClock() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
  const get = (type: string) => parts.find((part) => part.type === type)?.value || "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour") || 0) };
}
