import "server-only";
import { buildUserContext, type UserContext } from "@/lib/ai/context";
import { createRecommendation, executeRecommendation, updateRecommendationState } from "@/lib/ai/recommendations";
import { evaluateProgression, getStoredProgression } from "@/lib/progression/service";
import { createClient } from "@/lib/supabase/server";
import {
  RESET_SCORE_VERSION,
  RESET_VERSION,
  addLocalDays,
  buildConsistencyTarget,
  buildRecoveryActions,
  calculateDailyCompletion,
  calculateResetDay,
  closeState,
  compareScores,
  completionGate,
  dayDefinition,
  detectEarlyPattern,
  diffLocalDays,
  estimateMinutes,
  localDateInTimezone,
  patternFeedbackState,
  canPromotePatternWithoutFeedback,
  shouldExpirePattern,
  selectMinimumDay,
  selectPriorityActions,
  shouldStartTomorrow,
  surfacePattern,
  zonedLocalTimeToUtc,
  type ClosureActionInput,
  type PlannedResetAction,
  type ResetDayStatus,
} from "@/lib/reset/engine";
import type { Recommendation } from "@/lib/types/recommendations";

const ENROLLMENT_SELECT = "id,user_id,reset_version,source_onboarding_session_id,start_date,timezone,current_day,status,preparation_evening,starting_score,starting_score_coverage,starting_score_version,starting_context_version,completed_day_count,closed_day_count,recovery_count,weekly_review_id,review_opened_at,next_week_resolution,auto_enrolled,error_state,started_at,completed_at,paused_at,created_at,updated_at";
const SNAPSHOT_SELECT = "id,enrollment_id,user_id,local_date,timezone,reset_day,context_version,score_version,planned_actions,priority_action_keys,minimum_day_action_keys,estimated_minutes,morning_summary,day_status,created_at,last_rebuilt_at";
const CLOSURE_SELECT = "id,enrollment_id,user_id,local_date,eligible_actions,eligible_count,completed_count,partial_count,skipped_count,blocked_count,rescheduled_count,completion_percentage,data_quality,main_blocker,user_reflection,coach_summary,tomorrow_preview,evening_summary,starting_score,closing_score,closed_at,created_at,updated_at";

type EnrollmentRow = Record<string, any>;
type SnapshotRow = Record<string, any>;
type ClosureRow = Record<string, any>;

export type ResetView = {
  available: boolean;
  canStartManually: boolean;
  enrollment: EnrollmentRow | null;
  day: number;
  definition: ReturnType<typeof dayDefinition> | null;
  localDate: string | null;
  preparationEvening: boolean;
  snapshot: SnapshotRow | null;
  closure: ClosureRow | null;
  priorities: PlannedResetAction[];
  minimumDay: Array<PlannedResetAction & { recoveryTitle?: string; usesMinimumVersion?: boolean }>;
  recovery: { active: boolean; message: string; actions: Array<PlannedResetAction & { recoveryTitle: string; usesMinimumVersion: boolean }> };
  consistencyTarget: { label: string; target: number; kind: string } | null;
  pattern: Record<string, any> | null;
  patternInsufficient: boolean;
  adjustment: Recommendation | null;
  trajectory: { starting: number | null; current: number | null; movement: number | null; direction: string; confidence: string; stage: string | null; coverage: number | null; status: string; actionsCompleted: number; habitCompletionPct: number | null; workoutsCompleted: number; workoutsPlanned: number; financeActionsCompleted: number; recoveryCount: number; positiveSignal: string; calibratingArea: string } | null;
  weeklyReview: Record<string, any> | null;
};

async function session() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");
  return { supabase, user };
}

export async function getResetView(): Promise<ResetView> {
  const { supabase, user } = await session();
  let enrollment = await loadOpenEnrollment(supabase, user.id);
  if (!enrollment) {
    const { data: profile } = await supabase.from("profiles").select("onboarding_completed").eq("id", user.id).maybeSingle();
    const { count } = await supabase.from("tasks").select("id", { count: "exact", head: true }).eq("user_id", user.id).is("completed_at", null);
    return emptyView(Boolean(profile?.onboarding_completed && (count ?? 0) > 0));
  }
  if (enrollment.status === "pending") enrollment = await activatePendingEnrollment(supabase, enrollment);
  enrollment = await synchronizeTimezoneAndDay(supabase, enrollment);
  const now = new Date(), timezone = enrollment.timezone || "UTC", localDate = localDateInTimezone(now, timezone);
  await markPastSnapshotsMissed(supabase, enrollment.id, localDate);

  const day = calculateResetDay(enrollment.start_date, localDate);
  if (day === 0) {
    const tomorrowDate = String(enrollment.start_date);
    let prepSnapshot = await loadSnapshot(supabase, enrollment.id, tomorrowDate);
    if (!prepSnapshot) prepSnapshot = await createSnapshot(supabase, enrollment, tomorrowDate, 1, false);
    else prepSnapshot = await reconcileSnapshotCompletions(supabase, prepSnapshot);
    const planned = asPlanned(prepSnapshot.planned_actions);
    const priorities = planned.filter((item) => prepSnapshot.priority_action_keys?.includes(item.key));
    const minimum = planned.filter((item) => prepSnapshot.minimum_day_action_keys?.includes(item.key));
    return { ...emptyView(false), available: true, enrollment, day: 0, localDate, preparationEvening: true, definition: null, snapshot: prepSnapshot, priorities, minimumDay: minimum };
  }

  if (day >= 7 && enrollment.status === "active") {
    const { data } = await supabase.from("reset_enrollments").update({ current_day: 7, status: "awaiting_weekly_review", updated_at: now.toISOString() }).eq("id", enrollment.id).select(ENROLLMENT_SELECT).single();
    if (data) enrollment = data;
  }

  await appendEvent(supabase, enrollment.id, "reset.started", { reset_day: day }, `reset.started:${enrollment.id}`);
  await trackActivity(supabase, "reset_day_viewed", { reset_day: day, status: enrollment.status, action_count: null });

  let snapshot = await loadSnapshot(supabase, enrollment.id, localDate);
  if (!snapshot) snapshot = await createSnapshot(supabase, enrollment, localDate, day, false);
  else snapshot = await reconcileSnapshotCompletions(supabase, snapshot);

  const { data: closure } = await supabase.from("reset_daily_closures").select(CLOSURE_SELECT).eq("enrollment_id", enrollment.id).eq("local_date", localDate).maybeSingle();
  const allClosures = await loadClosures(supabase, enrollment.id);
  const returning = await isReturningAfterMiss(enrollment, localDate, allClosures, supabase);

  const planned = asPlanned(snapshot.planned_actions);
  const priorities = planned.filter((item) => snapshot.priority_action_keys?.includes(item.key));
  const minimum = planned.filter((item) => snapshot.minimum_day_action_keys?.includes(item.key));
  const recoveryActions = returning ? buildRecoveryActions(planned) : [];
  const recovery = {
    active: returning,
    message: returning ? (recoveryActions.length ? `${recoveryActions.length} real action${recoveryActions.length === 1 ? "" : "s"} can rebuild momentum today.` : "Today can be a clean return. No extra punishment is added.") : "",
    actions: recoveryActions,
  };

  let consistencyTarget: ResetView["consistencyTarget"] = null;
  if (day >= 3) {
    const context = await buildUserContext();
    consistencyTarget = buildConsistencyTarget({ habits: context.habits, workoutDaysPerWeek: context.training.activePlan?.daysPerWeek ?? null });
  }

  let pattern: Record<string, any> | null = null;
  let patternInsufficient = false;
  if (day >= 4) {
    pattern = await ensurePattern(supabase, enrollment, allClosures, localDate);
    patternInsufficient = !pattern;
  }

  let adjustment: Recommendation | null = null;
  if (day >= 5) adjustment = await ensureDayFiveAdjustment(supabase, enrollment, snapshot, pattern);

  let trajectory: ResetView["trajectory"] = null;
  if (day >= 6) trajectory = await loadTrajectory(supabase, enrollment, day === 6 || day === 7);

  let weeklyReview: Record<string, any> | null = null;
  if (day >= 7) weeklyReview = await ensureWeeklyReview(supabase, enrollment, allClosures, pattern, adjustment);

  return { available: true, canStartManually: false, enrollment, day, definition: dayDefinition(day), localDate, preparationEvening: false, snapshot, closure: closure ?? null, priorities, minimumDay: minimum, recovery, consistencyTarget, pattern, patternInsufficient, adjustment, trajectory, weeklyReview };
}

