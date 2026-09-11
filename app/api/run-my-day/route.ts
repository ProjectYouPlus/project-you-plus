import { NextResponse } from "next/server";
import { orchestrateCoach } from "@/lib/ai/orchestrator";
import { buildCoachContext } from "@/lib/coach/context";
import { fallbackRunMyDay } from "@/lib/ai/fallbacks";
import type { RunMyDayPlan } from "@/lib/types";

export const runtime = "nodejs";

export async function POST() {
  const message="What should I do today? Build the clearest plan around my real priorities and fixed commitments.";
  const bundle=await buildCoachContext({message,history:[],mode:"plan"});
  const base=fallbackRunMyDay(bundle.context);
  try {
    const result=await orchestrateCoach({message,history:[],mode:"plan",bundle});
    const plan:RunMyDayPlan={...base,explanation:result.reply};return NextResponse.json({plan,mode:result.provider,recommendations:result.recommendations});
  } catch (error) {
    console.error("Run My Day orchestration fallback:", error);
    return NextResponse.json({ plan: base, mode: "local-fallback" });
  }
}
