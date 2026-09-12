import { callOpenAIStructuredText, callOpenAIStructuredVision, isOpenAIConfigured } from "@/lib/ai/openai";
import { createAdminClient } from "@/lib/supabase/admin";
import { MARKETING_AGENT_MAP, type MarketingAgentId } from "@/lib/marketing/agents";

type AdminClient = ReturnType<typeof createAdminClient>;
type Row = Record<string, any>;

type AgentResult = {
  summary: string;
  hook: string;
  script: string;
  caption: string;
  cta: string;
  creative_brief: string;
  decision: "advance" | "revise" | "hold";
  revision_target: "reels" | "copy" | "none";
  revision_notes: string;
  quality_score: number;
};

type VisualReview = { decision: "approve" | "revise"; quality_score: number; diagnosis: string };

const string = { type: "string" };
const AGENT_RESULT_SCHEMA: Record<string, unknown> = {
  type: "object", additionalProperties: false,
  required: ["summary","hook","script","caption","cta","creative_brief","decision","revision_target","revision_notes","quality_score"],
  properties: {
    summary: string, hook: string, script: string, caption: string, cta: string, creative_brief: string,
    decision: { type: "string", enum: ["advance","revise","hold"] },
    revision_target: { type: "string", enum: ["reels","copy","none"] },
    revision_notes: string,
    quality_score: { type: "number" },
  },
};

const VISUAL_REVIEW_SCHEMA: Record<string, unknown> = {
  type: "object", additionalProperties: false,
  required: ["decision","quality_score","diagnosis"],
  properties: {
    decision: { type: "string", enum: ["approve","revise"] },
    quality_score: { type: "number" },
    diagnosis: string,
  },
};

export async function processMarketingAgentQueueForOwner(ownerId: string, maxTasks = 2) {
  if (!isOpenAIConfigured()) return [{ status: "skipped", reason: "OpenAI is not configured" }];
  const admin = createAdminClient();
  const [{ data: candidates, error: contentError }, { data: activeRuns, error: activeError }] = await Promise.all([
    admin.from("marketing_content_items").select("*").eq("owner_id", ownerId).in("stage", ["idea","briefing","production","creative_review"]).neq("approval_status", "approved").order("priority", { ascending: true, nullsFirst: false }).order("updated_at", { ascending: true }).limit(30),
    admin.from("marketing_agent_runs").select("id,content_item_id,agent_id,status,created_at").eq("owner_id", ownerId).in("status", ["queued","running"]).gte("created_at", new Date(Date.now() - 5 * 60_000).toISOString()),
  ]);
  if (contentError) throw contentError;
  if (activeError) throw activeError;
  const activeContentIds = new Set((activeRuns || []).map((run) => run.content_item_id).filter(Boolean));
  const availableLanes = Math.max(0, 3 - (activeRuns || []).length);
  const limit = Math.min(Math.max(0, maxTasks), availableLanes);
  if (!limit) return [];

  const tasks = (candidates || []).map((content) => ({ content, agentId: chooseAgent(content as Row) })).filter((task) => task.agentId && !activeContentIds.has(task.content.id)).slice(0, limit) as Array<{ content: Row; agentId: MarketingAgentId }>;
  const settled = await Promise.allSettled(tasks.map((task) => runContentAgent(admin, ownerId, task.content, task.agentId)));
  return settled.map((result, index) => result.status === "fulfilled" ? result.value : ({ contentItemId: tasks[index]?.content.id, status: "error", error: result.reason instanceof Error ? result.reason.message : String(result.reason) }));
}

function chooseAgent(content: Row): MarketingAgentId | null {
  const assigned = String(content.assigned_agent_id || "");
  if (["reels","creative","copy"].includes(assigned)) return assigned as MarketingAgentId;
  const action = String(content.next_action || "").toLowerCase();
  if (action.includes("signal")) return "copy";
  if (action.includes("muse") || String(content.sub_status || "") === "quality_review") return "creative";
  if (action.includes("frame")) return "reels";
  if (content.stage === "creative_review") return "creative";
  if (content.stage === "idea" || content.stage === "briefing") return content.format === "reel" ? "reels" : "copy";
  if (content.stage === "production") {
    if (content.asset_url) return "creative";
    if (!content.hook || (content.format === "reel" && !content.script)) return "reels";
    if (!content.caption || !content.cta) return "copy";
    if (!content.creative_brief) return "creative";
  }
  return null;
}

