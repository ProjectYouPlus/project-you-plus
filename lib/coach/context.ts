import "server-only";

import { buildUserContext, type UserContext } from "@/lib/ai/context";
import { loadLongitudinalContext, type LongitudinalEvent } from "@/lib/ai/longitudinal-context";
import { historyWindowForIntent, resolveCoachIntent, specialistsForIntent } from "@/lib/coach/intents";
import type { CoachContextBundle, CoachContextSnapshot, CoachIntent, PatternInsight, ScoreDeltaExplanation, WeeklyPerformanceSummary } from "@/lib/coach/types";
import { shiftDate, supplementDue, userDate, weekday, WEEKDAYS } from "@/lib/health/schedule";
import { createClient } from "@/lib/supabase/server";

type ConversationMessage = { role: "user" | "assistant"; content: string };

export async function buildCoachContext(input: {
  message: string;
  history?: ConversationMessage[];
  mode?: "decide" | "plan" | "reflect";
  now?: Date;
  userId?: string;
}): Promise<CoachContextBundle> {
  const intent = resolveCoachIntent(input.message);
  const context = await buildUserContext();
  if (input.userId && input.userId !== context.profile.id) throw new Error("Coach context user mismatch.");
  const now = input.now ?? new Date();
  const days = historyWindowForIntent(intent);
  const [longitudinal, storedConversation] = await Promise.all([
    loadLongitudinalContext(context.profile.id, { days, limit: days > 28 ? 300 : 180 }).catch(() => ({ windowDays: days, events: [] as LongitudinalEvent[], counts: {}, evidenceIds: [] })),
    loadConversation(input.history ?? []),
  ]);
  const snapshot = createCoachContextSnapshot(context, intent, now, longitudinal.events, longitudinal.counts, storedConversation);
  return { intent, specialists: specialistsForIntent(intent, snapshot), context, snapshot };
}

