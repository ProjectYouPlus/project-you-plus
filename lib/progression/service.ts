import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { UserContext } from "@/lib/ai/context";
import { calculateProgression, type ProgressionSnapshot, type ProgressionTask } from "./calculator";
import { ACHIEVEMENTS, qualifyAchievements } from "./achievements";
import { PROGRESSION_CONFIG } from "./config";
import { ONE_PERCENT_BRAND_ASSET, type ProgressionAchievement, type ProgressionMilestone, type ProgressionState, type RecentWin } from "@/lib/types/progression";
import { dedupeTransactions, normalizedTransactionType } from "@/lib/finance/overview";
import type { FinanceTransaction } from "@/lib/finance/types";

const COMPLETIONS = new Set(["task.completed", "habit.completed", "workout.completed"]);
const WIN_TYPES = new Set(["achievement.unlocked", "milestone.unlocked", "progression.personal_best", "progression.one_percent_earned", "finance.goal_completed"]);

export async function evaluateProgression(context: UserContext): Promise<ProgressionState> {
  const client = await createClient(), { data: { user } } = await client.auth.getUser();
  if (!user) throw new Error("Not signed in.");
  const admin = createAdminClient(), now = new Date(), today = isoDate(now), start = new Date(now); start.setDate(start.getDate() - 100);
  const currentScore = context.score.score.score, coveragePct = context.score.coveragePct;
  const breakdown = { ...context.score.score.breakdown, health: context.domains.health.data?.score ?? null, finance: context.domains.finance.data?.score ?? null };
  await admin.from("score_snapshots").upsert({ user_id: user.id, score: currentScore, coverage_pct: coveragePct, breakdown, captured_on: today }, { onConflict: "user_id,captured_on" });
  const [snapshotsRes, eventsRes, tasksRes, goalsRes, reviewsRes, workoutPlansRes, workoutLogsRes, budgetsRes, txRes, previousRes] = await Promise.all([
    admin.from("score_snapshots").select("score,coverage_pct,breakdown,captured_on").eq("user_id", user.id).gte("captured_on", isoDate(start)).order("captured_on"),
    admin.from("behavior_events").select("id,event_type,occurred_at,source_table,source_id,payload").eq("user_id", user.id).gte("occurred_at", start.toISOString()).order("occurred_at"),
    admin.from("tasks").select("id,title,tier,created_at,completed_at").eq("user_id", user.id).gte("created_at", start.toISOString()),
    admin.from("goals").select("id,status,progress,created_at,updated_at,completed_at").eq("user_id", user.id),
    admin.from("weekly_reviews").select("id,created_at,week_start").eq("user_id", user.id).order("created_at"),
    admin.from("workout_plans").select("id,days_per_week").eq("user_id", user.id),
    admin.from("workout_plan_logs").select("plan_id,session_key,completed_on,status").eq("user_id", user.id).eq("status", "completed").gte("completed_on", isoDate(start)),
    admin.from("budgets").select("monthly_limit,period_start").eq("user_id", user.id),
    admin.from("transactions").select("id,account_id,amount,category,original_category,merchant,occurred_at,pending,transaction_type,provider_transaction_id,pending_transaction_id").eq("user_id", user.id).gte("occurred_at", start.toISOString()).lt("occurred_at", startOfMonth(now).toISOString()),
    admin.from("user_progression").select("*").eq("user_id", user.id).maybeSingle(),
  ]);
  throwErrors(snapshotsRes.error, eventsRes.error, tasksRes.error, workoutPlansRes.error, workoutLogsRes.error, previousRes.error);
  const snapshots: ProgressionSnapshot[] = (snapshotsRes.data ?? []).map((row) => ({ date: String(row.captured_on), score: Number(row.score), coveragePct: Number(row.coverage_pct), domains: scoreDomains(row.breakdown) }));
  const events = eventsRes.data ?? [], activeDays = [...new Set(events.filter((event) => COMPLETIONS.has(event.event_type)).map((event) => String(event.occurred_at).slice(0, 10)))];
  const tasks: ProgressionTask[] = (tasksRes.data ?? []).map((row) => ({ title: String(row.title), tier: String(row.tier), createdAt: String(row.created_at), completedAt: row.completed_at ? String(row.completed_at) : null }));
  const previous = previousRes.data;
  const calculation = calculateProgression({ snapshots, activityDays: activeDays, tasks, previousLevel: previous?.current_level_number == null ? null : Number(previous.current_level_number), previousCalculatedOn: previous?.calculated_at ?? null, now });
  const goalDates = (goalsRes.data ?? []).filter((goal) => goal.status === "completed" || Number(goal.progress) >= 100).map((goal) => String(goal.completed_at ?? goal.updated_at ?? goal.created_at));
  const qualified = qualifyAchievements({
    activeDays,
    goalCompletions: goalDates,
    workoutCompletions: (workoutLogsRes.data ?? []).map((row) => ({ date: String(row.completed_on), planId: String(row.plan_id), sessionKey: String(row.session_key) })),
    workoutPlanTargets: Object.fromEntries((workoutPlansRes.data ?? []).map((row) => [String(row.id), Number(row.days_per_week)])),
    reviewDates: (reviewsRes.data ?? []).map((row) => String(row.created_at ?? row.week_start)),
    onTargetBudgetMonths: onTargetBudgetMonths(budgetsRes.data ?? [], (txRes.data ?? []) as FinanceTransaction[], now),
    scoreSnapshots: snapshots.map((row) => ({ date: row.date, score: row.score, coveragePct: row.coveragePct })),
  });
  for (const achievement of qualified) await unlockAchievement(admin, user.id, achievement);
  const previousHighest = Number(previous?.highest_level ?? previous?.current_level_number ?? 0), highestLevel = Math.max(previousHighest, calculation.level), oldHighestMilestone = nullableNumber(previous?.highest_milestone);
  const reached = PROGRESSION_CONFIG.milestones.filter((milestone) => calculation.level >= milestone.level);
  for (const milestone of reached) await recordMilestone(admin, user.id, milestone.level, milestone.stage, now, calculation.index);
  const highestMilestone = Math.max(oldHighestMilestone ?? 0, ...reached.map((item) => item.level)) || null;
  const onePercentCurrent = calculation.qualifiesForOnePercent && calculation.level === 99, onePercentUnlocked = Boolean(previous?.one_percent_unlocked) || onePercentCurrent, onePercentUnlockedAt = previous?.one_percent_unlocked_at ?? (onePercentCurrent ? now.toISOString() : null);
  await admin.from("user_progression").upsert({ user_id: user.id, current_level: calculation.stage, current_level_number: calculation.level, progression_index: calculation.index, progression_status: calculation.status, highest_level: highestLevel, highest_milestone: highestMilestone, next_milestone: calculation.nextMilestone?.level ?? null, limiting_factors: calculation.limitingFactors, integrity_flags: calculation.integrityFlags, averages: calculation.averages, consistency_pct: calculation.consistency, domain_balance: calculation.domainBalance, domain_floor: calculation.domainFloor, activity_days_90: calculation.activityDays90, calibration_days:new Set(snapshots.map((item)=>item.date)).size, current_score: currentScore, highest_score: Math.max(Number(previous?.highest_score ?? 0), currentScore), coverage_pct: coveragePct, sustained_high_days: snapshots.filter((item) => item.score >= 90).length, one_percent_current: onePercentCurrent, one_percent_unlocked: onePercentUnlocked, one_percent_unlocked_at: onePercentUnlockedAt, calculated_at: now.toISOString(), updated_at: now.toISOString() }, { onConflict: "user_id" });
  const priorToday = await admin.from("progression_history").select("level,progression_index").eq("user_id", user.id).eq("recorded_on", today).maybeSingle();
  if (!priorToday.data || Number(priorToday.data.level) !== calculation.level || Number(priorToday.data.progression_index) !== calculation.index) await admin.from("progression_history").upsert({ user_id: user.id, level: calculation.level, progression_index: calculation.index, stage: calculation.stage, status: calculation.status, reasons: calculation.limitingFactors, recorded_on: today }, { onConflict: "user_id,recorded_on" });
  if (highestLevel > previousHighest) await event(admin, user.id, "progression.personal_best", `progression.personal_best:${highestLevel}`, now.toISOString(), { level: highestLevel });
  if (onePercentCurrent && !previous?.one_percent_unlocked) await event(admin, user.id, "progression.one_percent_earned", "progression.one_percent_earned", now.toISOString(), { level: 99 });
  return loadState(admin, user.id, { level: calculation.level, index: calculation.index, status: calculation.status, stage: calculation.stage, nextMilestone: calculation.nextMilestone, limitingFactors: calculation.limitingFactors, integrityFlags: calculation.integrityFlags, averages: calculation.averages, consistency: calculation.consistency, domainBalance: calculation.domainBalance, domainFloor: calculation.domainFloor, activityDays90: calculation.activityDays90, calibrationDays:new Set(snapshots.map((item)=>item.date)).size, currentScore, coveragePct, highestLevel, highestMilestone, onePercentCurrent, onePercentUnlocked, onePercentUnlockedAt });
}

