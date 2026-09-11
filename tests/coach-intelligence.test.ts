import assert from "node:assert/strict";
import test from "node:test";

import { analyzeCoachContext, composeCoachResponse, rankCoachInsights } from "../lib/coach/analysis";
import { resolveCoachIntent, specialistsForIntent } from "../lib/coach/intents";
import type { CoachContextSnapshot, SpecialistInsight } from "../lib/coach/types";
import { normalizeRecommendationAction } from "../lib/ai/recommendation-contract";

const QUESTIONS: Array<[string, ReturnType<typeof resolveCoachIntent>]> = [
  ["What should I focus on today?", "today_focus"],
  ["Why did my score fall?", "score_explanation"],
  ["Plan tomorrow.", "tomorrow_planning"],
  ["What am I neglecting?", "neglect_analysis"],
  ["When should I work out?", "training_schedule"],
  ["What changed this week?", "weekly_change"],
  ["Am I on track financially?", "finance_status"],
  ["What is keeping me from reaching my goals?", "goal_blockers"],
];

test("routes all eight core Coach questions to explicit intents", () => {
  for (const [question, intent] of QUESTIONS) assert.equal(resolveCoachIntent(question), intent, question);
  assert.deepEqual(specialistsForIntent("finance_status"), ["finance", "progress"]);
  assert.deepEqual(specialistsForIntent("score_explanation"), ["progress"]);
});

test("explains score movement from saved deterministic factors", () => {
  const snapshot = makeSnapshot("score_explanation");
  snapshot.scores.explanation = {
    previousScore: 76,
    currentScore: 72,
    delta: -4,
    factors: [{ domain: "fitness", label: "Fitness", previousValue: 82, currentValue: 70, scoreImpact: -12 }],
  };
  snapshot.week.meaningfulEvents = [{ id: "score-1", type: "score.changed", occurredAt: "2026-09-11T12:00:00Z" }];
  const analysis = analyzeCoachContext(snapshot, "Why did my score fall?");
  const reply = composeCoachResponse(analysis, snapshot);
  assert.match(reply, /76 to 72 \(-4\)/);
  assert.match(reply, /Fitness -12/);
  assert.equal(analysis.insights[0].domain, "progress");
});

test("handles missing Finance data without inventing a status", () => {
  const snapshot = makeSnapshot("finance_status");
  snapshot.finance = null;
  snapshot.missing = ["Finance accounts, transactions, budget, bills, or a numeric financial goal"];
  const reply = composeCoachResponse(analyzeCoachContext(snapshot, "Am I on track financially?"), snapshot);
  assert.match(reply, /does not yet have enough Finance data/);
  assert.match(reply, /Missing context/);
  assert.doesNotMatch(reply, /You are on track/);
});

test("creates an evidence-backed workout move draft that still requires confirmation", () => {
  const snapshot = makeSnapshot("action_request");
  snapshot.health.activePlan = {
    id: "plan-1",
    title: "Strength Base",
    goal: "Build strength",
    daysPerWeek: 2,
    sessionMinutes: 45,
    experience: "intermediate",
    schedule: [
      { key: "upper", day: "Tuesday", dayIndex: 2, title: "Upper", duration: 45 },
      { key: "lower", day: "Friday", dayIndex: 5, title: "Lower", duration: 45 },
    ],
  };
  const analysis = analyzeCoachContext(snapshot, "Move my Tuesday workout to Wednesday");
  assert.equal(analysis.actions.length, 1);
  assert.equal(analysis.actions[0].type, "workout.schedule_move");
  assert.equal(analysis.actions[0].requiresConfirmation, true);
  assert.deepEqual(analysis.actions[0].payload.days, [3, 5]);
  assert.deepEqual(analysis.actions[0].evidence, [{ key: "active_workout_plan", value: "Strength Base", sourceType: "workout_plans", sourceId: "plan-1" }]);
});

test("rejects malformed or unowned workout action payloads", () => {
  const allowed = new Set(["workout_plans:plan-1"]);
  assert.equal(normalizeRecommendationAction("workout.schedule_move", { planId: "other", sessionKey: "upper", days: [3, 5], fromDayIndex: 2, toDayIndex: 3 }, allowed), null);
  assert.equal(normalizeRecommendationAction("workout.schedule_move", { planId: "plan-1", sessionKey: "upper", days: [3, 3], fromDayIndex: 2, toDayIndex: 3 }, allowed), null);
  assert.deepEqual(normalizeRecommendationAction("workout.schedule_move", { planId: "plan-1", sessionKey: "upper", days: [3, 5], fromDayIndex: 2, toDayIndex: 3 }, allowed)?.actionPayload.days, [3, 5]);
});

test("ranks cross-domain insights by importance, urgency, goal relevance, and confidence", () => {
  const lower: SpecialistInsight = { domain: "planner", observation: "Later", evidence: [], importance: 40, urgency: 40, goalRelevance: 40, confidence: "low" };
  const higher: SpecialistInsight = { domain: "health", observation: "Now", evidence: [{ key: "workout", value: 1, sourceType: "workout_plan_logs", sourceId: "log-1" }], importance: 90, urgency: 80, goalRelevance: 80, confidence: "high" };
  assert.equal(rankCoachInsights([lower, higher])[0].observation, "Now");
});

function makeSnapshot(intent: CoachContextSnapshot["intent"]): CoachContextSnapshot {
  return {
    generatedAt: "2026-09-11T12:00:00Z",
    timezone: "America/New_York",
    intent,
    contextSections: [],
    stable: { activeGoalCount: 0, progression: null, preferences: { peakEnergy: null, protectedCommitments: null, availableDailyTime: null, coachingStyle: [] } },
    today: { date: "2026-09-11", tasks: [], calendar: [], habits: [], workout: null, supplements: { scheduled: [], remaining: [] }, nutrition: null, completionPct: null, workload: 0 },
    tomorrow: { date: "2026-09-12", tasks: [], calendar: [], workout: null, workSchedule: [] },
    scores: { overall: 0, health: null, finance: null, strongest: null, opportunity: null, explanation: { previousScore: null, currentScore: 0, delta: null, factors: [] }, remainingOpportunities: [] },
    week: { taskCompletion: null, habitCompletion: null, workoutCompletion: null, nutritionConsistency: null, supplementConsistency: null, financeDirection: null, overallScoreChange: null, strongestDomain: null, weakestDomain: null, busiestDay: null, meaningfulEvents: [], comparison: { current: {}, previous: {} } },
    health: { score: null, trainingDays: [], workoutsLast7Days: 0, activePlan: null, nutrition: null, supplements: { active: [], loggedToday: [] } },
    finance: null,
    goals: [],
    patterns: [],
    evidence: {},
    history: { windowDays: 14, eventCount: 0, eventCounts: {} },
    missing: [],
    conversation: [],
  };
}