export function createCoachContextSnapshot(
  context: UserContext,
  intent: CoachIntent,
  now: Date,
  events: LongitudinalEvent[],
  eventCounts: Record<string, number>,
  conversation: ConversationMessage[] = [],
): CoachContextSnapshot {
  const timezone = context.profile.timezone || "UTC";
  const today = userDate(now, timezone);
  const tomorrow = shiftDate(today, 1);
  const todayIndex = weekday(today);
  const tomorrowIndex = weekday(tomorrow);
  const activePlan = context.training.activePlan;
  const completedHabitIds = new Set(events.filter((event) => event.event_type === "habit.completed" && eventDay(event, timezone) === today).map((event) => event.source_id).filter(Boolean));
  const todayTaskRows = context.tasks.filter((task) => !task.completedAt && (task.tier === "critical" || (task.dueAt && localDay(task.dueAt, timezone) <= today))).sort(taskSort).slice(0, 6);
  const fallbackTasks = context.tasks.filter((task) => !task.completedAt).sort(taskSort).slice(0, 3);
  const todayTasks = (todayTaskRows.length ? todayTaskRows : fallbackTasks).map((task) => ({ id: task.id, title: task.title, tier: task.tier, dueAt: task.dueAt, goalId: task.goalId, overdue: Boolean(task.dueAt && localDay(task.dueAt, timezone) < today) }));
  const tomorrowTasks = context.tasks.filter((task) => !task.completedAt && task.dueAt && localDay(task.dueAt, timezone) === tomorrow).sort(taskSort).slice(0, 8).map((task) => ({ id: task.id, title: task.title, tier: task.tier, dueAt: task.dueAt, goalId: task.goalId }));
  const todayCalendar = context.schedule.filter((event) => localDay(event.startAt, timezone) === today).map(publicEvent);
  const tomorrowCalendar = context.schedule.filter((event) => localDay(event.startAt, timezone) === tomorrow).map(publicEvent);
  const todaySession = activePlan?.schedule.find((session) => session.dayIndex === todayIndex) ?? null;
  const tomorrowSession = activePlan?.schedule.find((session) => session.dayIndex === tomorrowIndex) ?? null;
  const todayWorkout = activePlan && todaySession ? { planId: activePlan.id, sessionKey: todaySession.key, title: todaySession.title, dayIndex: todaySession.dayIndex, duration: todaySession.duration, status: context.training.todayStatus ?? "not_started" } : null;
  const tomorrowWorkout = activePlan && tomorrowSession ? { planId: activePlan.id, sessionKey: tomorrowSession.key, title: tomorrowSession.title, dayIndex: tomorrowSession.dayIndex, duration: tomorrowSession.duration } : null;
  const habits = context.habits.map((habit) => ({ id: habit.id, title: habit.title, consistencyPct: habit.consistencyPct, completedToday: completedHabitIds.has(habit.id) }));
  const dueToday = context.tasks.filter((task) => task.dueAt && localDay(task.dueAt, timezone) === today);
  const taskDone = dueToday.filter((task) => Boolean(task.completedAt)).length;
  const workoutPlanned = todayWorkout ? 1 : 0;
  const workoutDone = todayWorkout?.status === "completed" ? 1 : 0;
  const planned = dueToday.length + habits.length + workoutPlanned + (context.supplements.scheduledToday?.length ?? 0);
  const completed = taskDone + habits.filter((habit) => habit.completedToday).length + workoutDone + ((context.supplements.scheduledToday?.length ?? 0) - (context.supplements.remainingToday?.length ?? 0));
  const completionPct = planned ? Math.round(Math.max(0, Math.min(1, completed / planned)) * 100) : null;
  const scoreExplanation = buildScoreExplanation(context, today);
  const week = buildWeeklySummary(context, events, timezone, today, scoreExplanation);
  const patterns = discoverCoachPatterns(context, events, timezone, week);
  const finance = context.domains.finance.data;
  const missing = relevantMissing(context, intent, events.length);
  const remainingOpportunities = [
    todayTasks[0] ? { label: `Complete ${todayTasks[0].title}`, reason: todayTasks[0].overdue ? "Highest-priority overdue task" : "Highest-priority open task" } : null,
    todayWorkout && todayWorkout.status !== "completed" ? { label: `Complete ${todayWorkout.title}`, reason: "Scheduled workout remains open" } : null,
    context.supplements.remainingToday?.length ? { label: `Complete ${context.supplements.remainingToday.length} supplement check-in${context.supplements.remainingToday.length === 1 ? "" : "s"}`, reason: "Scheduled protocol remains open" } : null,
    finance?.upcomingBills.count ? { label: `Review ${finance.upcomingBills.next ?? "upcoming bill"}`, reason: "Upcoming financial obligation" } : null,
  ].filter((item): item is { label: string; reason: string } => Boolean(item)).slice(0, 4);
  const goalRows = context.goals.filter((goal) => goal.status === "active").map((goal) => {
    const linked = context.tasks.filter((task) => task.goalId === goal.id && !task.completedAt);
    return { id: goal.id, title: goal.title, category: goal.category, progress: goal.progress, deadline: goal.deadline, openTasks: linked.length, overdueTasks: linked.filter((task) => task.dueAt && localDay(task.dueAt, timezone) < today).length };
  });

  return {
    generatedAt: now.toISOString(),
    timezone,
    intent,
    contextSections: sectionsForIntent(intent),
    stable: {
      activeGoalCount: goalRows.length,
      progression: context.domains.progression.data,
      preferences: {
        peakEnergy: context.profile.blueprint?.peakEnergy ?? null,
        protectedCommitments: context.profile.blueprint?.protectedCommitments ?? null,
        availableDailyTime: context.profile.blueprint?.availableDailyTime ?? null,
        coachingStyle: context.profile.blueprint?.coachingStyle ?? [],
      },
    },
    today: {
      date: today,
      tasks: todayTasks,
      calendar: todayCalendar,
      habits,
      workout: todayWorkout,
      supplements: { scheduled: context.supplements.scheduledToday ?? [], remaining: context.supplements.remainingToday ?? [] },
      nutrition: context.domains.nutrition.availability === "unavailable" ? null : context.nutrition,
      completionPct,
      workload: calculateWorkload(todayTasks.length, todayCalendar, todayWorkout?.duration ?? 0),
    },
    tomorrow: {
      date: tomorrow,
      tasks: tomorrowTasks,
      calendar: tomorrowCalendar,
      workout: tomorrowWorkout,
      workSchedule: context.workSchedule,
    },
    scores: {
      overall: context.score.score.score,
      health: context.domains.health.data?.score ?? null,
      finance: finance?.score ?? null,
      strongest: context.score.strongest ? { key: context.score.strongest.key, value: context.score.strongest.value } : null,
      opportunity: context.score.opportunity ? { key: context.score.opportunity.key, value: context.score.opportunity.value } : null,
      explanation: scoreExplanation,
      remainingOpportunities,
    },
    week,
    health: {
      score: context.domains.health.data,
      trainingDays: context.training.trainingDays ?? [],
      workoutsLast7Days: context.training.workoutsLast7Days,
      activePlan,
      nutrition: context.domains.nutrition.availability === "unavailable" ? null : context.nutrition,
      supplements: context.supplements,
    },
    finance,
    goals: goalRows,
    patterns,
    evidence: {
      finance: domainEvidence(context.domains.finance, "finance"),
      health: domainEvidence(context.domains.health, "health"),
      recentScores: domainEvidence(context.domains.recentScores, "recentScores"),
      eventHistory: domainEvidence(context.domains.eventHistory, "eventHistory"),
      supplements: domainEvidence(context.domains.supplements, "supplements"),
    },
    history: { windowDays: Math.max(1, Math.round((now.getTime() - new Date(events[0]?.occurred_at ?? now).getTime()) / 86_400_000)), eventCount: events.length, eventCounts },
    missing,
    conversation: conversation.slice(-12).map((item) => ({ role: item.role, content: item.content.slice(0, 1200) })),
  };
}

