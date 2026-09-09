import { NextResponse } from "next/server";
import { buildProjectYouContext } from "@/lib/ai/context";
import { callProjectYouAI, hasCloudAI } from "@/lib/ai/provider";
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
  if (!hasCloudAI()) return NextResponse.json({ plan: fallbackRunMyDay(context), mode: "local" });

  try {
    const result = await callProjectYouAI({
      system: runMyDayPrompt(context),
      messages: [{ role: "user", content: "Generate my optimized day now." }],
      maxTokens: 1000,
    });
    const parsed = parsePlan(result.text);
    return NextResponse.json({ plan: parsed ?? fallbackRunMyDay(context), mode: parsed ? result.provider : "local-fallback" });
  } catch (error) {
    console.error("Run My Day cloud fallback:", error);
    return NextResponse.json({ plan: fallbackRunMyDay(context), mode: "local-fallback" });
  }
}
