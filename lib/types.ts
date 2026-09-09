// Mirrors supabase/schema.sql. Keep in sync, or generate with
// `supabase gen types typescript` once the project is linked.

export type Tier = "critical" | "important" | "optional";

export interface Profile {
  id: string;
  fullName: string | null;
  timezone: string;
  onboardingCompleted: boolean;
  blueprint: {
    vision?: string;
    goals?: string[];
    priorities?: string[];
    habits?: string[];
    coachingStyle?: string[];
    rhythm?: { wakeTime?: string; sleepTime?: string; primaryActivity?: string };
    healthEnergy?: string;
    financeContext?: string;
    availableDailyTime?: string;
    peakEnergy?: string;
    protectedCommitments?: string;
    nutritionPhotoTracking?: boolean;
    moneyGoals?: string[];
    connectionPrefs?: string[];
  } | null;
}

export interface Goal {
  id: string;
  title: string;
  category: "fitness" | "finance" | "career" | "learning" | "health" | "custom";
  target: string | null;
  deadline: string | null; // ISO date
  progress: number; // 0-100
  vision12mo: string | null;
  objective90day: string | null;
  status: "active" | "paused" | "completed" | "abandoned";
}

export interface Task {
  id: string;
  goalId: string | null;
  title: string;
  tier: Tier;
  dueAt: string | null; // ISO datetime
  completedAt: string | null;
  meta?: string; // display-only context, e.g. "Blocks Q3 goal"
}

export interface CalendarEvent {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  location: string | null;
  isCurrent?: boolean; // computed client-side for the "now" marker
}

export interface Habit {
  id: string;
  title: string;
  targetFrequency: "daily" | "weekly" | "n_per_week";
  consistencyPct: number; // computed, not stored directly
  streakDays: number;
}

export interface HealthSnapshot {
  sleepMinutes: number;
  sleepTargetMinutes: number;
  recoveryPct: number;
  steps: number;
  stepsTarget: number;
  waterCups: number;
  waterTargetCups: number;
  workoutStatus: "completed" | "scheduled" | "missed";
  nutritionStatus: "on_track" | "over" | "under";
}

export interface MoneySnapshot {
  spentTodayCents: number;
  weeklyBudgetPctUsed: number;
  nextBillLabel: string | null;
  savingsGoalPct: number;
}

export interface AIInsight {
  id: string;
  domain: "health" | "finance" | "fitness" | "productivity";
  type: "observation" | "recommendation" | "action";
  content: string;
  actionTaken: boolean;
}

export interface DailyScore {
  score: number; // 0-100
  weeklyDeltaPct: number;
  personalBest: number;
  breakdown: Record<string, number>;
}

export interface RunMyDayPlanItem {
  time: string; // "6:30 AM"
  title: string;
  note?: string; // AI's reasoning for this placement, if it moved something
}

export interface RunMyDayPlan {
  items: RunMyDayPlanItem[];
  explanation: string; // the one or two sentence "why" shown at the top of the sheet
}

export interface WeeklyReviewData {
  score: number;
  weeklyDeltaPct: number;
  tasksCompletedLabel: string; // "18/23"
  goalsProgressedLabel: string; // "2 of 3"
  habitConsistencyPct: number;
  fitnessScore: number;
  sleepScore: number;
  moneyScore: number;
  whatWentWell: string;
  needsAttention: string;
  biggestOpportunity: string;
  nextWeekPlan: string[];
}

export interface CoachMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}
