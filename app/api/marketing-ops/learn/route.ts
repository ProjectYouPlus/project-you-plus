import { NextResponse } from "next/server";
import { callOpenAIText, isOpenAIConfigured } from "@/lib/ai/openai";
import { assertDepartmentCanSpend, recordEstimatedSpend } from "@/lib/ai/department-budget";
import { MARKETING_AGENT_MAP } from "@/lib/marketing/agents";
import { requireMarketingOwner } from "@/lib/marketing/server";

type Learning = { learning_type: "hook"|"format"|"topic"|"length"|"cta"|"visual"|"audience"|"timing"|"other"; pattern: string; evidence: string; confidence: number; impact_score: number };

function parseJson<T>(raw: string): T {
  return JSON.parse(raw.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim()) as T;
}

export async function POST() {
  const { allowed, user, supabase } = await requireMarketingOwner();
  if (!allowed || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isOpenAIConfigured()) return NextResponse.json({ error: "OPENAI_API_KEY is not configured." }, { status: 503 });

  try { await assertDepartmentCanSpend(supabase, user.id, "growth", 4); }
  catch (error) { const message = error instanceof Error ? error.message : "Growth Department is unavailable."; return NextResponse.json({ error: message }, { status: 429 }); }

  const [{ data: content }, { data: metrics }] = await Promise.all([
    supabase.from("marketing_content_items").select("id,title,format,pillar,hook,caption,script,creative_brief,metrics,published_at").not("published_at", "is", null).order("published_at", { ascending: false }).limit(30),
    supabase.from("marketing_daily_metrics").select("*").order("metric_date", { ascending: false }).limit(30),
  ]);
  if (!content?.length || !metrics?.length) return NextResponse.json({ error: "Publish content and ingest Instagram metrics before generating learnings." }, { status: 400 });

  const prompt = `Analyze Project You+'s recent Instagram performance and extract reusable growth patterns. Do not claim causal certainty from weak evidence.\n\nCONTENT:\n${JSON.stringify(content)}\n\nDAILY METRICS:\n${JSON.stringify(metrics)}\n\nReturn ONLY valid JSON: {"learnings":[{"learning_type":"hook","pattern":"","evidence":"","confidence":75,"impact_score":80}]}. Return 3-8 high-value patterns. Confidence and impact_score are 0-100.`;

  try {
    const raw = await callOpenAIText({ instructions: MARKETING_AGENT_MAP.analytics.systemPrompt, messages: [{ role: "user", content: prompt }], maxOutputTokens: 2200, reasoningEffort: "medium" });
    const parsed = parseJson<{ learnings: Learning[] }>(raw);
    const rows = (parsed.learnings || []).map((x) => ({ ...x, owner_id: user.id, status: x.confidence >= 80 ? "validated" : "testing" }));
    if (rows.length) {
      const { error } = await supabase.from("marketing_learnings").insert(rows);
      if (error) throw error;
    }
    await supabase.from("marketing_agent_runs").insert({ owner_id: user.id, agent_id: "analytics", status: "completed", output: raw, metadata: { type: "performance_learning", learning_count: rows.length } });
    await recordEstimatedSpend(supabase, user.id, "growth", 4, "analytics", "performance_learning");
    return NextResponse.json({ learnings: rows });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Learning engine failed." }, { status: 500 });
  }
}
