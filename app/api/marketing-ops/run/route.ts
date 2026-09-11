import { NextResponse } from "next/server";
import { callOpenAIText, isOpenAIConfigured } from "@/lib/ai/openai";
import { assertDepartmentCanSpend, recordEstimatedSpend } from "@/lib/ai/department-budget";
import { MARKETING_AGENT_MAP, type MarketingAgentId } from "@/lib/marketing/agents";
import { requireMarketingOwner } from "@/lib/marketing/server";

export async function POST(request: Request) {
  const { supabase, user, allowed } = await requireMarketingOwner();
  if (!allowed || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isOpenAIConfigured()) return NextResponse.json({ error: "OPENAI_API_KEY is not configured." }, { status: 503 });

  const body = (await request.json()) as { agentId?: MarketingAgentId; context?: string; objective?: string };
  const agentId = body.agentId || "orchestrator";
  const agent = MARKETING_AGENT_MAP[agentId];
  if (!agent) return NextResponse.json({ error: "Unknown marketing agent." }, { status: 400 });

  try {
    await assertDepartmentCanSpend(supabase, user.id, "growth", 2);
    const { data: setting } = await supabase.from("marketing_agent_settings").select("enabled").eq("owner_id", user.id).eq("agent_id", agentId).maybeSingle();
    if (setting?.enabled === false) return NextResponse.json({ error: `${agent.name} is turned off.` }, { status: 429 });

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
    });

    const { error: insertError } = await supabase.from("marketing_agent_runs").insert({
      owner_id: user.id,
      agent_id: agentId,
      status: "review",
      objective: body.objective || null,
      context: body.context || null,
      output,
      metadata: { agent_name: agent.name, role: agent.role },
    });

    await recordEstimatedSpend(supabase, user.id, "growth", 2, agentId, "marketing_agent_run");
    if (insertError) console.warn("Marketing agent run was generated but not persisted", insertError.message);

    return NextResponse.json({
      agentId,
      agentName: agent.name,
      role: agent.role,
      output,
      generatedAt: new Date().toISOString(),
      persisted: !insertError,
    });
  } catch (error) {
    console.error("Marketing agent run failed", error);
    const message = error instanceof Error ? error.message : "Agent run failed.";
    const status = message.includes("turned off") || message.includes("budget reached") ? 429 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