export async function startResetManually() {
  const { supabase, user } = await session();
  const current = await loadOpenEnrollment(supabase, user.id);
  if (current) return current;
  const [{ data: profile }, { count: openTasks }] = await Promise.all([
    supabase.from("profiles").select("timezone,onboarding_completed").eq("id", user.id).maybeSingle(),
    supabase.from("tasks").select("id", { count: "exact", head: true }).eq("user_id", user.id).is("completed_at", null),
  ]);
  if (!profile?.onboarding_completed) throw new Error("Finish onboarding before starting the Reset.");
  if (!(openTasks ?? 0)) throw new Error("Your system needs at least one real open action before the Reset can start.");
  const { data, error } = await supabase.from("reset_enrollments").insert({ user_id: user.id, reset_version: RESET_VERSION, timezone: profile.timezone ?? "UTC", status: "pending", auto_enrolled: false }).select(ENROLLMENT_SELECT).single();
  if (error) throw new Error(error.message);
  return activatePendingEnrollment(supabase, data);
}

export async function rebuildTodaySnapshot() {
  const { supabase, user } = await session();
  const enrollment = await loadOpenEnrollment(supabase, user.id);
  if (!enrollment?.start_date) throw new Error("No active Reset.");
  const localDate = localDateInTimezone(new Date(), enrollment.timezone);
  const day = calculateResetDay(enrollment.start_date, localDate);
  if (day < 1) throw new Error("Day 1 has not started yet.");
  return createSnapshot(supabase, enrollment, localDate, day, true);
}

export async function closeResetDay(input: { actions: ClosureActionInput[]; blocker?: string | null; reflection?: string | null }) {
  const { supabase, user } = await session();
  const enrollment = await loadOpenEnrollment(supabase, user.id);
  if (!enrollment?.start_date) throw new Error("No active Reset.");
  const localDate = localDateInTimezone(new Date(), enrollment.timezone), day = calculateResetDay(enrollment.start_date, localDate);
  let snapshot = await loadSnapshot(supabase, enrollment.id, localDate);
  if (!snapshot) snapshot = await createSnapshot(supabase, enrollment, localDate, day, false);
  snapshot = await reconcileSnapshotCompletions(supabase, snapshot);
  const planned = asPlanned(snapshot.planned_actions);
  const truth = new Map(planned.map((action) => [action.key, action.completed]));
  const plannedByKey = new Map(planned.map((action) => [action.key, action]));
  const sanitized = input.actions.filter((item) => truth.has(item.key)).map((item) => ({ ...item, status: truth.get(item.key) ? "completed" as const : plannedByKey.get(item.key)?.rescheduled ? "rescheduled" as const : item.status === "completed" ? "partial" as const : item.status }));
  const result = calculateDailyCompletion(planned, sanitized);
  const currentProgression = await getStoredProgression();
  const currentScore = currentProgression?.currentScore ?? null;
  const refreshedContext = await buildUserContext();
  const tomorrowDate = addLocalDays(localDate, 1);
  const tomorrowActions = await plannedActionsForToday(supabase, refreshedContext, tomorrowDate, enrollment.timezone);
  const tomorrowPriorities = selectPriorityActions(tomorrowActions, 3);
  const firstCompletedTitle = planned.find((action) => action.completed)?.title ?? null;
  const recoverySuggestion = result.completionPercentage == null ? "Keep tomorrow simple and use only actions that are actually due." : result.completionPercentage < 50 ? "Use the minimum-day plan tomorrow and protect the highest-value action first." : "Keep tomorrow’s plan stable unless your real schedule changes.";
  const existing = await supabase.from("reset_daily_closures").select("id").eq("enrollment_id", enrollment.id).eq("local_date", localDate).maybeSingle();
  const coachSummary = result.completionPercentage == null
    ? "No validated actions were due today. Closing the day still preserves reflection without creating fake failure."
    : result.completionPercentage === 0
      ? "Today did not go as planned. You still checked in, and the next minimum plan can stay small."
      : `You closed ${result.completionPercentage}% of the actions that were actually due today.`;
  const payload = {
    enrollment_id: enrollment.id, user_id: user.id, local_date: localDate,
    eligible_actions: result.eligibleActions, eligible_count: result.eligibleCount, completed_count: result.completedCount,
    partial_count: result.partialCount, skipped_count: result.skippedCount, blocked_count: result.blockedCount,
    rescheduled_count: result.rescheduledCount, completion_percentage: result.completionPercentage, data_quality: result.dataQuality,
    main_blocker: cleanShort(input.blocker, 80), user_reflection: input.reflection ? { note: cleanShort(input.reflection, 500) } : {}, coach_summary: coachSummary,
    tomorrow_preview: { date: tomorrowDate, actions: tomorrowPriorities.map((action) => ({ key: action.key, title: action.title, minimumVersion: action.minimumVersion })).slice(0,3) },
    evening_summary: { importantWin: firstCompletedTitle, recoverySuggestion },
    starting_score: snapshot.morning_summary?.score ?? currentScore, closing_score: currentScore, closed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  };
  const write = existing.data
    ? supabase.from("reset_daily_closures").update(payload).eq("id", existing.data.id).select(CLOSURE_SELECT).single()
    : supabase.from("reset_daily_closures").insert(payload).select(CLOSURE_SELECT).single();
  const { data: closure, error } = await write;
  if (error) throw new Error(error.message);

  const wasRecovery = Boolean(snapshot.morning_summary?.recovery);
  const recovered = wasRecovery && ((result.completedCount + result.partialCount) > 0);
  const status: ResetDayStatus = recovered ? "recovered" : closeState(result);
  await supabase.from("reset_daily_snapshots").update({ day_status: status }).eq("id", snapshot.id);
  const closures = await loadClosures(supabase, enrollment.id);
  await supabase.from("reset_enrollments").update({
    closed_day_count: closures.length,
    completed_day_count: closures.filter((row) => Number(row.completion_percentage ?? 0) >= 100).length,
    recovery_count: recovered && !existing.data ? Number(enrollment.recovery_count ?? 0) + 1 : enrollment.recovery_count,
    updated_at: new Date().toISOString(),
  }).eq("id", enrollment.id);

  if (recovered && !existing.data) await appendEvent(supabase, enrollment.id, "reset.returned", { reset_day: day, evidence: "completed_or_partial_action" }, `reset.returned:${enrollment.id}:${localDate}`);
  const minimumCount = sanitized.filter((item) => item.status === "minimum").length;
  if (minimumCount > 0) await appendEvent(supabase, enrollment.id, "reset.minimum_day_used", { reset_day: day, minimum_count: minimumCount }, `reset.minimum:${enrollment.id}:${localDate}`);
  await appendEvent(supabase, enrollment.id, "reset.day_closed", { reset_day: day, completion_percentage: result.completionPercentage, data_quality: result.dataQuality }, `reset.closed:${enrollment.id}:${localDate}`);
  await trackActivity(supabase, "reset_day_closed", { reset_day: day, status, action_count: result.eligibleCount, completion_bucket: bucket(result.completionPercentage) });
  await logOperation(supabase, "Daily closure processed", "daily_closure", async () => `Day ${day} closed with ${result.eligibleCount} eligible actions.`);
  return closure;
}

export async function saveDayOneRealism(feeling: "yes" | "mostly" | "too_much" | "too_little") {
  const { supabase, user } = await session();
  const enrollment = await loadOpenEnrollment(supabase, user.id);
  if (!enrollment) throw new Error("No active Reset.");
  const localDate = localDateInTimezone(new Date(), enrollment.timezone);
  const snapshot = await loadSnapshot(supabase, enrollment.id, localDate);
  if (!snapshot) throw new Error("Today is not ready yet.");
  const summary = { ...(snapshot.morning_summary ?? {}), day1_realism: feeling };
  const { error } = await supabase.from("reset_daily_snapshots").update({ morning_summary: summary }).eq("id", snapshot.id);
  if (error) throw new Error(error.message);
}