export function contextForCoachModel(snapshot: CoachContextSnapshot) {
  const common = { generatedAt: snapshot.generatedAt, timezone: snapshot.timezone, intent: snapshot.intent, stable: snapshot.stable, missing: snapshot.missing };
  if (snapshot.intent === "finance_status") return { ...common, scores: snapshot.scores, finance: snapshot.finance, goals: snapshot.goals.filter((goal) => goal.category === "finance"), week: { financeDirection: snapshot.week.financeDirection } };
  if (snapshot.intent === "training_schedule" || snapshot.intent === "health_question") return { ...common, today: snapshot.today, tomorrow: snapshot.tomorrow, health: snapshot.health, patterns: snapshot.patterns.filter((pattern) => pattern.type.includes("workout") || pattern.type.includes("workload")) };
  if (snapshot.intent === "score_explanation") return { ...common, scores: snapshot.scores, week: snapshot.week, patterns: snapshot.patterns };
  if (snapshot.intent === "weekly_change" || snapshot.intent === "neglect_analysis" || snapshot.intent === "progress_question") return { ...common, scores: snapshot.scores, week: snapshot.week, health: snapshot.health, finance: snapshot.finance, goals: snapshot.goals, patterns: snapshot.patterns, history: snapshot.history };
  if (snapshot.intent === "goal_blockers") return { ...common, goals: snapshot.goals, today: snapshot.today, week: snapshot.week, patterns: snapshot.patterns, health: snapshot.health, finance: snapshot.finance };
  if (snapshot.intent === "tomorrow_planning") return { ...common, today: snapshot.today, tomorrow: snapshot.tomorrow, goals: snapshot.goals, patterns: snapshot.patterns };
  return { ...common, today: snapshot.today, scores: snapshot.scores, goals: snapshot.goals, finance: snapshot.finance?.upcomingBills.count ? { upcomingBills: snapshot.finance.upcomingBills, budgetRemaining: snapshot.finance.budgetRemaining } : null };
}

async function loadConversation(history: ConversationMessage[]) {
  if (history.length) return history.slice(-12);
  try {
    const supabase = await createClient();
    const { data } = await supabase.from("ai_conversations").select("role,content").in("role", ["user", "assistant"]).order("created_at", { ascending: false }).limit(12);
    return (data ?? []).reverse().flatMap((row) => row.role === "user" || row.role === "assistant" ? [{ role: row.role, content: String(row.content).slice(0, 1200) } as ConversationMessage] : []);
  } catch {
    return [];
  }
}