export async function getStoredProgression(): Promise<ProgressionState | null> {
  const client = await createClient(), { data: { user } } = await client.auth.getUser(); if (!user) return null;
  const admin = createAdminClient(), { data: row } = await admin.from("user_progression").select("*").eq("user_id", user.id).maybeSingle(); if (!row) return null;
  const nextLevel = nullableNumber(row.next_milestone), next = PROGRESSION_CONFIG.milestones.find((item) => item.level === nextLevel) ?? null;
  return loadState(admin, user.id, { level: Number(row.current_level_number), index: Number(row.progression_index), status: row.progression_status, stage: row.current_level, nextMilestone: next, limitingFactors: row.limiting_factors ?? [], integrityFlags: row.integrity_flags ?? [], averages: row.averages ?? {}, consistency: Number(row.consistency_pct), domainBalance: nullableNumber(row.domain_balance), domainFloor: nullableNumber(row.domain_floor), activityDays90: Number(row.activity_days_90), calibrationDays:Number(row.calibration_days), currentScore: Number(row.current_score), coveragePct: Number(row.coverage_pct), highestLevel: Number(row.highest_level), highestMilestone: nullableNumber(row.highest_milestone), onePercentCurrent: Boolean(row.one_percent_current), onePercentUnlocked: Boolean(row.one_percent_unlocked), onePercentUnlockedAt: row.one_percent_unlocked_at });
}