export async function savePatternFeedback(feedback: "yes" | "partly" | "no" | "need_more_time") {
  const { supabase, user } = await session();
  const enrollment = await loadOpenEnrollment(supabase, user.id);
  if (!enrollment) throw new Error("No active Reset.");
  const { data: pattern } = await supabase.from("reset_patterns").select("*").eq("enrollment_id", enrollment.id).in("status", ["candidate","surfaced","confirmed"]).order("last_observed_date", { ascending: false }).limit(1).maybeSingle();
  if (!pattern) throw new Error("There is not enough evidence for a pattern yet.");
  const next = patternFeedbackState({ feedback, confidence: Number(pattern.confidence), observations: Number(pattern.observation_count) });
  const { error } = await supabase.from("reset_patterns").update({ user_feedback: feedback, status: next.status, confidence: next.confidence, updated_at: new Date().toISOString() }).eq("id", pattern.id);
  if (error) throw new Error(error.message);
  if (next.status === "confirmed" || next.status === "rejected") await appendEvent(supabase, enrollment.id, next.status === "confirmed" ? "reset.pattern_confirmed" : "reset.pattern_rejected", { pattern_type: pattern.pattern_type }, `reset.pattern.${next.status}:${pattern.id}`);
  await trackActivity(supabase, "reset_pattern_reviewed", { reset_day: enrollment.current_day, status: next.status });
}

export async function approveResetAdjustment(recommendationId: string) {
  const { supabase, user } = await session();
  const enrollment = await loadOpenEnrollment(supabase, user.id);
  if (!enrollment) throw new Error("No active Reset.");
  const result = await executeRecommendation(recommendationId);
  await buildUserContext();
  await appendEvent(supabase, enrollment.id, "reset.adjustment_approved", { recommendation_id: result.id, action_type: result.actionType }, `reset.adjustment.approved:${result.id}`);
  await trackActivity(supabase, "reset_adjustment_reviewed", { reset_day: enrollment.current_day, status: "approved" });
  return result;
}

export async function declineResetAdjustment(recommendationId: string) {
  const result = await updateRecommendationState(recommendationId, "dismissed");
  const { supabase, user } = await session();
  const enrollment = await loadOpenEnrollment(supabase, user.id);
  if (enrollment) await trackActivity(supabase, "reset_adjustment_reviewed", { reset_day: enrollment.current_day, status: "dismissed" });
  return result;
}

export async function openFirstWeeklyReview() {
  const { supabase, user } = await session();
  const enrollment = await loadOpenEnrollment(supabase, user.id);
  if (!enrollment) throw new Error("No active Reset.");
  const now = new Date().toISOString();
  await supabase.from("reset_enrollments").update({ review_opened_at: now, updated_at: now }).eq("id", enrollment.id);
  if (enrollment.weekly_review_id) await supabase.from("weekly_reviews").update({ opened_at: now }).eq("id", enrollment.weekly_review_id).eq("user_id", user.id);
  await trackActivity(supabase, "reset_weekly_review_opened", { reset_day: 7, status: "opened" });
}

export async function resolveNextWeek(resolution: "approved" | "keep_current" | "deferred") {
  const { supabase, user } = await session();
  let enrollment = await loadOpenEnrollment(supabase, user.id);
  if (!enrollment?.start_date) throw new Error("No active Reset.");
  let reviewDetails: any = null;
  if (enrollment.weekly_review_id) {
    const { data: review } = await supabase.from("weekly_reviews").select("details").eq("id", enrollment.weekly_review_id).eq("user_id", user.id).maybeSingle();
    reviewDetails = review?.details ?? null;
    await supabase.from("weekly_reviews").update({ next_week_resolution: resolution }).eq("id", enrollment.weekly_review_id).eq("user_id", user.id);
  }
  if (resolution === "approved" && reviewDetails?.nextWeekProposal?.recommendationId) {
    try { await executeRecommendation(String(reviewDetails.nextWeekProposal.recommendationId)); } catch (error) { if (!String(error).includes("no longer active")) throw error; }
  }
  await supabase.from("reset_enrollments").update({ next_week_resolution: resolution, updated_at: new Date().toISOString() }).eq("id", enrollment.id);
  await appendEvent(supabase, enrollment.id, "reset.weekly_review_completed", { resolution }, `reset.weekly_review.completed:${enrollment.id}`);
  await buildUserContext();
  enrollment = { ...enrollment, next_week_resolution: resolution, review_opened_at: enrollment.review_opened_at ?? new Date().toISOString() };
  const localDate = localDateInTimezone(new Date(), enrollment.timezone);
  const progression = await getStoredProgression();
  const ready = completionGate({
    localDate, startDate: enrollment.start_date, reviewGenerated: Boolean(enrollment.weekly_review_id), reviewOpened: Boolean(enrollment.review_opened_at),
    scoreStateValid: Boolean(progression) || enrollment.starting_score == null, nextWeekResolved: true, contextRefreshed: true,
  });
  if (ready) {
    await supabase.from("reset_enrollments").update({ status: "completed", completed_at: new Date().toISOString(), current_day: 7, updated_at: new Date().toISOString() }).eq("id", enrollment.id);
    await appendEvent(supabase, enrollment.id, "reset.completed", { resolution }, `reset.completed:${enrollment.id}`);
    await trackActivity(supabase, "reset_completed", { reset_day: 7, status: "completed" });
  }
  return { completed: ready };
}

export async function saveWeeklyReflection(input: { proudOf?: string | null; harderThanExpected?: string | null; adjustNext?: string | null; note?: string | null }) {
  const { supabase, user } = await session();
  const enrollment = await loadOpenEnrollment(supabase, user.id);
  if (!enrollment?.weekly_review_id) throw new Error("Weekly Review is not ready yet.");
  const reflection = { proudOf: cleanShort(input.proudOf, 80), harderThanExpected: cleanShort(input.harderThanExpected, 80), adjustNext: cleanShort(input.adjustNext, 80), note: cleanShort(input.note, 500) };
  const { error } = await supabase.from("weekly_reviews").update({ user_reflection: reflection }).eq("id", enrollment.weekly_review_id).eq("user_id", user.id);
  if (error) throw new Error(error.message);
}

export async function rescheduleResetTaskToTomorrow(taskId: string) {
  const { supabase, user } = await session();
  const enrollment = await loadOpenEnrollment(supabase, user.id);
  if (!enrollment?.start_date) throw new Error("No active Reset.");
  const localDate = localDateInTimezone(new Date(), enrollment.timezone);
  const snapshot = await loadSnapshot(supabase, enrollment.id, localDate);
  const action = asPlanned(snapshot?.planned_actions).find((item) => item.sourceId === taskId && ["task","finance"].includes(item.sourceType));
  if (!action) throw new Error("That action is not part of today’s Reset plan.");
  const { data: task, error: taskError } = await supabase.from("tasks").select("id,due_at,preferred_time").eq("id", taskId).eq("user_id", user.id).maybeSingle();
  if (taskError || !task) throw new Error(taskError?.message ?? "Task not found.");
  const nextDate = addLocalDays(localDate, 1);
  const localTime = String(task.preferred_time ?? action.preferredTime ?? "09:00").slice(0,5);
  const dueAt = zonedLocalTimeToUtc(nextDate, /^\d{2}:\d{2}$/.test(localTime) ? localTime : "09:00", enrollment.timezone).toISOString();
  const { error } = await supabase.from("tasks").update({ due_at: dueAt }).eq("id", taskId).eq("user_id", user.id);
  if (error) throw new Error(error.message);
  await reconcileSnapshotCompletions(supabase, snapshot);
}

