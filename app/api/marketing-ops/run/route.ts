import { NextResponse } from "next/server";
import { callOpenAIText, isOpenAIConfigured } from "@/lib/ai/openai";
import { MARKETING_AGENT_MAP, type MarketingAgentId } from "@/lib/marketing/agents";
import { createClient } from "@/lib/supabase/server";

function ownerEmails() {
  return (process.env.PROJECT_YOU_OWNER_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

async function requireOwner() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const allowlist = ownerEmails();
  const email = user?.email?.toLowerCase();
  return Boolean(user && email && allowlist.length > 0 && allowlist.includes(email));
}

export async function POST(request: Request) {
  if (!(await requireOwner())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isOpenAIConfigured()) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not configured." },
      { status: 503 }
    );
  }

  const body = (await request.json()) as {
    agentId?: MarketingAgentId;
    context?: string;
    objective?: string;
  };

  const agentId = body.agentId || "orchestrator";
  const agent = MARKETING_AGENT_MAP[agentId];
  if (!agent) {
    return NextResponse.json({ error: "Unknown marketing agent." }, { status: 400 });
  }

  const task = [
    `Today is ${new Date().toISOString().slice(0, 10)}.`,
    body.objective ? `Owner objective: ${body.objective}` : "Owner objective: Grow Project You+ organically on Instagram and create qualified demand.",
    body.context ? `Current context:\n${body.context}` : "Use the current Project You+ positioning and produce an execution-ready result.",
    "Return a concise, execution-ready deliverable. Use headings and bullets. State assumptions instead of inventing live data.",
  ].join("\n\n");

  try {
    const output = await callOpenAIText({
      instructions: agent.systemPrompt,
      messages: [{ role: "user", content: task }],
      maxOutputTokens: agentId === "orchestrator" ? 1600 : 1200,
      reasoningEffort: agentId === "orchestrator" || agentId === "strategy" || agentId === "analytics" ? "medium" : "low",
    });

    return NextResponse.json({
      agentId,
      agentName: agent.name,
      role: agent.role,
      output,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Marketing agent run failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Agent run failed." },
      { status: 500 }
    );
  }
}
