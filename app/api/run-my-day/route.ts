import { NextResponse } from "next/server";
import { buildProjectYouContext } from "@/lib/ai/context";
import { orchestrateCoach } from "@/lib/ai/orchestrator";
import { fallbackRunMyDay } from "@/lib/ai/fallbacks";
import type { RunMyDayPlan } from "@/lib/types";

export const runtime = "nodejs";

export async function POST() {
  const context = await buildProjectYouContext();
  const base=fallbackRunMyDay(context);
  try {
    const result=await orchestrateCoach({message:"What should I do today? Build the clearest plan around my real priorities and fixed commitments.",history:[],mode:"plan",context});
    const plan:RunMyDayPlan={...base,explanation:result.reply};return NextResponse.json({plan,mode:result.provider,recommendations:result.recommendations});
  } catch (error) {
    console.error("Run My Day orchestration fallback:", error);
    return NextResponse.json({ plan: base, mode: "local-fallback" });
  }
}