function buildScoreExplanation(context: UserContext, today: string): ScoreDeltaExplanation {
  const current = context.score.score.score;
  const rows = context.domains.recentScores.data ?? [];
  const previous = rows.find((row) => row.scoredOn < today) ?? null;
  const currentBreakdown = context.score.score.breakdown;
  const previousBreakdown = previous?.breakdown ?? null;
  const factors = Object.entries(currentBreakdown).map(([domain, value]) => {
    const currentValue = finite(value);
    const previousValue = finite(previousBreakdown?.[domain]);
    return { domain, label: label(domain), previousValue, currentValue, scoreImpact: currentValue !== null && previousValue !== null ? currentValue - previousValue : null };
  }).filter((factor) => factor.currentValue !== null || factor.previousValue !== null).sort((a, b) => (a.scoreImpact ?? 0) - (b.scoreImpact ?? 0));
  return { previousScore: previous?.score ?? null, currentScore: current, delta: previous ? current - previous.score : null, factors };
}

function buildWeeklySummary(context: UserContext, events: LongitudinalEvent[], timezone: string, today: string, score: ScoreDeltaExplanation): WeeklyPerformanceSummary {
  const mondayOffset = (weekday(today) + 6) % 7;
  const currentStart = shiftDate(today, -mondayOffset);
  const previousStart = shiftDate(currentStart, -7);
  const previousEnd = shiftDate(currentStart, -1);
  const currentEnd = today;
  const currentDays = daysInclusive(currentStart, currentEnd);
  const previousDays = daysInclusive(previousStart, previousEnd);
  const currentEvents = events.filter((event) => between(eventDay(event, timezone), currentStart, currentEnd));
  const previousEvents = events.filter((event) => between(eventDay(event, timezone), previousStart, previousEnd));
  const metrics = (rows: LongitudinalEvent[], start: string, end: string, days: number) => {
    const tasksPlanned = context.tasks.filter((task) => task.dueAt && between(localDay(task.dueAt, timezone), start, end)).length;
    const tasksCompleted = context.tasks.filter((task) => task.completedAt && between(localDay(task.completedAt, timezone), start, end)).length;
    const workoutsPlanned = countScheduledDays(context.training.trainingDays ?? [], start, end);
    const workoutsCompleted = rows.filter((event) => event.event_type === "workout.completed").length;
    const habitsExpected = expectedHabits(context, start, end);
    const habitsCompleted = rows.filter((event) => event.event_type === "habit.completed").length;
    const supplementsExpected = expectedSupplements(context, start, end);
    const supplementsCompleted = rows.filter((event) => event.event_type === "supplement.completed").length;
    const mealDays = new Set(rows.filter((event) => event.event_type === "meal.logged").map((event) => eventDay(event, timezone))).size;
    return {
      taskCompletion: percent(tasksCompleted, tasksPlanned),
      habitCompletion: percent(habitsCompleted, habitsExpected),
      workoutCompletion: percent(workoutsCompleted, workoutsPlanned),
      nutritionConsistency: context.domains.nutrition.availability === "unavailable" ? null : percent(mealDays, days),
      supplementConsistency: supplementsExpected ? percent(supplementsCompleted, supplementsExpected) : null,
    };
  };
  const current = metrics(currentEvents, currentStart, currentEnd, currentDays);
  const previous = metrics(previousEvents, previousStart, previousEnd, previousDays);
  const busiestDay = busiestDayName(context, currentStart, currentEnd, timezone);
  return {
    ...current,
    financeDirection: context.financeOverview.score.direction,
    overallScoreChange: score.delta,
    strongestDomain: context.score.strongest?.key ?? null,
    weakestDomain: context.score.opportunity?.key ?? null,
    busiestDay,
    meaningfulEvents: currentEvents.filter((event) => isMeaningful(event.event_type)).slice(-12).map((event) => ({ id: event.id, type: event.event_type, occurredAt: event.occurred_at })),
    comparison: { current, previous },
  };
}

