import { NextResponse } from "next/server";
import { orchestrateCoach } from "@/lib/ai/orchestrator";
import { fallbackCoachReply } from "@/lib/ai/fallbacks";
import { coachSuggestions } from "@/lib/coach/analysis";
import { buildCoachContext } from "@/lib/coach/context";
import { saveCoachExchange } from "@/lib/coach/conversation";
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

    const history = (body.history ?? []).slice(-12).filter((item) => (item.role === "user" || item.role === "assistant") && typeof item.content === "string").map((item) => ({ role: item.role, content: item.content.slice(0, 4000) }));
    const bundle = await buildCoachContext({ message, history, mode: body.coachMode ?? "decide" });
    const context = bundle.context;
    try {
      const progression=await evaluateProgression(context);
      const progressionData=context.domains.progression.data??{activeGoals:[],state:null};
      context.domains.progression={...context.domains.progression,availability:"available",reason:null,data:{...progressionData,state:{stage:progression.stage,currentScore:progression.currentScore,highestScore:progression.highestScore,coveragePct:progression.coveragePct,sustainedHighDays:progression.sustainedHighDays,onePercentUnlocked:progression.onePercentUnlocked}}};
      const achievementData=context.domains.achievements.data??{completedChallenges:[],unlocked:[]};
      context.domains.achievements={...context.domains.achievements,availability:"available",reason:null,data:{...achievementData,unlocked:progression.achievements.map(item=>({id:item.id,key:item.key,title:item.title,category:item.category,unlockedAt:item.unlockedAt}))}};
      bundle.snapshot.stable.progression=context.domains.progression.data;
    } catch (error) { console.error("Progression evaluation failed:", error); }

    try {
      const result = await orchestrateCoach({ message, history, mode: body.coachMode ?? "decide", bundle });
      await saveCoachExchange(context.profile.id,message,result.reply).catch(error=>console.error("Coach conversation save failed:",error));
      return NextResponse.json({ reply: result.reply, mode: result.provider, intent:bundle.intent, specialists:bundle.specialists.length, suggestions:coachSuggestions(bundle.snapshot), recommendations: result.recommendations.map(item=>({id:item.id,domain:item.domain,observation:item.observation,reasonItMatters:item.reasonItMatters,suggestedAction:item.suggestedAction,expectedImpact:item.expectedImpact,confidence:item.confidence,state:item.state,actionType:item.actionType,actionPayload:item.actionPayload})) });
    } catch (error) {
      console.error("Cloud coach fallback:", error);
      const reply=fallbackCoachReply(message, context);
      await saveCoachExchange(context.profile.id,message,reply).catch(saveError=>console.error("Coach conversation save failed:",saveError));
      return NextResponse.json({ reply, mode: "local-fallback", intent:bundle.intent, suggestions:coachSuggestions(bundle.snapshot), recommendations:[] });
    }
  } catch (error) {
    console.error("Coach route error:", error);
    return NextResponse.json({ error: "Unable to process coach request" }, { status: 500 });
  }
}
