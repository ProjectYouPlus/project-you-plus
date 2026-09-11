import { createClient } from "@/lib/supabase/server";
import { getRecentUserEvents } from "@/lib/ai/user-events";
import { syncProgression } from "@/lib/ai/progression";
import type { ProjectYouContext } from "@/lib/ai/context";

export interface LongitudinalIntelligenceContext {
  userId: string | null;
  recentEvents: Awaited<ReturnType<typeof getRecentUserEvents>>;
  achievements: Array<{ key: string; title: string; category: string; threshold: number | null; unlockedAt: string }>;
  progression: null | {
    currentLevel: string;
    highestScore: number;
    currentScore: number;
    coveragePct: number;
    sustainedHighDays: number;
    onePercentUnlocked: boolean;
  };
  recentScores: Array<{ score: number; coveragePct: number; capturedOn: string }>;
  recommendations: Array<{
    id: string;
    domain: string;
    observation: string;
    reason: string;
    suggestedAction: string;
    expectedImpact: string | null;
    confidence: string;
    status: string;
  }>;
}

export async function buildLongitudinalIntelligenceContext(context: ProjectYouContext): Promise<LongitudinalIntelligenceContext> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return emptyContext();

  // Syncing here makes the deterministic score history available to Coach without creating a second scoring system.
  try {
    await syncProgression(supabase, user.id, context.score);
  } catch (error) {
    console.error("Progression sync skipped:", error);
  }

  const [recentEvents, achievementsRes, progressionRes, scoresRes, recommendationsRes] = await Promise.all([
    getRecentUserEvents(supabase, user.id, 30, 100),
    supabase.from("user_achievements").select("achievement_key,title,category,threshold,unlocked_at").eq("user_id", user.id).order("unlocked_at", { ascending: false }).limit(30),
    supabase.from("user_progression").select("current_level,highest_score,current_score,coverage_pct,sustained_high_days,one_percent_unlocked").eq("user_id", user.id).maybeSingle(),
    supabase.from("score_snapshots").select("score,coverage_pct,captured_on").eq("user_id", user.id).order("captured_on", { ascending: false }).limit(30),
    supabase.from("ai_recommendations").select("id,domain,observation,reason,suggested_action,expected_impact,confidence,status").eq("user_id", user.id).eq("status", "pending").order("created_at", { ascending: false }).limit(10),
  ]);

  const progression = progressionRes.data;
  return {
    userId: user.id,
    recentEvents,
    achievements: (achievementsRes.data ?? []).map((item) => ({
      key: item.achievement_key,
      title: item.title,
      category: item.category,
      threshold: item.threshold == null ? null : Number(item.threshold),
      unlockedAt: item.unlocked_at,
    })),
    progression: progression ? {
      currentLevel: progression.current_level,
      highestScore: Number(progression.highest_score ?? 0),
      currentScore: Number(progression.current_score ?? 0),
      coveragePct: Number(progression.coverage_pct ?? 0),
      sustainedHighDays: Number(progression.sustained_high_days ?? 0),
      onePercentUnlocked: Boolean(progression.one_percent_unlocked),
    } : null,
    recentScores: (scoresRes.data ?? []).map((item) => ({ score: Number(item.score), coveragePct: Number(item.coverage_pct), capturedOn: item.captured_on })),
    recommendations: (recommendationsRes.data ?? []).map((item) => ({
      id: item.id,
      domain: item.domain,
      observation: item.observation,
      reason: item.reason,
      suggestedAction: item.suggested_action,
      expectedImpact: item.expected_impact,
      confidence: item.confidence,
      status: item.status,
    })),
  };
}

export function compactLongitudinalContext(context: LongitudinalIntelligenceContext) {
  return {
    progression: context.progression,
    recentScores: context.recentScores.slice(0, 14),
    recentEvents: context.recentEvents.slice(0, 40),
    achievements: context.achievements.slice(0, 20),
    pendingRecommendations: context.recommendations,
  };
}

function emptyContext(): LongitudinalIntelligenceContext {
  return { userId: null, recentEvents: [], achievements: [], progression: null, recentScores: [], recommendations: [] };
}