export async function moveResetTaskToBacklog(taskId: string) {
  const { supabase, user } = await session();
  const enrollment = await loadOpenEnrollment(supabase, user.id);
  if (!enrollment?.start_date) throw new Error("No active Reset.");
  const localDate = localDateInTimezone(new Date(), enrollment.timezone);
  const snapshot = await loadSnapshot(supabase, enrollment.id, localDate);
  const action = asPlanned(snapshot?.planned_actions).find((item) => item.sourceId === taskId && ["task","finance"].includes(item.sourceType));
  if (!action) throw new Error("That action is not part of today’s Reset plan.");
  const { error } = await supabase.from("tasks").update({ due_at: null }).eq("id", taskId).eq("user_id", user.id);
  if (error) throw new Error(error.message);
  if (snapshot) await reconcileSnapshotCompletions(supabase, snapshot);
}

export async function pauseResetToday() {
  const { supabase, user } = await session();
  const enrollment = await loadOpenEnrollment(supabase, user.id);
  if (!enrollment?.start_date) throw new Error("No active Reset.");
  const localDate = localDateInTimezone(new Date(), enrollment.timezone);
  let snapshot = await loadSnapshot(supabase, enrollment.id, localDate);
  if (!snapshot) snapshot = await createSnapshot(supabase, enrollment, localDate, calculateResetDay(enrollment.start_date, localDate), false);
  const actions = asPlanned(snapshot.planned_actions).filter((action) => action.due && !action.optional).map((action) => ({ key: action.key, status: action.completed ? "completed" as const : "skipped" as const }));
  return closeResetDay({ actions, blocker: "paused_by_user", reflection: "Paused today without resetting the week." });
}

