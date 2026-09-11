import { NextResponse } from "next/server";
import { callOpenAIText, isOpenAIConfigured } from "@/lib/ai/openai";
import { assertDepartmentCanSpend, recordEstimatedSpend } from "@/lib/ai/department-budget";
import { MARKETING_AGENT_MAP } from "@/lib/marketing/agents";
import { requireMarketingOwner } from "@/lib/marketing/server";

function parseJson<T>(raw: string): T {
  return JSON.parse(raw.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim()) as T;
}

function startOfWeek() {
  const date = new Date();
  const day = date.getUTCDay();
  date.setUTCDate(date.getUTCDate() - ((day + 6) % 7));
  return date.toISOString().slice(0, 10);
}

export async function POST() {
  const { allowed, user, supabase } = await requireMarketingOwner();
  if (!allowed || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isOpenAIConfigured()) return NextResponse.json({ error: "OPENAI_API_KEY is not configured." }, { status: 503 });

  try {
    await assertDepartmentCanSpend(supabase, user.id, "growth", 5);
    const since = new Date(Date.now() - 7 * 86400000).toISOString();
    const [content, metrics, community, partnerships, learnings, experiments] = await Promise.all([
      supabase.from("marketing_content_items").select("title,format,stage,hook,cta,metrics,published_at").gte("created_at", since),
      supabase.from("marketing_daily_metrics").select("*").gte("metric_date", since.slice(0, 10)).order("metric_date"),
      supabase.from("marketing_community_actions").select("action_type,context,status,metadata").gte("created_at", since),
      supabase.from("marketing_partnerships").select("name,category,status,fit_score,collaboration_idea").gte("updated_at", since),
      supabase.from("marketing_learnings").select("learning_type,pattern,evidence,confidence,status").gte("created_at", since),
      supabase.from("marketing_experiments").select("name,hypothesis,status,winner,impact_percent,evidence").gte("updated_at", since),
    ]);
    const evidence = { content: content.data || [], metrics: metrics.data || [], community: community.data || [], partnerships: partnerships.data || [], learnings: learnings.data || [], experiments: experiments.data || [] };
    const raw = await callOpenAIText({
      instructions: `${MARKETING_AGENT_MAP.orchestrator.systemPrompt} Produce a factual weekly review. Treat absent fields as unavailable. Never invent performance, audience, creator or experiment results.`,
      messages: [{ role: "user", content: `Review the last seven days of Project You+ growth operations.\nEVIDENCE:\n${JSON.stringify(evidence)}\n\nReturn ONLY valid JSON with keys: executive_summary, what_grew, what_failed, best_content, worst_content, audience_signals, winning_patterns, experiments_completed, creator_pipeline, community_insights, next_week_hypotheses, next_week_content_strategy, founder_recording, owner_decisions. Each value must be a string or array of concise strings. Use "Unavailable" when evidence does not support a conclusion.` }],
      maxOutputTokens: 2400,
      reasoningEffort: "medium",
    });
    const review = parseJson<Record<string, string | string[]>>(raw);
    const weekStart = startOfWeek();
    const { data, error } = await supabase.from("marketing_weekly_reviews").upsert({ owner_id: user.id, week_start: weekStart, executive_summary: String(review.executive_summary || ""), review }, { onConflict: "owner_id,week_start" }).select("*").single();
    if (error) throw error;
    await supabase.from("marketing_agent_runs").insert({ owner_id: user.id, agent_id: "orchestrator", status: "completed", objective: "Weekly Growth Review", output: raw, metadata: { type: "weekly_growth_review", agent_name: "Atlas" } });
    await recordEstimatedSpend(supabase, user.id, "growth", 5, "orchestrator", "weekly_growth_review");
    return NextResponse.json({ review: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Weekly review failed.";
    return NextResponse.json({ error: message }, { status: message.includes("turned off") || message.includes("budget reached") ? 429 : 500 });
  }
}