async function runContentAgent(admin: AdminClient, ownerId: string, content: Row, agentId: MarketingAgentId) {
  const agent = MARKETING_AGENT_MAP[agentId];
  const shared = await buildSharedContext(admin, ownerId, content);
  const startedAt = new Date().toISOString();
  const { data: run, error: runError } = await admin.from("marketing_agent_runs").insert({
    owner_id: ownerId, content_item_id: content.id, task_type: "content_pipeline", agent_id: agentId,
    status: "running", objective: `Advance ${content.title}`, context: JSON.stringify(shared), started_at: startedAt,
    metadata: { type: "marketing_agent_run", automatic: true, agent_name: agent.name, role: agent.role, current_task: `Automatic production · ${content.title}`, shared_context: shared.summary, execution_provider: "openai" },
  }).select("id").single();
  if (runError) throw runError;
  await logActivity(admin, content, agentId, "agent_started", `${agent.name} started Automatic production · ${content.title}.`, { agent_run_id: run.id });

  try {
    const task = buildTaskPrompt(content, agentId, shared);
    const { value, raw } = await callOpenAIStructuredText<AgentResult>({
      instructions: `${agent.systemPrompt}\nYou are operating inside a shared production pipeline. Respect prior agent work, make one decisive contribution, and do not invent live metrics.`,
      messages: [{ role: "user", content: task }], schemaName: `marketing_${agentId}_runtime_result`, schema: AGENT_RESULT_SCHEMA,
      maxOutputTokens: 1800, reasoningEffort: agentId === "creative" ? "medium" : "low", timeoutMs: 55_000,
    });
    const update = await applyAgentResult(admin, ownerId, content, agentId, value);
    const finishedAt = new Date().toISOString();
    await admin.from("marketing_agent_runs").update({ status: "review", output: raw, finished_at: finishedAt, error_message: null, metadata: { type: "marketing_agent_run", automatic: true, agent_name: agent.name, role: agent.role, current_task: `Automatic production · ${content.title}`, next_action: update.next_action || null, shared_context: shared.summary, execution_provider: "openai", creative_review_decision: value.decision } }).eq("id", run.id);
    await logActivity(admin, content, agentId, "agent_completed", `${agent.name} completed the production step. ${update.next_action || ""}`.trim(), { agent_run_id: run.id, next_agent_id: update.assigned_agent_id || null, execution_provider: "openai" });
    return { contentItemId: content.id, agentId, status: "review", nextAction: update.next_action || null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Marketing agent failed";
    await admin.from("marketing_agent_runs").update({ status: "failed", finished_at: new Date().toISOString(), error_message: message, metadata: { type: "marketing_agent_run", automatic: true, agent_name: agent.name, role: agent.role, error: message } }).eq("id", run.id);
    await logActivity(admin, content, agentId, "agent_failed", `${agent.name} failed: ${message}`, { agent_run_id: run.id });
    throw error;
  }
}

async function applyAgentResult(admin: AdminClient, ownerId: string, content: Row, agentId: MarketingAgentId, result: AgentResult) {
  const now = new Date().toISOString();
  const values: Row = { updated_at: now };
  if (result.hook.trim()) values.hook = result.hook.trim();
  if (result.script.trim()) values.script = result.script.trim();
  if (result.caption.trim()) values.caption = result.caption.trim();
  if (result.cta.trim()) values.cta = result.cta.trim();
  if (result.creative_brief.trim()) values.creative_brief = result.creative_brief.trim();

  if (agentId === "reels") {
    values.stage = "production"; values.sub_status = "copy_pending"; values.assigned_agent_id = "copy"; values.next_action = "Run Signal to prepare the caption and CTA";
  } else if (agentId === "copy") {
    values.stage = "production"; values.sub_status = "creative_review"; values.assigned_agent_id = "creative"; values.next_action = "Run Muse to review the creative package";
  } else if (agentId === "creative") {
    if (content.asset_url) {
      if (content.format !== "reel" && /^https:\/\//.test(String(content.asset_url))) {
        const visual = await reviewImageAsset(String(content.asset_url), content);
        values.quality_score = Math.max(0, Math.min(10, visual.quality_score));
        values.quality_diagnosis = visual.diagnosis;
        values.quality_scores = { ...(content.quality_scores || {}), visual: visual.quality_score, reviewed_by: "openai_vision", reviewed_at: now };
        if (visual.decision === "approve" && visual.quality_score >= 8) {
          values.stage = "ready_for_owner"; values.sub_status = "owner_review"; values.assigned_agent_id = null; values.next_action = "Owner approval"; values.blocked_reason = null;
        } else {
          return await queueGenerationRevision(admin, ownerId, content, values, visual.diagnosis);
        }
      } else {
        values.stage = "creative_review"; values.sub_status = "owner_visual_review"; values.assigned_agent_id = null; values.next_action = "Owner visual review of the Reel"; values.quality_diagnosis = "Video asset exists; owner visual review required before approval.";
      }
    } else if (result.decision === "revise" && revisionCount(content) < 1) {
      const target = result.revision_target === "copy" ? "copy" : "reels";
      values.stage = "production"; values.sub_status = "revision_requested"; values.assigned_agent_id = target; values.next_action = target === "copy" ? "Run Signal to address Muse’s corrections" : "Run Frame to address Muse’s corrections";
      values.metrics = { ...(content.metrics || {}), automatic_revision_count: revisionCount(content) + 1, muse_revision_notes: result.revision_notes };
    } else {
      const queued = await ensureGenerationJob(admin, ownerId, content, result.creative_brief || content.creative_brief || result.summary);
      values.stage = "production"; values.sub_status = queued ? "awaiting_provider" : "provider_already_queued"; values.assigned_agent_id = null; values.generation_provider = "higgsfield"; values.next_action = "Higgsfield generation queued"; values.blocked_reason = null;
    }
  }

  const { data, error } = await admin.from("marketing_content_items").update(values).eq("id", content.id).select("*").single();
  if (error) throw error;
  return data as Row;
}

async function ensureGenerationJob(admin: AdminClient, ownerId: string, content: Row, creativeBrief: string) {
  const { data: existing } = await admin.from("marketing_generation_jobs").select("id,status").eq("content_item_id", content.id).eq("provider", "higgsfield").in("status", ["awaiting_provider","submitted","processing"]).maybeSingle();
  if (existing) return false;
  const prompt = `${creativeBrief}\n\nGenerate background art only. Do not render logos, brand marks, typography, fake UI, or readable text. Approved Project You+ branding and real product UI are added after generation.`;
  const { error } = await admin.from("marketing_generation_jobs").insert({ owner_id: ownerId, campaign_id: content.campaign_id, content_item_id: content.id, agent_id: "reels", provider: "higgsfield", generation_type: content.format === "reel" ? "video" : "image", prompt, estimated_credits: 0, status: "awaiting_provider", metadata: { aspect_ratio: content.format === "reel" ? "9:16" : "4:5", provider_role: "visual generation only", source: "runtime_agent_pipeline" } });
  if (error) throw error;
  return true;
}

async function queueGenerationRevision(admin: AdminClient, ownerId: string, content: Row, values: Row, diagnosis: string) {
  if (revisionCount(content) >= 1) {
    values.stage = "creative_review"; values.sub_status = "owner_visual_review"; values.assigned_agent_id = null; values.next_action = "Owner visual review after one automatic revision"; values.blocked_reason = diagnosis;
    const { data, error } = await admin.from("marketing_content_items").update(values).eq("id", content.id).select("*").single();
    if (error) throw error;
    return data as Row;
  }
  values.metrics = { ...(content.metrics || {}), automatic_revision_count: revisionCount(content) + 1, visual_revision_notes: diagnosis };
  values.stage = "production"; values.sub_status = "awaiting_provider"; values.next_action = "Higgsfield regenerating after Muse visual review"; values.asset_url = null; values.thumbnail_url = null; values.quality_score = null;
  const { data, error } = await admin.from("marketing_content_items").update(values).eq("id", content.id).select("*").single();
  if (error) throw error;
  await ensureGenerationJob(admin, ownerId, data as Row, `${String(data.creative_brief || "")}\nRevision requirement: ${diagnosis}`);
  return data as Row;
}

async function reviewImageAsset(url: string, content: Row): Promise<VisualReview> {
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`Could not load creative for quality review (${response.status})`);
  const mime = response.headers.get("content-type") || "image/jpeg";
  const bytes = new Uint8Array(await response.arrayBuffer());
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  const imageDataUrl = `data:${mime};base64,${btoa(binary)}`;
  return callOpenAIStructuredVision<VisualReview>({
    instructions: "You are Muse, Project You+'s premium creative quality reviewer. Judge the supplied image against a restrained Apple-like dark/violet technology brand. Penalize fake UI, generated logos, unreadable text, clutter, generic AI neon, visual artifacts, weak hierarchy, or anything that feels cheap. Approve only if it is genuinely publication-ready.",
    prompt: `Review this creative for content titled '${content.title}'. Intended brief: ${String(content.creative_brief || "")}. Score 0-10 and require at least 8 to approve.`,
    imageDataUrl, schemaName: "marketing_visual_quality_review", schema: VISUAL_REVIEW_SCHEMA, maxOutputTokens: 500,
  });
}

