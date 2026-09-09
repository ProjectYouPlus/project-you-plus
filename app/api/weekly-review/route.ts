import { NextResponse } from "next/server";
import { buildProjectYouContext } from "@/lib/ai/context";
import { callClaude, isClaudeConfigured } from "@/lib/ai/anthropic";
import { weeklyReviewPrompt } from "@/lib/ai/prompts";
import { fallbackWeeklyReview } from "@/lib/ai/fallbacks";

export const runtime = "nodejs";

export async function POST() {
  const context = await buildProjectYouContext();
  const base = fallbackWeeklyReview(context);
  if (!isClaudeConfigured()) return NextResponse.json({ review: base, mode: "local" });

  try {
    const text = await callClaude({
      system: weeklyReviewPrompt(context),
      messages: [{ role: "user", content: "Generate this week's review." }],
      maxTokens: 650,
      temperature: 0.2,
    });
    const cleaned = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
    const ai = JSON.parse(cleaned) as Partial<typeof base>;
    return NextResponse.json({
      review: {
        ...base,
        whatWentWell: ai.whatWentWell || base.whatWentWell,
        needsAttention: ai.needsAttention || base.needsAttention,
        biggestOpportunity: ai.biggestOpportunity || base.biggestOpportunity,
        nextWeekPlan: Array.isArray(ai.nextWeekPlan) ? ai.nextWeekPlan.slice(0, 4) : base.nextWeekPlan,
      },
      mode: "claude",
    });
  } catch (error) {
    console.error("Weekly review fallback:", error);
    return NextResponse.json({ review: base, mode: "local-fallback" });
  }
}
