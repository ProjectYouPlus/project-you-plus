import { NextResponse } from "next/server";
import { orchestrateCoach } from "@/lib/ai/orchestrator";
import { fallbackWeeklyReview } from "@/lib/ai/fallbacks";
import { buildCoachContext } from "@/lib/coach/context";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST() {
  const supabase = await createClient();
  const { error: reconcileError } = await supabase.rpc("reconcile_behavior_events");
  if (reconcileError) console.error("Behavior event reconciliation failed:", reconcileError.message);
  const message="What changed this week? Explain the strongest real pattern, the most important gap, and the next action.";
  const bundle=await buildCoachContext({message,history:[],mode:"reflect"});
  const base = fallbackWeeklyReview(bundle.context);
  try {
    const result=await orchestrateCoach({message,history:[],mode:"reflect",bundle});
    return NextResponse.json({review:{...base,biggestOpportunity:result.reply},mode:result.provider,recommendations:result.recommendations});
  } catch (error) {
    console.error("Weekly review orchestration fallback:", error);
    return NextResponse.json({ review: base, mode: "local-fallback" });
  }
}