export async function refreshProgressionAfterMutation() {
  try { const { buildUserContext } = await import("@/lib/ai/context"); await evaluateProgression(await buildUserContext()); }
  catch (error) { console.error("Progression refresh failed:", error); }
}

type StateCore = Omit<ProgressionState, "achievements" | "milestones" | "recentWins" | "brandAsset">;
async function loadState(admin: ReturnType<typeof createAdminClient>, userId: string, core: StateCore): Promise<ProgressionState> {
  const [achievementRes, milestoneRes, winsRes] = await Promise.all([
    admin.from("user_achievements").select("id,achievement_key,title,category,tier,earned_evidence,metadata,unlocked_at").eq("user_id", userId).order("unlocked_at", { ascending: false }),
    admin.from("progression_milestones").select("id,level,stage,reached_at").eq("user_id", userId).order("level", { ascending: false }),
    admin.from("behavior_events").select("id,event_type,occurred_at,payload").eq("user_id", userId).in("event_type", [...WIN_TYPES]).order("occurred_at", { ascending: false }).limit(12),
  ]);
  const definitions = new Map(ACHIEVEMENTS.map((item) => [item.key, item]));
  const achievements: ProgressionAchievement[] = (achievementRes.data ?? []).flatMap((row) => { const definition = definitions.get(row.achievement_key); if (!definition) return []; return [{ id: row.id, key: row.achievement_key, title: definition.title, description: definition.description, category: definition.category, tier: definition.tier, unlockedAt: row.unlocked_at, evidence: row.earned_evidence ?? row.metadata ?? {} }]; });
  const milestones: ProgressionMilestone[] = (milestoneRes.data ?? []).map((row) => ({ id: row.id, level: Number(row.level), stage: row.stage, reachedAt: row.reached_at }));
  const recentWins: RecentWin[] = (winsRes.data ?? []).map((row) => ({ id: row.id, type: row.event_type, occurredAt: row.occurred_at, title: winTitle(row.event_type, row.payload) }));
  return { ...core, achievements, milestones, recentWins, brandAsset: core.onePercentUnlocked ? ONE_PERCENT_BRAND_ASSET : null };
}