function discoverCoachPatterns(context: UserContext, events: LongitudinalEvent[], timezone: string, week: WeeklyPerformanceSummary): PatternInsight[] {
  const patterns: PatternInsight[] = [];
  const workoutEvents = events.filter((event) => event.event_type === "workout.completed" || event.event_type === "workout.missed");
  const byDay = new Map<number, { completed: LongitudinalEvent[]; missed: LongitudinalEvent[] }>();
  for (const event of workoutEvents) {
    const day = weekday(eventDay(event, timezone));
    const bucket = byDay.get(day) ?? { completed: [], missed: [] };
    (event.event_type === "workout.completed" ? bucket.completed : bucket.missed).push(event);
    byDay.set(day, bucket);
  }
  for (const [day, bucket] of byDay) {
    const sample = bucket.completed.length + bucket.missed.length;
    if (sample < 2) continue;
    const rate = Math.round(bucket.completed.length / sample * 100);
    patterns.push({ type: `workout-adherence-${day}`, description: `${WEEKDAYS[day]} workout adherence is ${rate}% across ${sample} recorded sessions.`, sampleSize: sample, confidence: sample >= 6 ? "high" : sample >= 3 ? "medium" : "low", evidence: [...bucket.completed, ...bucket.missed].slice(-8).map(eventEvidence) });
  }
  if (week.busiestDay) {
    patterns.push({ type: "workload-busiest-day", description: `${week.busiestDay} has the highest currently tracked workload.`, sampleSize: context.schedule.length + context.tasks.filter((task) => Boolean(task.dueAt)).length, confidence: context.schedule.length >= 4 ? "medium" : "low", evidence: context.domains.calendar.evidence.flatMap((row) => row.ids.slice(0, 6).map((id) => ({ key: "calendar_event", value: week.busiestDay!, sourceType: row.table, sourceId: id }))) });
  }
  const completedTasks = events.filter((event) => event.event_type === "task.completed");
  if (completedTasks.length >= 5) patterns.push({ type: "execution-volume", description: `${completedTasks.length} task completions are recorded in the current history window.`, sampleSize: completedTasks.length, confidence: completedTasks.length >= 12 ? "high" : "medium", evidence: completedTasks.slice(-8).map(eventEvidence) });
  return patterns.sort((a, b) => confidenceRank(b.confidence) - confidenceRank(a.confidence) || b.sampleSize - a.sampleSize).slice(0, 8);
}

function relevantMissing(context: UserContext, intent: CoachIntent, eventCount: number) {
  const out: string[] = [];
  const needsHistory = ["score_explanation", "weekly_change", "neglect_analysis", "training_schedule", "goal_blockers", "progress_question"].includes(intent);
  if (needsHistory && eventCount < 3) out.push("Enough longitudinal events to establish a reliable pattern");
  if (["today_focus", "tomorrow_planning", "schedule_question", "training_schedule"].includes(intent) && context.domains.calendar.availability === "unavailable") out.push("Calendar commitments");
  if (["training_schedule", "health_question", "neglect_analysis"].includes(intent) && context.domains.workout.availability === "unavailable") out.push("Workout plan or training history");
  if (["finance_status", "neglect_analysis"].includes(intent) && context.domains.finance.availability === "unavailable") out.push("Finance accounts, transactions, budget, bills, or a numeric financial goal");
  if (["goal_blockers", "today_focus"].includes(intent) && context.domains.goals.availability === "unavailable") out.push("Active goals");
  if (intent === "score_explanation" && context.domains.recentScores.availability === "unavailable") out.push("A prior saved score");
  return [...new Set(out)];
}

function sectionsForIntent(intent: CoachIntent) {
  const map: Record<CoachIntent, string[]> = {
    today_focus: ["stable", "today", "scores", "goals", "urgent_finance"],
    score_explanation: ["scores", "week", "patterns", "meaningful_events"],
    tomorrow_planning: ["stable", "today", "tomorrow", "goals", "patterns"],
    neglect_analysis: ["week", "health", "finance", "goals", "patterns", "history"],
    training_schedule: ["today", "tomorrow", "health", "calendar", "patterns"],
    weekly_change: ["week", "scores", "health", "finance", "goals", "patterns"],
    finance_status: ["finance", "finance_goals", "scores"],
    goal_blockers: ["goals", "week", "patterns", "health", "finance"],
    health_question: ["health", "today", "patterns"],
    schedule_question: ["today", "tomorrow", "calendar", "work_schedule"],
    progress_question: ["scores", "week", "goals", "patterns", "history"],
    action_request: ["today", "tomorrow", "health", "goals", "conversation"],
    general_coaching: ["stable", "today", "goals", "conversation"],
  };
  return map[intent];
}