async function loadOpenEnrollment(supabase: any, userId: string): Promise<EnrollmentRow | null> {
  const { data, error } = await supabase.from("reset_enrollments").select(ENROLLMENT_SELECT).eq("user_id", userId).in("status", ["pending","active","paused","awaiting_weekly_review"]).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function activatePendingEnrollment(supabase: any, enrollment: EnrollmentRow): Promise<EnrollmentRow> {
  const context = await buildUserContext();
  const realOpen = context.tasks.filter((task) => !task.completedAt);
  if (!realOpen.length) return enrollment;
  const profileTimezone = context.profile.timezone || enrollment.timezone || "UTC";
  const now = new Date(), today = localDateInTimezone(now, profileTimezone);
  const sleepTime = context.profile.blueprint?.rhythm?.sleepTime ?? null;
  const roughMinutes = realOpen.slice(0, 3).reduce((sum, task) => sum + (task.durationMinutes ?? 15), 0);
  const prep = shouldStartTomorrow({ now, timezone: profileTimezone, sleepTime, estimatedMinutes: roughMinutes });
  const startDate = prep ? addLocalDays(today, 1) : today;
  const progression = await getStoredProgression();
  const startingScore = progression?.currentScore ?? context.score.score.score ?? null;
  const startingCoverage = progression?.coveragePct ?? context.score.coveragePct ?? null;
  const contextVersion = context.profile.blueprint?.activeSystem?.sourceContextVersion ?? context.generatedAt;
  const { data, error } = await supabase.from("reset_enrollments").update({
    start_date: startDate, timezone: profileTimezone, current_day: 1, status: "active", preparation_evening: prep,
    starting_score: startingScore, starting_score_coverage: startingCoverage, starting_score_version: RESET_SCORE_VERSION,
    starting_context_version: contextVersion, started_at: now.toISOString(), error_state: {}, updated_at: now.toISOString(),
  }).eq("id", enrollment.id).select(ENROLLMENT_SELECT).single();
  if (error) throw new Error(error.message);
  try { await scheduleResetReminders(supabase, data, context); } catch { /* Reminders are optional and never block the Reset. */ }
  await trackActivity(supabase, "reset_started", { reset_day: prep ? 0 : 1, status: prep ? "preparation" : "active" });
  return data;
}

async function synchronizeTimezoneAndDay(supabase: any, enrollment: EnrollmentRow): Promise<EnrollmentRow> {
  if (!enrollment.start_date) return enrollment;
  const { data: profile } = await supabase.from("profiles").select("timezone").eq("id", enrollment.user_id).maybeSingle();
  const nextTimezone = profile?.timezone || enrollment.timezone || "UTC";
  let startDate = enrollment.start_date;
  const now = new Date();
  if (nextTimezone !== enrollment.timezone) {
    const oldLocal = localDateInTimezone(now, enrollment.timezone), oldDay = Math.max(Number(enrollment.current_day ?? 1), calculateResetDay(enrollment.start_date, oldLocal));
    const newLocal = localDateInTimezone(now, nextTimezone);
    startDate = addLocalDays(newLocal, -(oldDay - 1));
  }
  const localDate = localDateInTimezone(now, nextTimezone);
  const day = Math.max(Number(enrollment.current_day ?? 1), calculateResetDay(startDate, localDate) || 1);
  if (day !== enrollment.current_day || nextTimezone !== enrollment.timezone || startDate !== enrollment.start_date) {
    const { data, error } = await supabase.from("reset_enrollments").update({ timezone: nextTimezone, start_date: startDate, current_day: Math.min(7, day), updated_at: now.toISOString() }).eq("id", enrollment.id).select(ENROLLMENT_SELECT).single();
    if (error) throw new Error(error.message);
    if (nextTimezone !== enrollment.timezone) { try { await scheduleResetReminders(supabase, data, await buildUserContext()); } catch { /* Optional reminder refresh failure cannot block the Reset. */ } }
    return data;
  }
  return enrollment;
}

async function createSnapshot(supabase: any, enrollment: EnrollmentRow, localDate: string, day: number, rebuild: boolean): Promise<SnapshotRow> {
  const context = await buildUserContext();
  const actions = await plannedActionsForToday(supabase, context, localDate, enrollment.timezone);
  const priorities = selectPriorityActions(actions, 3), minimum = selectMinimumDay(actions), estimated = estimateMinutes(actions);
  const recovery = await isReturningAfterMiss(enrollment, localDate, await loadClosures(supabase, enrollment.id), supabase);
  const summary = buildMorningSummary(day, priorities, minimum, estimated, recovery, context, localDate, enrollment.timezone);
  const payload = {
    enrollment_id: enrollment.id, user_id: enrollment.user_id, local_date: localDate, timezone: enrollment.timezone, reset_day: Math.max(1, day),
    context_version: context.profile.blueprint?.activeSystem?.sourceContextVersion ?? context.generatedAt, score_version: RESET_SCORE_VERSION,
    planned_actions: actions, priority_action_keys: priorities.map((item) => item.key), minimum_day_action_keys: minimum.map((item) => item.key), estimated_minutes: estimated,
    morning_summary: summary, day_status: "available", last_rebuilt_at: rebuild ? new Date().toISOString() : null,
  };
  const { data: existing } = await supabase.from("reset_daily_snapshots").select("id").eq("enrollment_id", enrollment.id).eq("local_date", localDate).maybeSingle();
  const write = existing && rebuild
    ? supabase.from("reset_daily_snapshots").update(payload).eq("id", existing.id).select(SNAPSHOT_SELECT).single()
    : supabase.from("reset_daily_snapshots").upsert(payload, { onConflict: "enrollment_id,local_date", ignoreDuplicates: true }).select(SNAPSHOT_SELECT).maybeSingle();
  const { data, error } = await write;
  if (error) throw new Error(error.message);
  const snapshot = data ?? await loadSnapshot(supabase, enrollment.id, localDate);
  if (!snapshot) throw new Error("Could not create today’s Reset snapshot.");
  await logOperation(supabase, "Morning summary generated", "morning_summary", async () => `Day ${day} summary generated from ${actions.length} real planned actions.`);
  return snapshot;
}

async function plannedActionsForToday(supabase: any, context: UserContext, localDate: string, timezone: string): Promise<PlannedResetAction[]> {
  const weekday = weekdayForLocalDate(localDate), primaryDomain = String(context.profile.blueprint?.onboarding?.primaryDomain ?? "").toLowerCase();
  const { data: habitLogs } = await supabase.from("habit_logs").select("habit_id,logged_at").eq("logged_at", localDate);
  const loggedHabits = new Set((habitLogs ?? []).map((row: any) => String(row.habit_id)));
  const taskActions: PlannedResetAction[] = context.tasks.flatMap((task) => {
    if (!task.dueAt) return [];
    const dueDate = localDateInTimezone(new Date(task.dueAt), timezone);
    if (dueDate !== localDate) return [];
    const domain = task.domain ?? null;
    return [{ key: `task:${task.id}`, sourceType: domain === "finance" || domain === "money" ? "finance" as const : "task" as const, sourceId: task.id, title: task.title, domain, due: true, completed: Boolean(task.completedAt), isPrimary: task.tier === "critical" || Boolean(primaryDomain && String(domain ?? "").toLowerCase() === primaryDomain), optional: false, durationMinutes: task.durationMinutes ?? null, minimumVersion: task.minimumVersion ?? null, preferredTime: task.preferredTime ?? null }];
  });
  const habitActions: PlannedResetAction[] = context.habits.flatMap((habit) => {
    const preferred = habit.preferredDays ?? [];
    const due = habit.targetFrequency === "daily" || preferred.includes(weekday);
    if (!due) return [];
    return [{ key: `habit:${habit.id}`, sourceType: "habit" as const, sourceId: habit.id, title: habit.title, domain: habit.domain ?? null, due: true, completed: loggedHabits.has(habit.id), isPrimary: Boolean(primaryDomain && String(habit.domain ?? "").toLowerCase() === primaryDomain), optional: false, durationMinutes: habit.durationMinutes ?? null, minimumVersion: habit.minimumVersion ?? null, preferredTime: habit.preferredTime ?? null }];
  });
  const workoutActions: PlannedResetAction[] = [];
  const plan = context.training.activePlan, session = plan?.schedule.find((item) => Number(item.dayIndex) === weekday);
  if (plan && session) {
    const { data: workoutLog } = await supabase.from("workout_plan_logs").select("id,status").eq("plan_id", plan.id).eq("session_key", session.key).eq("completed_on", localDate).eq("status", "completed").limit(1).maybeSingle();
    workoutActions.push({ key: `workout:${plan.id}:${session.key}`, sourceType: "workout", sourceId: `${plan.id}:${session.key}`, title: session.title || "Scheduled workout", domain: "health", due: true, completed: Boolean(workoutLog), isPrimary: primaryDomain === "health", optional: false, durationMinutes: Number(session.duration ?? plan.sessionMinutes ?? 0) || null, minimumVersion: Number(session.duration ?? plan.sessionMinutes ?? 0) > 20 ? "Complete a 15-minute minimum workout" : null, preferredTime: null });
  }
  return [...taskActions, ...habitActions, ...workoutActions];
}

async function reconcileSnapshotCompletions(supabase: any, snapshot: SnapshotRow): Promise<SnapshotRow> {
  const actions = asPlanned(snapshot.planned_actions); if (!actions.length) return snapshot;
  const taskIds = actions.filter((item) => ["task","finance"].includes(item.sourceType) && item.sourceId).map((item) => item.sourceId!);
  const habitIds = actions.filter((item) => item.sourceType === "habit" && item.sourceId).map((item) => item.sourceId!);
  const [{ data: tasks }, { data: habitLogs }] = await Promise.all([
    taskIds.length ? supabase.from("tasks").select("id,completed_at,due_at").in("id", taskIds) : Promise.resolve({ data: [] }),
    habitIds.length ? supabase.from("habit_logs").select("habit_id,logged_at").in("habit_id", habitIds).eq("logged_at", snapshot.local_date) : Promise.resolve({ data: [] }),
  ]);
  const completedTasks = new Set((tasks ?? []).filter((row: any) => row.completed_at).map((row: any) => String(row.id)));
  const taskRows = new Map((tasks ?? []).map((row: any) => [String(row.id), row]));
  const completedHabits = new Set((habitLogs ?? []).map((row: any) => String(row.habit_id)));
  for (const action of actions) {
    if (["task","finance"].includes(action.sourceType) && action.sourceId) { action.completed = completedTasks.has(action.sourceId); const row: any = taskRows.get(action.sourceId); action.rescheduled = Boolean(row?.due_at && localDateInTimezone(new Date(row.due_at), snapshot.timezone) !== snapshot.local_date && !row.completed_at); }
    if (action.sourceType === "habit" && action.sourceId) action.completed = completedHabits.has(action.sourceId);
    if (action.sourceType === "workout" && action.sourceId) {
      const [planId, sessionKey] = action.sourceId.split(":");
      const { data } = await supabase.from("workout_plan_logs").select("id").eq("plan_id", planId).eq("session_key", sessionKey).eq("completed_on", snapshot.local_date).eq("status", "completed").limit(1).maybeSingle();
      action.completed = Boolean(data);
    }
  }
  const { data } = await supabase.from("reset_daily_snapshots").update({ planned_actions: actions }).eq("id", snapshot.id).select(SNAPSHOT_SELECT).single();
  return data ?? { ...snapshot, planned_actions: actions };
}

function buildMorningSummary(day: number, priorities: PlannedResetAction[], minimum: PlannedResetAction[], estimated: number, recovery: boolean, context: UserContext, localDate: string, timezone: string) {
  const definition = dayDefinition(day), primaryGoal = context.goals.find((goal) => goal.status === "active")?.title ?? null;
  const constraints = context.schedule.filter((event) => localDateInTimezone(new Date(event.startAt), timezone) === localDate).slice(0,3).map((event) => ({ id: event.id, title: event.title, startAt: event.startAt, endAt: event.endAt }));
  return {
    headline: definition.headline,
    coach_message: recovery ? "One difficult day did not change the goal. Today is about returning with a realistic minimum." : day === 1 ? "We’re starting with direction, not intensity. Complete the actions that move your highest-priority goal forward." : definition.focus,
    primary_goal: primaryGoal,
    priority_count: priorities.length,
    estimated_minutes: estimated,
    minimum_count: minimum.length,
    schedule_constraints: constraints,
    recovery,
    score: context.domains.progression.data?.state?.currentScore ?? null,
  };
}

async function ensurePattern(supabase: any, enrollment: EnrollmentRow, closures: ClosureRow[], localDate: string) {
  const input = closures.map((row) => ({ completionPercentage: row.completion_percentage == null ? null : Number(row.completion_percentage), blocker: row.main_blocker ?? null, minimumUsed: (row.eligible_actions ?? []).some((item: any) => item.status === "minimum"), closed: true }));
  const candidate = detectEarlyPattern(input);
  if (!candidate) {
    const { data: confirmed } = await supabase.from("reset_patterns").select("*").eq("enrollment_id", enrollment.id).eq("status", "confirmed").order("last_observed_date", { ascending: false }).limit(1).maybeSingle();
    return confirmed ?? null;
  }
  const { data: existing } = await supabase.from("reset_patterns").select("*").eq("enrollment_id", enrollment.id).eq("pattern_key", candidate.key).maybeSingle();
  if (existing?.status === "rejected") return null;
  const surfaced = surfacePattern(candidate);
  let status: "candidate"|"surfaced"|"confirmed"|"expired" = existing?.status === "confirmed" ? "confirmed" : surfaced ? "surfaced" : "candidate";
  if (existing?.status === "confirmed" && shouldExpirePattern(candidate.observations, candidate.confidence)) status = "expired";
  else if (status !== "confirmed" && canPromotePatternWithoutFeedback(candidate.observations, candidate.confidence)) status = "confirmed";
  const payload = { enrollment_id: enrollment.id, user_id: enrollment.user_id, pattern_key: candidate.key, pattern_type: candidate.type, domain: candidate.domain, summary: candidate.summary, supporting_evidence: candidate.evidence, observation_count: candidate.observations, confidence: candidate.confidence, first_detected_date: existing?.first_detected_date ?? localDate, last_observed_date: localDate, status, source_context_version: enrollment.starting_context_version, why_it_matters: candidate.whyItMatters, proposed_adjustment: candidate.proposedAdjustment, updated_at: new Date().toISOString() };
  const { data, error } = await supabase.from("reset_patterns").upsert(payload, { onConflict: "enrollment_id,pattern_key" }).select("*").single();
  if (error) throw new Error(error.message);
  if (status === "surfaced" || status === "confirmed") {
    await appendEvent(supabase, enrollment.id, "reset.pattern_detected", { pattern_type: candidate.type, observations: candidate.observations, confidence_bucket: candidate.confidence >= 0.75 ? "high" : candidate.confidence >= 0.6 ? "medium" : "low" }, `reset.pattern.detected:${data.id}`);
    if (status === "confirmed" && existing?.status !== "confirmed") await appendEvent(supabase, enrollment.id, "reset.pattern_confirmed", { pattern_type: candidate.type, basis: "repeated_support" }, `reset.pattern.confirmed:${data.id}`);
    await logOperation(supabase, "Pattern analysis completed", "pattern_analysis", async () => `Pattern analysis used ${candidate.observations} closed-day observations.`);
  }
  return status === "surfaced" || status === "confirmed" ? data : null;
}

async function ensureDayFiveAdjustment(supabase: any, enrollment: EnrollmentRow, snapshot: SnapshotRow, pattern: Record<string, any> | null): Promise<Recommendation | null> {
  const active = await findResetRecommendation(enrollment.id);
  if (active) return active;
  if (!pattern || pattern.status === "rejected" || pattern.pattern_type !== "repeated_blocker") {
    await logOperation(supabase, "Coach adjustment prepared", "coach_adjustment", async () => "No adjustment was needed from the available evidence.", "blocked");
    return null;
  }
  const actions = asPlanned(snapshot.planned_actions), candidate = actions.find((item) => item.sourceType === "task" && item.sourceId && !item.isPrimary && !item.completed);
  if (!candidate) return null;
  const task = (await supabase.from("tasks").select("id,due_at,title").eq("id", candidate.sourceId).maybeSingle()).data;
  if (!task?.due_at) return null;
  const nextDate = addLocalDays(snapshot.local_date, 1);
  const localClock = candidate.preferredTime ?? clockInTimezone(new Date(task.due_at), enrollment.timezone);
  const dueAt = zonedLocalTimeToUtc(nextDate, localClock, enrollment.timezone).toISOString();
  const recommendation = await createRecommendation({
    domain: "planner", observation: pattern.summary, supportingEvidence: [{ table: "reset_patterns", id: pattern.id, detail: `${pattern.observation_count} observations` }],
    reasonItMatters: pattern.why_it_matters ?? "Repeated friction can make the starting system harder to sustain.",
    suggestedAction: `Move “${candidate.title}” to tomorrow so today keeps its primary focus.`, expectedImpact: "Reduce today’s load without deleting the action or changing the goal.",
    confidence: Number(pattern.confidence) >= 0.75 ? "high" : "medium", relatedEntities: [{ type: "task", id: candidate.sourceId, label: candidate.title }],
    source: "coach", sourceAgent: "coach", dedupeKey: `reset:${enrollment.id}:day5-adjustment`, actionType: "task.reschedule", actionPayload: { taskId: candidate.sourceId, dueAt, resetEnrollmentId: enrollment.id },
  });
  await appendEvent(supabase, enrollment.id, "reset.adjustment_proposed", { recommendation_id: recommendation.id, action_type: recommendation.actionType }, `reset.adjustment.proposed:${recommendation.id}`);
  await logOperation(supabase, "Coach adjustment prepared", "coach_adjustment", async () => "One evidence-based adjustment is ready for user review.");
  return recommendation;
}

async function findResetRecommendation(enrollmentId: string) {
  const { listRecommendations } = await import("@/lib/ai/recommendations");
  const rows = await listRecommendations({ limit: 30 });
  return rows.find((item) => (item.actionPayload as any)?.resetEnrollmentId === enrollmentId) ?? null;
}

async function loadTrajectory(supabase: any, enrollment: EnrollmentRow, recalculate: boolean) {
  let progression = await getStoredProgression();
  if (recalculate) {
    const runId = await beginOperation(supabase, "Trajectory recalculated", "trajectory");
    try {
      progression = await evaluateProgression(await buildUserContext());
      await finishOperation(supabase, runId, "passed", "Trajectory recalculated with the canonical Project You+ score engine.", { reset_day: enrollment.current_day });
    } catch (error) {
      await finishOperation(supabase, runId, "failed", "Trajectory recalculation failed safely; the last valid score remains available.", { error_category: "score_refresh" });
    }
  }
  if (!progression) progression = await getStoredProgression();
  const comparison = compareScores({ starting: enrollment.starting_score == null ? null : Number(enrollment.starting_score), current: progression?.currentScore ?? null, startingVersion: enrollment.starting_score_version, currentVersion: RESET_SCORE_VERSION, startingCoverage: enrollment.starting_score_coverage, currentCoverage: progression?.coveragePct ?? null });
  const [{ data: snapshots }, closures] = await Promise.all([supabase.from("reset_daily_snapshots").select("planned_actions").eq("enrollment_id", enrollment.id), loadClosures(supabase, enrollment.id)]);
  const planned = (snapshots ?? []).flatMap((row: any) => asPlanned(row.planned_actions));
  const eligible = closures.flatMap((row) => row.eligible_actions ?? []);
  const completedKeys = new Set(eligible.filter((row: any) => row.status === "completed").map((row: any) => String(row.key)));
  const habitPlanned = eligible.filter((row: any) => String(row.key).startsWith("habit:")).length, habitCompleted = eligible.filter((row: any) => String(row.key).startsWith("habit:") && row.status === "completed").length;
  const workoutsPlanned = eligible.filter((row: any) => String(row.key).startsWith("workout:")).length, workoutsCompleted = eligible.filter((row: any) => String(row.key).startsWith("workout:") && row.status === "completed").length;
  const financeActionsCompleted = planned.filter((action) => action.sourceType === "finance" && completedKeys.has(action.key)).length;
  const actionsCompleted = closures.reduce((sum, row) => sum + Number(row.completed_count ?? 0), 0);
  const recoveryCount = Number(enrollment.recovery_count ?? 0);
  const positiveSignal = recoveryCount > 0 ? "You returned after a difficult day instead of restarting the week." : workoutsCompleted > 0 ? `You completed ${workoutsCompleted} scheduled training session${workoutsCompleted === 1 ? "" : "s"}.` : actionsCompleted > 0 ? `You completed ${actionsCompleted} planned action${actionsCompleted === 1 ? "" : "s"}.` : "You kept the system available for honest calibration.";
  const calibratingArea = closures.length < 4 ? "Daily consistency needs more closed days before confidence can increase." : habitPlanned > 0 && habitCompleted < habitPlanned ? "Habit consistency is still calibrating against the planned cadence." : "Project You+ is still calibrating which schedule windows are most reliable.";
  return { starting: enrollment.starting_score == null ? null : Number(enrollment.starting_score), current: progression?.currentScore ?? null, movement: comparison.movement, direction: comparison.direction, confidence: comparison.confidence, stage: progression?.stage ?? null, coverage: progression?.coveragePct ?? null, status: progression?.status ?? "calibrating", actionsCompleted, habitCompletionPct: habitPlanned ? Math.round(habitCompleted / habitPlanned * 100) : null, workoutsCompleted, workoutsPlanned, financeActionsCompleted, recoveryCount, positiveSignal, calibratingArea };
}

async function ensureWeeklyReview(supabase: any, enrollment: EnrollmentRow, closures: ClosureRow[], pattern: Record<string, any> | null, adjustment: Recommendation | null) {
  if (enrollment.weekly_review_id) {
    const { data } = await supabase.from("weekly_reviews").select("*").eq("id", enrollment.weekly_review_id).maybeSingle();
    if (data) return data;
  }
  const runId = await beginOperation(supabase, "Weekly Review generated", "weekly_review");
  try {
    const reviewContext = await buildUserContext();
    const progression = await evaluateProgression(reviewContext);
    const startDate = enrollment.start_date, endDate = addLocalDays(startDate, 6);
    const { data: snapshots } = await supabase.from("reset_daily_snapshots").select(SNAPSHOT_SELECT).eq("enrollment_id", enrollment.id).gte("local_date", startDate).lte("local_date", endDate).order("local_date");
    const healthStart = zonedLocalTimeToUtc(startDate, "00:00", enrollment.timezone).toISOString(), healthEnd = zonedLocalTimeToUtc(addLocalDays(endDate, 1), "00:00", enrollment.timezone).toISOString();
    const { data: healthMetrics } = await supabase.from("health_metrics").select("metric_type,value,recorded_at").gte("recorded_at", healthStart).lt("recorded_at", healthEnd).in("metric_type", ["weight","body_weight","body_fat","body_fat_pct","body_composition"]).order("recorded_at");
    const snapshotByDate = new Map((snapshots ?? []).map((row: any) => [String(row.local_date), row]));
    const closureByDate = new Map(closures.map((row) => [String(row.local_date), row]));
    const daily = Array.from({ length: 7 }, (_, index) => {
      const date = addLocalDays(startDate, index), snap: any = snapshotByDate.get(date), close: any = closureByDate.get(date);
      const snapActions = asPlanned(snap?.planned_actions), completedKey = (close?.eligible_actions ?? []).find((item:any) => item.status === "completed")?.key;
      const completedTitle = snapActions.find((item) => item.key === completedKey)?.title ?? null;
      const win = completedTitle ? `Completed: ${completedTitle}` : close?.completed_count > 0 ? `${close.completed_count} planned action${close.completed_count === 1 ? "" : "s"} completed.` : null;
      return { day: index + 1, date, completionPercentage: close?.completion_percentage == null ? null : Number(close.completion_percentage), mainWin: win, mainBlocker: close?.main_blocker ?? null, recoveryAction: snap?.morning_summary?.recovery ? "Returned to a minimum plan." : null, closed: Boolean(close) };
    });
    const flatActions = (snapshots ?? []).flatMap((row: any) => asPlanned(row.planned_actions).map((action) => ({ ...action, date: row.local_date })));
    const taskPlanned = flatActions.filter((item) => ["task","finance"].includes(item.sourceType)).length;
    const habitPlanned = flatActions.filter((item) => item.sourceType === "habit").length;
    const workoutPlanned = flatActions.filter((item) => item.sourceType === "workout").length;
    const eligibleRows = closures.flatMap((row) => (row.eligible_actions ?? []).map((item: any) => ({ ...item, date: row.local_date })));
    const isComplete = (row: any) => row.status === "completed";
    const taskKeys = new Set(flatActions.filter((item) => ["task","finance"].includes(item.sourceType)).map((item) => item.key));
    const habitKeys = new Set(flatActions.filter((item) => item.sourceType === "habit").map((item) => item.key));
    const workoutKeys = new Set(flatActions.filter((item) => item.sourceType === "workout").map((item) => item.key));
    const totalEligible = closures.reduce((sum, row) => sum + Number(row.eligible_count ?? 0), 0), totalCredits = closures.reduce((sum, row) => sum + Number(row.completed_count ?? 0) + Number(row.partial_count ?? 0) * .5, 0);
    const habitBreakdown = new Map<string, { title:string; planned:number; completed:number; minimum:number }>();
    for (const item of flatActions.filter((row) => row.sourceType === "habit")) { const current = habitBreakdown.get(item.key) ?? { title:item.title, planned:0, completed:0, minimum:0 }; current.planned += 1; habitBreakdown.set(item.key,current); }
    for (const row of eligibleRows.filter((item:any) => habitKeys.has(item.key))) { const current = habitBreakdown.get(row.key); if (!current) continue; if (row.status === "completed") current.completed += 1; if (row.status === "minimum") current.minimum += 1; }
    const financeGoal = reviewContext.goals.find((goal) => goal.status === "active" && goal.category === "finance") ?? null;
    const bodyEntries = (healthMetrics ?? []).map((row:any) => ({ metricType: row.metric_type, value: Number(row.value), recordedAt: row.recorded_at }));
    const details = {
      resetVersion: RESET_VERSION,
      trajectory: { startingScore: enrollment.starting_score, currentScore: progression.currentScore, netMovement: enrollment.starting_score == null ? null : progression.currentScore - Number(enrollment.starting_score), confidence: progression.coveragePct >= 75 ? "medium" : "low", stage: progression.stage, status: progression.status },
      taskCompletion: { planned: taskPlanned, completed: eligibleRows.filter((row) => taskKeys.has(row.key) && isComplete(row)).length, partial: eligibleRows.filter((row) => taskKeys.has(row.key) && ["partial","minimum"].includes(row.status)).length, rescheduled: eligibleRows.filter((row) => taskKeys.has(row.key) && row.status === "rescheduled").length, blocked: eligibleRows.filter((row) => taskKeys.has(row.key) && row.status === "blocked").length, completionPercentage: totalEligible ? Math.round(totalCredits / totalEligible * 100) : null },
      habitConsistency: { planned: habitPlanned, completed: eligibleRows.filter((row) => habitKeys.has(row.key) && isComplete(row)).length, minimumVersionsUsed: eligibleRows.filter((row) => habitKeys.has(row.key) && row.status === "minimum").length, recoveryCount: enrollment.recovery_count, byHabit: [...habitBreakdown.values()].map((item) => ({ ...item, completionPercentage: item.planned ? Math.round((item.completed + item.minimum * .5) / item.planned * 100) : null })) },
      training: { planned: workoutPlanned, completed: eligibleRows.filter((row) => workoutKeys.has(row.key) && isComplete(row)).length, totalTrainingMinutes: flatActions.filter((item) => item.sourceType === "workout" && eligibleRows.some((row) => row.key === item.key && isComplete(row))).reduce((sum, item) => sum + Number(item.durationMinutes ?? 0), 0), bodyCompositionEntries: bodyEntries },
      finance: { actionsPlanned: flatActions.filter((item) => item.sourceType === "finance").length, actionsCompleted: eligibleRows.filter((row) => flatActions.some((item) => item.sourceType === "finance" && item.key === row.key) && isComplete(row)).length, amountMovement: null, goal: financeGoal ? { id:financeGoal.id, title:financeGoal.title, progress:financeGoal.progress, target:financeGoal.target } : null },
      patterns: { confirmed: pattern?.status === "confirmed" ? [pattern.summary] : [], earlySignals: pattern && pattern.status !== "rejected" ? [pattern.summary] : [], rejected: pattern?.status === "rejected" ? [pattern.summary] : [], needsMoreEvidence: !pattern },
      dailySummaries: daily,
      coachSummary: buildWeekCoachSummary(closures, pattern),
      nextWeekProposal: adjustment && adjustment.state !== "dismissed" ? { kind: adjustment.state === "completed" ? "keep_approved_adjustment" : "apply_adjustment", changes: [adjustment.suggestedAction], recommendationId: adjustment.id } : { kind: "keep_current", changes: [], recommendationId: null },
    };
    const weekStart = startDate;
    const summary = details.coachSummary;
    const whatWentWell = closures.some((row) => Number(row.completed_count) > 0) ? "You created real completion evidence during the first week." : "You kept the system available for an honest first-week review.";
    const needsAttention = pattern?.summary ?? "Project You+ needs more evidence before making a strong pattern claim.";
    const biggestOpportunity = pattern?.proposed_adjustment ?? "Keep next week manageable and continue calibration.";
    const nextWeekPlan = details.nextWeekProposal;
    const { data: existing } = await supabase.from("weekly_reviews").select("id").eq("user_id", enrollment.user_id).eq("week_start", weekStart).maybeSingle();
    const reviewPayload = { user_id: enrollment.user_id, week_start: weekStart, summary, what_went_well: whatWentWell, needs_attention: needsAttention, biggest_opportunity: biggestOpportunity, next_week_plan: nextWeekPlan, source: "reset", source_key: `reset:${enrollment.id}:week1`, details };
    const write = existing?.id ? supabase.from("weekly_reviews").update(reviewPayload).eq("id", existing.id).select("*").single() : supabase.from("weekly_reviews").insert(reviewPayload).select("*").single();
    const { data: review, error } = await write; if (error) throw new Error(error.message);
    await supabase.from("reset_enrollments").update({ weekly_review_id: review.id, status: "awaiting_weekly_review", updated_at: new Date().toISOString() }).eq("id", enrollment.id);
    await finishOperation(supabase, runId, "passed", "First Weekly Review generated from canonical Reset evidence.", { reset_day: 7 });
    return review;
  } catch (error) {
    await finishOperation(supabase, runId, "failed", "Weekly Review generation failed safely; Reset data was preserved.", { error_category: "generation" });
    throw error;
  }
}

function buildWeekCoachSummary(closures: ClosureRow[], pattern: Record<string, any> | null) {
  if (!closures.length) return "Your first week is still calibrating. There is not enough closed-day evidence to make a strong conclusion yet.";
  const average = Math.round(closures.reduce((sum, row) => sum + Number(row.completion_percentage ?? 0), 0) / closures.length);
  const returnText = closures.some((row) => Number(row.completion_percentage ?? 0) < 50) ? "A difficult day did not erase the rest of the week." : "The week stayed relatively steady.";
  const patternText = pattern ? ` ${pattern.summary}` : " We need more evidence before turning an early signal into a permanent pattern.";
  return `Across ${closures.length} closed day${closures.length === 1 ? "" : "s"}, average closure was ${average}%. ${returnText}${patternText}`;
}

async function loadSnapshot(supabase: any, enrollmentId: string, localDate: string) {
  const { data, error } = await supabase.from("reset_daily_snapshots").select(SNAPSHOT_SELECT).eq("enrollment_id", enrollmentId).eq("local_date", localDate).maybeSingle();
  if (error) throw new Error(error.message); return data;
}
async function loadClosures(supabase: any, enrollmentId: string) { const { data, error } = await supabase.from("reset_daily_closures").select(CLOSURE_SELECT).eq("enrollment_id", enrollmentId).order("local_date"); if (error) throw new Error(error.message); return data ?? []; }
async function markPastSnapshotsMissed(supabase: any, enrollmentId: string, localDate: string) { await supabase.from("reset_daily_snapshots").update({ day_status: "missed" }).eq("enrollment_id", enrollmentId).lt("local_date", localDate).in("day_status", ["available","in_progress"]); }

async function isReturningAfterMiss(enrollment: EnrollmentRow, localDate: string, closures: ClosureRow[], supabase: any) {
  if (!enrollment.start_date || calculateResetDay(enrollment.start_date, localDate) <= 1) return false;
  const yesterday = addLocalDays(localDate, -1);
  const { data: prior } = await supabase.from("reset_daily_snapshots").select("day_status").eq("enrollment_id", enrollment.id).eq("local_date", yesterday).maybeSingle();
  if (prior?.day_status === "missed") return true;
  const lastClosed = closures.at(-1)?.local_date ? String(closures.at(-1).local_date) : null;
  return lastClosed ? diffLocalDays(lastClosed, localDate) > 1 : diffLocalDays(enrollment.start_date, localDate) > 0;
}

async function scheduleResetReminders(supabase: any, enrollment: EnrollmentRow, context: UserContext) {
  const coaching = (context.profile.blueprint?.onboarding?.coachingPreferences ?? {}) as Record<string, any>;
  const weekly = context.profile.blueprint?.onboarding?.weeklyReview;
  const reminderIntent = Boolean(weekly?.reminderIntent ?? coaching.reminders ?? false);
  if (!reminderIntent || !enrollment.start_date) return;
  const checkInTime = String(coaching.checkInTime ?? coaching.check_in_time ?? context.profile.blueprint?.rhythm?.wakeTime ?? "").slice(0,5);
  if (checkInTime && /^\d{2}:\d{2}$/.test(checkInTime)) {
    for (let index = 0; index < 7; index += 1) {
      const date = addLocalDays(enrollment.start_date, index), remindAt = zonedLocalTimeToUtc(date, checkInTime, enrollment.timezone).toISOString();
      await ensureResetReminder(supabase, { user_id: enrollment.user_id, target_type: "reset", target_id: enrollment.id, title: index === 6 ? "Your first week is ready to review." : "Your day is ready.", remind_at: remindAt, recurrence: "once", channel: "in_app", enabled: true, source: "reset", source_key: `reset:${enrollment.id}:morning:${date}` });
    }
  }
  const reviewTime = String(weekly?.time ?? "").slice(0,5);
  if (reviewTime && /^\d{2}:\d{2}$/.test(reviewTime)) {
    const date = addLocalDays(enrollment.start_date, 6), remindAt = zonedLocalTimeToUtc(date, reviewTime, enrollment.timezone).toISOString();
    await ensureResetReminder(supabase, { user_id: enrollment.user_id, target_type: "reset", target_id: enrollment.id, title: "Your first week is ready to review.", remind_at: remindAt, recurrence: "once", channel: "in_app", enabled: true, source: "reset", source_key: `reset:${enrollment.id}:review:${date}` });
  }
}

async function ensureResetReminder(supabase: any, payload: Record<string, unknown> & { source_key: string }) {
  const { data: existing, error: readError } = await supabase.from("reminders").select("id").eq("source_key", payload.source_key).maybeSingle();
  if (readError) throw new Error(readError.message);
  if (existing) { const { error } = await supabase.from("reminders").update(payload).eq("id", existing.id); if (error) throw new Error(error.message); return; }
  const { error } = await supabase.from("reminders").insert(payload);
  if (error && error.code !== "23505") throw new Error(error.message);
}

async function appendEvent(supabase: any, enrollmentId: string, eventType: string, payload: Record<string, unknown>, dedupeKey: string) { const { error } = await supabase.rpc("append_reset_behavior_event", { p_enrollment_id: enrollmentId, p_event_type: eventType, p_payload: payload, p_dedupe_key: dedupeKey }); if (error) throw new Error(error.message); }
async function trackActivity(supabase: any, eventName: string, metadata: Record<string, unknown>) { await supabase.rpc("track_reset_activity", { p_event_name: eventName, p_metadata: { ...metadata, reset_version: RESET_VERSION } }); }
async function beginOperation(supabase: any, title: string, operation: string) { const { data } = await supabase.rpc("begin_reset_ai_operation", { p_title: title, p_operation: operation, p_metadata: {} }); return data as number | null; }
async function finishOperation(supabase: any, runId: number | null, status: "passed"|"failed"|"blocked", summary: string, metadata: Record<string,unknown> = {}) { if (runId != null) await supabase.rpc("finish_reset_ai_operation", { p_run_id: runId, p_status: status, p_summary: summary, p_metadata: metadata }); }
async function logOperation(supabase: any, title: string, operation: string, work: () => Promise<string>, emptyStatus: "blocked"|"passed" = "passed") { const id = await beginOperation(supabase, title, operation); try { const summary = await work(); await finishOperation(supabase, id, emptyStatus, summary); } catch { await finishOperation(supabase, id, "failed", "Operation failed safely."); } }

function asPlanned(value: unknown): PlannedResetAction[] { return Array.isArray(value) ? value.filter((item): item is PlannedResetAction => Boolean(item && typeof item === "object" && typeof (item as any).key === "string")) : []; }
function weekdayForLocalDate(date: string) { const [y,m,d] = date.split("-").map(Number); return new Date(Date.UTC(y,m-1,d)).getUTCDay(); }
function clockInTimezone(value: Date, timezone: string) { const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour12: false, hour: "2-digit", minute: "2-digit" }).formatToParts(value); const h = Number(parts.find((part) => part.type === "hour")?.value ?? 9) % 24; const m = Number(parts.find((part) => part.type === "minute")?.value ?? 0); return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`; }
function bucket(value: number | null) { if (value == null) return "no_eligible_actions"; if (value === 100) return "100"; if (value >= 75) return "75_99"; if (value >= 50) return "50_74"; if (value > 0) return "1_49"; return "0"; }
function cleanShort(value: string | null | undefined, max: number) { const cleaned = value?.trim().replace(/[<>]/g, "").slice(0,max); return cleaned || null; }
function emptyView(canStartManually: boolean): ResetView { return { available: false, canStartManually, enrollment: null, day: 0, definition: null, localDate: null, preparationEvening: false, snapshot: null, closure: null, priorities: [], minimumDay: [], recovery: { active: false, message: "", actions: [] }, consistencyTarget: null, pattern: null, patternInsufficient: false, adjustment: null, trajectory: null, weeklyReview: null }; }
