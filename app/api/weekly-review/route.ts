import { NextResponse } from "next/server";
import { buildProjectYouContext } from "@/lib/ai/context";
import { callProjectYouAI, hasCloudAI } from "@/lib/ai/provider";
import { weeklyReviewPrompt } from "@/lib/ai/prompts";
import { fallbackWeeklyReview } from "@/lib/ai/fallbacks";

export const runtime = "nodejs";

export async function POST() {
  const context = await buildProjectYouContext();
  const base = fallbackWeeklyReview(context);
  if (!hasCloudAI()) return NextResponse.json({ review: base, mode: "local" });

  try {
    const result = await callProjectYouAI({
      system: weeklyReviewPrompt(context),
      messages: [{ role: "user", content: "Generate this week's review." }],
      maxTokens: 800,
    });
    const cleaned = result.text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
    const ai = JSON.parse(cleaned) as Partial<typeof base>;
    return NextResponse.json({
      review: {
        ...base,
        whatWentWell: ai.whatWentWell || base.whatWentWell,
        needsAttention: ai.needsAttention || base.needsAttention,
        biggestOpportunity: ai.biggestOpportunity || base.biggestOpportunity,
        nextWeekPlan: Array.isArray(ai.nextWeekPlan) ? ai.nextWeekPlan.slice(0, 4) : base.nextWeekPlan,
      },
      mode: result.provider,
    });
  } catch (error) {
    console.error("Weekly review cloud fallback:", error);
    return NextResponse.json({ review: base, mode: "local-fallback" });
  }
}