async function unlockAchievement(admin: ReturnType<typeof createAdminClient>, userId: string, item: ReturnType<typeof qualifyAchievements>[number]) { const { data } = await admin.from("user_achievements").upsert({ user_id: userId, achievement_key: item.key, title: item.title, category: item.category, tier: item.tier, threshold: null, metadata: {}, earned_evidence: item.evidence, unlocked_at: item.earnedAt }, { onConflict: "user_id,achievement_key", ignoreDuplicates: true }).select("id,unlocked_at").maybeSingle(); if (data) await event(admin, userId, "achievement.unlocked", `achievement.unlocked:progression:${item.key}`, data.unlocked_at, { key: item.key, title: item.title, tier: item.tier }); }
async function recordMilestone(admin: ReturnType<typeof createAdminClient>, userId: string, level: number, stage: string, now: Date, index: number) { const { data } = await admin.from("progression_milestones").upsert({ user_id: userId, level, stage, reached_at: now.toISOString(), evidence: { progressionIndex: index } }, { onConflict: "user_id,level", ignoreDuplicates: true }).select("id,reached_at").maybeSingle(); if (data) await event(admin, userId, "milestone.unlocked", `milestone.unlocked:progression:${level}`, data.reached_at, { level, stage, title: `${level} — ${stage}` }); }
async function event(admin: ReturnType<typeof createAdminClient>, userId: string, eventType: string, dedupeKey: string, occurredAt: string, payload: Record<string, unknown>) { await admin.from("behavior_events").upsert({ user_id: userId, event_type: eventType, occurred_at: occurredAt, source_table: "user_progression", source_id: null, dedupe_key: dedupeKey, payload }, { onConflict: "user_id,dedupe_key", ignoreDuplicates: true }); }
function scoreDomains(value: unknown) { const row = value && typeof value === "object" ? value as Record<string, unknown> : {}, result: Record<string, number> = {}; for (const [key, item] of Object.entries(row)) if (typeof item === "number" && Number.isFinite(item) && key !== "financeScore") result[key] = item; return result; }
function onTargetBudgetMonths(budgets: Array<{ monthly_limit: unknown; period_start: string }>, transactions: FinanceTransaction[], now: Date) {
  const currentMonth = startOfMonth(now).toISOString().slice(0, 7);
  const limits = new Map<string, number>();
  for (const budget of budgets) {
    const month = String(budget.period_start).slice(0, 7);
    if (month >= currentMonth) continue;
    limits.set(month, (limits.get(month) ?? 0) + Number(budget.monthly_limit || 0));
  }
  const qualified: string[] = [];
  for (const [month, limit] of limits) {
    const rows = dedupeTransactions(transactions).filter((row) => !row.pending && String(row.occurred_at).slice(0, 7) === month);
    const meaningful = rows.filter((row) => ["expense", "refund", "income"].includes(normalizedTransactionType(row)));
    const spend = Math.max(0, meaningful.reduce((sum, row) => {
      const type = normalizedTransactionType(row);
      if (type === "expense") return sum + Math.max(0, -Number(row.amount));
      if (type === "refund") return sum - Math.max(0, Number(row.amount));
      return sum;
    }, 0));
    if (limit > 0 && meaningful.length > 0 && spend <= limit) qualified.push(month);
  }
  return qualified.sort();
}
function startOfMonth(date: Date) { return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)); }
function nullableNumber(value: unknown) { return value == null ? null : Number(value); }
function winTitle(type: string, payload: unknown) { const row = payload && typeof payload === "object" ? payload as Record<string, unknown> : {}; if (typeof row.title === "string") return row.title; if (type === "progression.personal_best") return `New personal best: Level ${row.level}`; if (type === "progression.one_percent_earned") return "1% earned"; if (type === "finance.goal_completed") return "Financial goal completed"; return type === "achievement.unlocked" ? "Achievement unlocked" : "Milestone reached"; }
function throwErrors(...errors: Array<{ message: string } | null>) { const error = errors.find(Boolean); if (error) throw new Error(error.message); }
function isoDate(date: Date) { return date.toISOString().slice(0, 10); }
