import { NextResponse } from "next/server";
import { buildProjectYouContext } from "@/lib/ai/context";
import { orchestrateCoach } from "@/lib/ai/orchestrator";
import { fallbackCoachReply } from "@/lib/ai/fallbacks";
import { evaluateProgression } from "@/lib/progression/service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      message?: string;
      history?: Array<{ role: "user" | "assistant"; content: string }>;
      coachMode?: "decide" | "plan" | "reflect";
    };
    const message = body.message?.trim().slice(0, 4000);
    if (!message) return NextResponse.json({ error: "Message is required" }, { status: 400 });

    const context = await buildProjectYouContext();
    try {
      const progression=await evaluateProgression(context);
      const progressionData=context.domains.progression.data??{activeGoals:[],state:null};
      context.domains.progression={...context.domains.progression,availability:"available",reason:null,data:{...progressionData,state:{stage:progression.stage,currentScore:progression.currentScore,highestScore:progression.highestScore,coveragePct:progression.coveragePct,sustainedHighDays:progression.sustainedHighDays,onePercentUnlocked:progression.onePercentUnlocked}}};
      const achievementData=context.domains.achievements.data??{completedChallenges:[],unlocked:[]};
      context.domains.achievements={...context.domains.achievements,availability:"available",reason:null,data:{...achievementData,unlocked:progression.achievements.map(item=>({id:item.id,key:item.key,title:item.title,category:item.category,unlockedAt:item.unlockedAt}))}};
    } catch (error) { console.error("Progression evaluation failed:", error); }
    const history = (body.history ?? []).slice(-12).filter((item) => (item.role === "user" || item.role === "assistant") && typeof item.content === "string").map((item) => ({ role: item.role, content: item.content.slice(0, 4000) }));

    try {
      const result = await orchestrateCoach({ message, history, mode: body.coachMode ?? "decide", context });
      return NextResponse.json({ reply: result.reply, mode: result.provider, recommendations: result.recommendations.map(item=>({id:item.id,domain:item.domain,observation:item.observation,suggestedAction:item.suggestedAction,expectedImpact:item.expectedImpact,confidence:item.confidence,state:item.state,actionType:item.actionType})) });
    } catch (error) {
      console.error("Cloud coach fallback:", error);
      return NextResponse.json({ reply: fallbackCoachReply(message, context), mode: "local-fallback" });
    }
  } catch (error) {
    console.error("Coach route error:", error);
    return NextResponse.json({ error: "Unable to process coach request" }, { status: 500 });
  }
}
