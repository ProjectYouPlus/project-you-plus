import type { UserContext } from "@/lib/ai/context";
import type { Specialist } from "@/lib/types/agent-observations";

export type CoachIntent =
  | "today_focus"
  | "score_explanation"
  | "tomorrow_planning"
  | "neglect_analysis"
  | "training_schedule"
  | "weekly_change"
  | "finance_status"
  | "goal_blockers"
  | "health_question"
  | "schedule_question"
  | "progress_question"
  | "action_request"
  | "general_coaching";

export type CoachEvidence = {
  key: string;
  value: string | number;
  sourceType: string;
  sourceId: string;
};

export type CoachActionDraft = {
  type: "workout.schedule_move" | "tomorrow_plan.apply";
  label: string;
  description: string;
  current: string;
  proposed: string;
  payload: Record<string, unknown>;
  relatedEntities: Array<{ type: string; id: string; label?: string }>;
  evidence: CoachEvidence[];
  requiresConfirmation: true;
};

export type SpecialistInsight = {
  domain: Specialist;
  observation: string;
  evidence: CoachEvidence[];
  importance: number;
  urgency: number;
  goalRelevance: number;
  recommendation?: {
    action: string;
    reason: string;
    expectedImpact?: string;
  };
  action?: CoachActionDraft;
  confidence: "low" | "medium" | "high";
};

export type PatternInsight = {
  type: string;
  description: string;
  sampleSize: number;
  confidence: "low" | "medium" | "high";
  evidence: CoachEvidence[];
};

export type ScoreDeltaExplanation = {
  previousScore: number | null;
  currentScore: number;
  delta: number | null;
  factors: Array<{
    domain: string;
    label: string;
    previousValue: number | null;
    currentValue: number | null;
    scoreImpact: number | null;
  }>;
};

export type WeeklyPerformanceSummary = {
  taskCompletion: number | null;
  habitCompletion: number | null;
  workoutCompletion: number | null;
  nutritionConsistency: number | null;
  supplementConsistency: number | null;
  financeDirection: number | null;
  overallScoreChange: number | null;
  strongestDomain: string | null;
  weakestDomain: string | null;
  busiestDay: string | null;
  meaningfulEvents: Array<{ id: string; type: string; occurredAt: string }>;
  comparison: {
    current: Record<string, number | null>;
    previous: Record<string, number | null>;
  };
};

export type CoachContextSnapshot = {
  generatedAt: string;
  timezone: string;
  intent: CoachIntent;
  contextSections: string[];
  stable: {
    activeGoalCount: number;
    progression: UserContext["domains"]["progression"]["data"];
    preferences: {
      peakEnergy: string | null;
      protectedCommitments: string | null;
      availableDailyTime: string | null;
      coachingStyle: string[];
    };
  };
  today: {
    date: string;
    tasks: Array<{ id: string; title: string; tier: string; dueAt: string | null; goalId: string | null; overdue: boolean }>;
    calendar: Array<{ id: string; title: string; startAt: string; endAt: string }>;
    habits: Array<{ id: string; title: string; consistencyPct: number; completedToday: boolean }>;
    workout: null | { planId: string; sessionKey: string; title: string; dayIndex: number; duration: number; status: string };
    supplements: { scheduled: string[]; remaining: string[] };
    nutrition: UserContext["nutrition"] | null;
    completionPct: number | null;
    workload: number;
  };
  tomorrow: {
    date: string;
    tasks: Array<{ id: string; title: string; tier: string; dueAt: string | null; goalId: string | null }>;
    calendar: Array<{ id: string; title: string; startAt: string; endAt: string }>;
    workout: null | { planId: string; sessionKey: string; title: string; dayIndex: number; duration: number };
    workSchedule: UserContext["workSchedule"];
  };
  scores: {
    overall: number;
    health: number | null;
    finance: number | null;
    strongest: { key: string; value: number } | null;
    opportunity: { key: string; value: number } | null;
    explanation: ScoreDeltaExplanation;
    remainingOpportunities: Array<{ label: string; reason: string }>;
  };
  week: WeeklyPerformanceSummary;
  health: {
    score: UserContext["domains"]["health"]["data"];
    trainingDays: number[];
    workoutsLast7Days: number;
    activePlan: UserContext["training"]["activePlan"];
    nutrition: UserContext["nutrition"] | null;
    supplements: UserContext["supplements"];
  };
  finance: UserContext["domains"]["finance"]["data"];
  goals: Array<{ id: string; title: string; category: string; progress: number; deadline: string | null; openTasks: number; overdueTasks: number }>;
  patterns: PatternInsight[];
  evidence: Record<string, CoachEvidence[]>;
  history: { windowDays: number; eventCount: number; eventCounts: Record<string, number> };
  missing: string[];
  conversation: Array<{ role: "user" | "assistant"; content: string }>;
};

export type CoachContextBundle = {
  intent: CoachIntent;
  specialists: Specialist[];
  context: UserContext;
  snapshot: CoachContextSnapshot;
};

export type CoachAnalysis = {
  intent: CoachIntent;
  specialists: Specialist[];
  insights: SpecialistInsight[];
  actions: CoachActionDraft[];
};
