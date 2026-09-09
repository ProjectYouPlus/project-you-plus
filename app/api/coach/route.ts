import { NextResponse } from "next/server";
import { buildProjectYouContext } from "@/lib/ai/context";
import { callClaude, isClaudeConfigured } from "@/lib/ai/anthropic";
import { coachSystemWithContext } from "@/lib/ai/prompts";
import { fallbackCoachReply } from "@/lib/ai/fallbacks";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { message?: string; history?: Array<{ role: "user" | "assistant"; content: string }>; coachMode?: "decide" | "plan" | "reflect" };
    const message = body.message?.trim();
    if (!message) return NextResponse.json({ error: "Message is required" }, { status: 400 });

    const context = await buildProjectYouContext();

    if (!isClaudeConfigured()) {
      return NextResponse.json({ reply: fallbackCoachReply(message, context), mode: "local" });
    }

    try {
      const history = (body.history ?? []).slice(-8).filter((item) => item.role === "user" || item.role === "assistant");
      const reply = await callClaude({
        system: `${coachSystemWithContext(context)}\n\nCURRENT COACHING MODE: ${body.coachMode ?? "decide"}. ${body.coachMode === "plan" ? "Prefer concrete sequencing and time-block recommendations." : body.coachMode === "reflect" ? "Prefer pattern recognition, concise interpretation, and one learning to carry forward." : "Prefer one clear decision and the next best action."}`,
        messages: [...history, { role: "user", content: message }],
        maxTokens: 700,
        temperature: 0.25,
      });
      return NextResponse.json({ reply, mode: "claude" });
    } catch (error) {
      console.error("Claude coach fallback:", error);
      return NextResponse.json({ reply: fallbackCoachReply(message, context), mode: "local-fallback" });
    }
  } catch (error) {
    console.error("Coach route error:", error);
    return NextResponse.json({ error: "Unable to process coach request" }, { status: 500 });
  }
}