async function buildSharedContext(admin: AdminClient, ownerId: string, content: Row) {
  const [runs, plans, trends, metrics, learnings] = await Promise.all([
    admin.from("marketing_agent_runs").select("id,agent_id,status,output,metadata,created_at").eq("owner_id", ownerId).order("created_at", { ascending: false }).limit(8),
    admin.from("marketing_daily_plans").select("plan_date,objective,summary,tasks,status").eq("owner_id", ownerId).order("plan_date", { ascending: false }).limit(1),
    admin.from("marketing_trend_signals").select("title,opportunity,relevance_score,brand_fit_score,status").eq("owner_id", ownerId).order("created_at", { ascending: false }).limit(5),
    admin.from("marketing_daily_metrics").select("metric_date,followers,reach,likes,comments,shares,saves,profile_visits,website_clicks,signups").eq("owner_id", ownerId).order("metric_date", { ascending: false }).limit(3),
    admin.from("marketing_learnings").select("title,learning,impact_score,status").eq("owner_id", ownerId).order("impact_score", { ascending: false }).limit(5),
  ]);
  const sourceRuns = (runs.data || []).filter((run) => run.content_item_id === content.id || run.metadata?.content_item_id === content.id).slice(0, 5);
  return {
    content: { id: content.id, title: content.title, format: content.format, pillar: content.pillar, stage: content.stage, sub_status: content.sub_status, hook: content.hook, script: content.script, caption: content.caption, cta: content.cta, creative_brief: content.creative_brief, hypothesis: content.hypothesis, next_action: content.next_action, owner_notes: content.owner_notes },
    recent_content_runs: sourceRuns.map((run) => ({ agent_id: run.agent_id, output: String(run.output || "").slice(0, 2200), created_at: run.created_at })),
    daily_plan: plans.data?.[0] || null, trends: trends.data || [], metrics: metrics.data || [], learnings: learnings.data || [],
    summary: { source_run_ids: sourceRuns.map((run) => run.id), source_agent_ids: [...new Set(sourceRuns.map((run) => run.agent_id))], record_counts: { plans: plans.data?.length || 0, trends: trends.data?.length || 0, metrics: metrics.data?.length || 0, learnings: learnings.data?.length || 0 } },
  };
}

