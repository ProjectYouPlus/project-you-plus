import { NextResponse } from "next/server";
import { callOpenAIText, isOpenAIConfigured } from "@/lib/ai/openai";
import { assertDepartmentCanSpend, recordEstimatedSpend } from "@/lib/ai/department-budget";
import { MARKETING_AGENT_MAP, type MarketingAgentId } from "@/lib/marketing/agents";
import { checkMarketingRunLimit, MARKETING_DEPARTMENT_DAILY_LIMIT, utcDayStart } from "@/lib/marketing/run-limits";
import { requireMarketingOwner } from "@/lib/marketing/server";

const AGENT_DAILY_LIMIT = 12;
const AGENT_COOLDOWN_MS = 30_000;

export async function POST(request: Request) {
  const { supabase, user, allowed } = await requireMarketingOwner();
  if (!allowed || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isOpenAIConfigured()) return NextResponse.json({ error: "OPENAI_API_KEY is not configured." }, { status: 503 });

  const body = (await request.json()) as { agentId?: MarketingAgentId; context?: string; objective?: string };
  const agentId = body.agentId || "orchestrator";
  const agent = MARKETING_AGENT_MAP[agentId];
  if (!agent) return NextResponse.json({ error: "Unknown marketing agent." }, { status: 400 });

  let runId: string | null = null;
  try {
    await assertDepartmentCanSpend(supabase, user.id, "growth", 2);
    const { data: setting } = await supabase.from("marketing_agent_settings").select("enabled").eq("owner_id", user.id).eq("agent_id", agentId).maybeSingle();
    if (setting?.enabled === false) return NextResponse.json({ error: `${agent.name} is turned off.` }, { status: 429 });

    const { data: todayRuns, error: runsError } = await supabase
      .from("marketing_agent_runs")
      .select("agent_id,status,created_at")
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
    const agentRuns = (todayRuns || []).filter((run) => run.agent_id === agentId);
    const decision = checkMarketingRunLimit(agentRuns, {
      dailyLimit: AGENT_DAILY_LIMIT,
      cooldownMs: AGENT_COOLDOWN_MS,
    });
    if (!decision.allowed) {
      return NextResponse.json(
        { error: decision.message, retryAfterSeconds: decision.retryAfterSeconds },
        { status: 429, headers: { "Retry-After": String(decision.retryAfterSeconds) } }
      );
    }

    const { data: run, error: runError } = await supabase.from("marketing_agent_runs").insert({
      owner_id: user.id,
      agent_id: agentId,
      status: "running",
      objective: body.objective || null,
      context: body.context || null,
      metadata: { type: "marketing_agent_run", agent_name: agent.name, role: agent.role },
    }).select("id").single();
    if (runError?.code === "23505") {
      return NextResponse.json(
        { error: "The Growth Department already has a run in progress.", retryAfterSeconds: 60 },
        { status: 429, headers: { "Retry-After": "60" } }
      );
    }
    if (runError) throw runError;
    runId = run.id;

    // Reserve the estimate before the AI call so failures and retries cannot bypass the monthly cap.
    await recordEstimatedSpend(supabase, user.id, "growth", 2, agentId, "marketing_agent_run");

    const task = [
      `Today is ${new Date().toISOString().slice(0, 10)}.`,
      body.objective ? `Owner objective: ${body.objective}` : "Owner objective: Grow Project You+ organically on Instagram and create qualified demand.",
      body.context ? `Current context:\n${body.context}` : "Use the current Project You+ positioning and produce an execution-ready result.",
      "Return a concise, execution-ready deliverable. Use headings and bullets. State assumptions instead of inventing live data.",
    ].join("\n\n");

    const output = await callOpenAIText({
      instructions: agent.systemPrompt,
      messages: [{ role: "user", content: task }],
      maxOutputTokens: agentId === "orchestrator" ? 1600 : 1200,
      reasoningEffort: agentId === "orchestrator" || agentId === "strategy" || agentId === "analytics" ? "medium" : "low",
      timeoutMs: 60_000,
    });

    const { error: updateError } = await supabase.from("marketing_agent_runs").update({
      status: "review",
      output,
      metadata: { type: "marketing_agent_run", agent_name: agent.name, role: agent.role },
    }).eq("id", runId);
    if (updateError) throw updateError;

    return NextResponse.json({
      agentId,
      agentName: agent.name,
      role: agent.role,
      output,
      generatedAt: new Date().toISOString(),
      persisted: true,
    });
  } catch (error) {
    console.error("Marketing agent run failed", error);
    const message = error instanceof Error ? error.message : "Agent run failed.";
    if (runId) {
      await supabase.from("marketing_agent_runs").update({
        status: "failed",
        metadata: { type: "marketing_agent_run", agent_name: agent.name, role: agent.role, error: message },
      }).eq("id", runId);
    }
    const status = message.includes("turned off") || message.includes("budget reached") ? 429 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