function expectedHabits(context: UserContext, start: string, end: string) { return context.habits.reduce((sum, habit) => sum + (habit.targetFrequency === "daily" ? daysInclusive(start, end) : 1), 0); }
function expectedSupplements(context: UserContext, start: string, end: string) { let count = 0; for (let date = start; date <= end; date = shiftDate(date, 1)) for (const item of context.supplements.active) if (supplementDue(item.frequency, weekday(date), (context.training.trainingDays ?? []).includes(weekday(date)))) count += 1; return count; }
function countScheduledDays(days: number[], start: string, end: string) { let count = 0; for (let date = start; date <= end; date = shiftDate(date, 1)) if (days.includes(weekday(date))) count += 1; return count; }
function busiestDayName(context: UserContext, start: string, end: string, timezone: string) { const load = new Map<string, number>(); for (let date = start; date <= end; date = shiftDate(date, 1)) load.set(date, 0); for (const task of context.tasks) if (task.dueAt) { const day = localDay(task.dueAt, timezone); if (load.has(day)) load.set(day, (load.get(day) ?? 0) + (task.tier === "critical" ? 3 : task.tier === "important" ? 2 : 1)); } for (const event of context.schedule) { const day = localDay(event.startAt, timezone); if (load.has(day)) load.set(day, (load.get(day) ?? 0) + Math.max(1, Math.ceil((new Date(event.endAt).getTime() - new Date(event.startAt).getTime()) / 3_600_000))); } const best = [...load.entries()].sort((a, b) => b[1] - a[1])[0]; return best && best[1] > 0 ? WEEKDAYS[weekday(best[0])] : null; }
function calculateWorkload(taskCount: number, calendar: Array<{ startAt: string; endAt: string }>, workoutMinutes: number) { return taskCount * 2 + calendar.reduce((sum, event) => sum + Math.max(1, Math.ceil((new Date(event.endAt).getTime() - new Date(event.startAt).getTime()) / 3_600_000)), 0) + (workoutMinutes ? 1 : 0); }
function daysInclusive(start: string, end: string) { return Math.max(1, Math.round((new Date(`${end}T12:00:00Z`).getTime() - new Date(`${start}T12:00:00Z`).getTime()) / 86_400_000) + 1); }
function percent(done: number, planned: number) { return planned > 0 ? Math.max(0, Math.min(100, Math.round(done / planned * 100))) : null; }
function between(day: string, start: string, end: string) { return day >= start && day <= end; }
function eventDay(event: LongitudinalEvent, timezone: string) { return localDay(event.occurred_at, timezone); }
function localDay(value: string, timezone: string) { return userDate(new Date(value), timezone); }
function publicEvent(event: UserContext["schedule"][number]) { return { id: event.id, title: event.title, startAt: event.startAt, endAt: event.endAt }; }
function taskSort(a: UserContext["tasks"][number], b: UserContext["tasks"][number]) { const rank = { critical: 0, important: 1, optional: 2 }; return rank[a.tier] - rank[b.tier] || String(a.dueAt ?? "9999").localeCompare(String(b.dueAt ?? "9999")); }
function finite(value: unknown) { const number = Number(value); return value == null || !Number.isFinite(number) ? null : number; }
function label(value: string) { return value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase()); }
function eventEvidence(event: LongitudinalEvent) { return { key: event.event_type, value: eventDay(event, "UTC"), sourceType: event.source_table ?? "behavior_events", sourceId: event.source_id ?? event.id }; }
function domainEvidence(domain: UserContext["domains"][keyof UserContext["domains"]], key: string) { return domain.evidence.flatMap((row) => row.ids.map((id) => ({ key, value: row.domain, sourceType: row.table, sourceId: id }))).slice(0, 20); }
function isMeaningful(type: string) { return /\.(completed|missed|changed|created|unlocked)$/.test(type) || type === "score.changed" || type === "meal.logged"; }
function confidenceRank(value: "low" | "medium" | "high") { return value === "high" ? 3 : value === "medium" ? 2 : 1; }