function buildTaskPrompt(content: Row, agentId: MarketingAgentId, shared: Row) {
  const instructions = agentId === "reels"
    ? "Produce or revise the motion/reel production package. Reels are premium motion-typography/product-led pieces, not fake UGC. Keep the spoken/script text concise and executable."
    : agentId === "copy"
      ? "Produce or revise the hook, caption and CTA. Preserve product truth and the premium concise voice."
      : "Review the complete creative package. Request at most one automatic revision. If it is strategically coherent and generation-ready, advance it. Do not fabricate visual inspection if no asset exists.";
  return `${instructions}\n\nCurrent content:\n${JSON.stringify(shared.content)}\n\nShared team context:\n${JSON.stringify({ recent_content_runs: shared.recent_content_runs, daily_plan: shared.daily_plan, trends: shared.trends, metrics: shared.metrics, learnings: shared.learnings })}\n\nReturn the structured result. Empty strings are allowed for fields you are not changing. Quality score is for the written/creative package only unless you were explicitly given a visual.`;
}

function revisionCount(content: Row) { return Number(content.metrics?.automatic_revision_count || 0); }

async function logActivity(admin: AdminClient, content: Row, agentId: string, eventType: string, message: string, metadata: Row) {
  await admin.from("marketing_activity_events").insert({ owner_id: content.owner_id, campaign_id: content.campaign_id, content_item_id: content.id, agent_id: agentId, event_type: eventType, message, metadata });
}
