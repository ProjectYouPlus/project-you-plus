import { NextResponse } from "next/server";
import { buildProjectYouContext } from "@/lib/ai/context";
import { callClaude, isClaudeConfigured } from "@/lib/ai/anthropic";
import { runMyDayPrompt } from "@/lib/ai/prompts";
import { fallbackRunMyDay } from "@/lib/ai/fallbacks";
import type { RunMyDayPlan } from "@/lib/types";

export const runtime = "nodejs";

function parsePlan(text: string): RunMyDayPlan | null {
  try {
    const cleaned = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
    const parsed = JSON.parse(cleaned) as RunMyDayPlan;
    if (!parsed.explanation || !Array.isArray(parsed.items)) return null;
    return { explanation: parsed.explanation, items: parsed.items.slice(0, 10) };
  } catch {
    return null;
  }
}

export async function POST() {
  const context = await buildProjectYouContext();
  if (!isClaudeConfigured()) return NextResponse.json({ plan: fallbackRunMyDay(context), mode: "local" });

  try {
    const text = await callClaude({
      system: runMyDayPrompt(context),
      messages: [{ role: "user", content: "Generate my optimized day now." }],
      maxTokens: 900,
      temperature: 0.2,
    });
    const plan = parsePlan(text) ?? fallbackRunMyDay(context);
    return NextResponse.json({ plan, mode: parsePlan(text) ? "claude" : "local-fallback" });
  } catch (error) {
    console.error("Run My Day fallback:", error);
    return NextResponse.json({ plan: fallbackRunMyDay(context), mode: "local-fallback" });
  }
}
