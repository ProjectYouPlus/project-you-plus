import { NextResponse } from "next/server";
import { buildProjectYouContext } from "@/lib/ai/context";
import { orchestrateCoach } from "@/lib/ai/orchestrator";
import { fallbackWeeklyReview } from "@/lib/ai/fallbacks";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST() {
  const supabase = await createClient();
  const { error: reconcileError } = await supabase.rpc("reconcile_behavior_events");
  if (reconcileError) console.error("Behavior event reconciliation failed:", reconcileError.message);
  const context = await buildProjectYouContext();
  const base = fallbackWeeklyReview(context);
  try {
    const result=await orchestrateCoach({message:"Review this week. Explain the strongest real pattern, the most important gap, and the next action.",history:[],mode:"reflect",context});
    return NextResponse.json({review:{...base,biggestOpportunity:result.reply},mode:result.provider,recommendations:result.recommendations});
  } catch (error) {
    console.error("Weekly review orchestration fallback:", error);
    return NextResponse.json({ review: base, mode: "local-fallback" });
  }
}
