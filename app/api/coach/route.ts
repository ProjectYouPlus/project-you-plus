import { NextResponse } from "next/server";
import { buildUnifiedUserContext, compactUnifiedUserContext } from "@/lib/ai/unified-context";
import { orchestrateCoachRequest } from "@/lib/ai/user-orchestrator";
import { callProjectYouAI, hasCloudAI } from "@/lib/ai/provider";
import { PROJECT_YOU_SYSTEM } from "@/lib/ai/prompts";
import { fallbackCoachReply } from "@/lib/ai/fallbacks";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      message?: string;
      history?: Array<{ role: "user" | "assistant"; content: string }>;
      coachMode?: "decide" | "plan" | "reflect";
    };
    const message = body.message?.trim();
    if (!message) return NextResponse.json({ error: "Message is required" }, { status: 400 });

    const unified = await buildUnifiedUserContext();
    const context = unified.current;
    const orchestration = orchestrateCoachRequest(message, context);
    const history = (body.history ?? []).slice(-12).filter((item) => item.role === "user" || item.role === "assistant");

    if (!hasCloudAI()) {
      return NextResponse.json({ reply: fallbackCoachReply(message, context), mode: "local" });
    }

    try {
      const modeInstruction = body.coachMode === "plan"
        ? "Prefer concrete sequencing, scheduling, and time-block recommendations."
        : body.coachMode === "reflect"
          ? "Prefer pattern recognition, concise interpretation, and one learning to carry forward."
          : "Prefer one clear decision and the next best action.";

      const result = await callProjectYouAI({
        system: `${PROJECT_YOU_SYSTEM}\n\nAUTHORITATIVE UNIFIED PROJECT YOU+ USER CONTEXT:\n${JSON.stringify(compactUnifiedUserContext(unified), null, 2)}\n\nINTERNAL SPECIALIST ORCHESTRATION:\n${orchestration.instructions}\n\nCURRENT COACHING MODE: ${body.coachMode ?? "decide"}. ${modeInstruction}\n\nBehave like one continuous personal operating-system intelligence. Connect domains when the context supports it, but never invent data that is not connected.`,
        messages: [...history, { role: "user", content: message }],
        maxTokens: 900,
      });
      return NextResponse.json({ reply: result.text, mode: result.provider });
    } catch (error) {
      console.error("Cloud coach fallback:", error);
      return NextResponse.json({ reply: fallbackCoachReply(message, context), mode: "local-fallback" });
    }
  } catch (error) {
    console.error("Coach route error:", error);
    return NextResponse.json({ error: "Unable to process coach request" }, { status: 500 });
  }
}
