import type { SupabaseClient } from "@supabase/supabase-js";
import type { ScoreExplanation } from "@/lib/score";
import { recordUserEvent } from "@/lib/ai/user-events";

export type ProgressionLevel = "starting" | "foundation" | "momentum" | "alignment" | "elite" | "one_percent";

const SCORE_ACHIEVEMENTS = [55, 65, 75, 85, 95] as const;
const MILESTONES = [60, 70, 80, 90] as const;

// Score alone never awards The 1%. That level is gated separately by sustained, calibrated performance.
export function levelForScore(score: number): Exclude<ProgressionLevel, "one_percent"> {
  if (score >= 90) return "elite";
  if (score >= 80) return "alignment";
  if (score >= 70) return "momentum";
  if (score >= 60) return "foundation";
  return "starting";
}

export async function syncProgression(supabase: SupabaseClient, userId: string, explanation: ScoreExplanation) {
  const today = new Date().toISOString().slice(0, 10);
  const score = explanation.score.score;

  await supabase.from("score_snapshots").upsert({
    user_id: userId,
    score,
    coverage_pct: explanation.coveragePct,
    breakdown: explanation.score.breakdown,
    captured_on: today,
  }, { onConflict: "user_id,captured_on" });

  const { data: history } = await supabase
    .from("score_snapshots")
    .select("score,coverage_pct,captured_on")
    .eq("user_id", userId)
    .order("captured_on", { ascending: false })
    .limit(30);

  const rows = history ?? [];
  const sustainedHighDays = consecutiveQualifiedDays(rows);
  const distinctDomains = Object.keys(explanation.score.breakdown).filter((key) => explanation.score.breakdown[key] > 0).length;
  const onePercentEligible = score >= 99 && explanation.coveragePct >= 85 && distinctDomains >= 4 && sustainedHighDays >= 14;

  const { data: current } = await supabase
    .from("user_progression")
    .select("highest_score,one_percent_unlocked,one_percent_unlocked_at")
    .eq("user_id", userId)
    .maybeSingle();

  const wasOnePercent = Boolean(current?.one_percent_unlocked);
  const unlocked = onePercentEligible || wasOnePercent;
  const progressionPatch: Record<string, unknown> = {
    user_id: userId,
    current_level: unlocked ? "one_percent" : levelForScore(score),
    highest_score: Math.max(Number(current?.highest_score ?? 0), score),
    current_score: score,
    coverage_pct: explanation.coveragePct,
    sustained_high_days: sustainedHighDays,
    one_percent_unlocked: unlocked,
    updated_at: new Date().toISOString(),
  };
  if (onePercentEligible && !wasOnePercent) progressionPatch.one_percent_unlocked_at = new Date().toISOString();
  else if (current?.one_percent_unlocked_at) progressionPatch.one_percent_unlocked_at = current.one_percent_unlocked_at;

  await supabase.from("user_progression").upsert(progressionPatch, { onConflict: "user_id" });

  await unlockScoreAchievements(supabase, userId, score);
  if (onePercentEligible && !wasOnePercent) {
    await unlockAchievement(supabase, userId, "one_percent", "The 1%", "elite", 99, {
      score,
      coveragePct: explanation.coveragePct,
      sustainedHighDays,
      distinctDomains,
      assetHint: "existing 1% logo in source",
    });
  }

  return { currentLevel: unlocked ? "one_percent" : levelForScore(score), onePercentEligible, sustainedHighDays, distinctDomains };
}

async function unlockScoreAchievements(supabase: SupabaseClient, userId: string, score: number) {
  for (const threshold of SCORE_ACHIEVEMENTS) {
    if (score >= threshold) await unlockAchievement(supabase, userId, `score_${threshold}`, `${threshold} Trajectory`, "score", threshold);
  }
  for (const threshold of MILESTONES) {
    if (score >= threshold) await unlockAchievement(supabase, userId, `milestone_${threshold}`, milestoneTitle(threshold), "milestone", threshold);
  }
}

export async function unlockBehaviorAchievement(
  supabase: SupabaseClient,
  userId: string,
  key: string,
  title: string,
  metadata: Record<string, unknown> = {},
) {
  return unlockAchievement(supabase, userId, key, title, "behavior", null, metadata);
}

async function unlockAchievement(
  supabase: SupabaseClient,
  userId: string,
  key: string,
  title: string,
  category: "score" | "milestone" | "behavior" | "elite",
  threshold: number | null,
  metadata: Record<string, unknown> = {},
) {
  const { data, error } = await supabase.from("user_achievements").upsert({
    user_id: userId,
    achievement_key: key,
    title,
    category,
    threshold,
    metadata,
  }, { onConflict: "user_id,achievement_key", ignoreDuplicates: true }).select("id").maybeSingle();
  if (error) return false;
  if (!data?.id) return false;
  await recordUserEvent(supabase, {
    userId,
    eventName: category === "milestone" || category === "elite" ? "milestone.unlocked" : "achievement.unlocked",
    domain: "progress",
    entityType: "achievement",
    entityId: data.id,
    value: threshold,
    metadata: { key, title, category, ...metadata },
  });
  return true;
}

function consecutiveQualifiedDays(rows: Array<{ score: unknown; coverage_pct: unknown; captured_on: string }>) {
  if (!rows.length) return 0;
  let run = 0;
  let previousDate: Date | null = null;
  for (const row of rows) {
    if (Number(row.score) < 95 || Number(row.coverage_pct) < 80) break;
    const date = new Date(`${row.captured_on}T12:00:00Z`);
    if (previousDate) {
      const diffDays = Math.round((previousDate.getTime() - date.getTime()) / 86_400_000);
      if (diffDays !== 1) break;
    }
    run += 1;
    previousDate = date;
  }
  return run;
}

function milestoneTitle(threshold: number) {
  if (threshold === 60) return "Foundation";
  if (threshold === 70) return "Momentum";
  if (threshold === 80) return "Alignment";
  if (threshold === 90) return "Elite";
  return `${threshold} Milestone`;
}
