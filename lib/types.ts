// Mirrors the canonical Supabase product schema. Keep in sync, or generate with
// `supabase gen types typescript` once the project is linked.

export type Tier = "critical" | "important" | "optional";

export interface OnboardingBlueprint {
  version?: string;
  selectedDomains?: string[];
  primaryDomain?: string;
  frictionCategories?: string[];
  frictionNote?: string | null;
  lifeStructure?: Record<string, unknown>;
  healthPreferences?: Record<string, unknown>;
  financePreferences?: Record<string, unknown>;
  coachingPreferences?: Record<string, unknown>;
  weeklyReview?: { day?: number; time?: string; reminderIntent?: boolean; rationale?: string } | null;
  confidence?: "provisional" | "calibrating" | "established" | string;
  completeness?: string;
  activatedAt?: string;
}

export interface Profile {
  createdAt?: string;
  id: string;
  fullName: string | null;
  timezone: string;
  onboardingCompleted: boolean;
  onboardingStatus?: string | null;
  onboardingVersion?: string | null;
  onboardingCompletedAt?: string | null;
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
    onboarding?: OnboardingBlueprint;
  } | null;
}

export interface Goal { id: string; title: string; category: "fitness" | "finance" | "career" | "learning" | "health" | "custom"; target: string | null; deadline: string | null; progress: number; vision12mo: string | null; objective90day: string | null; status: "active" | "paused" | "completed" | "abandoned"; }
export interface Task { id: string; goalId: string | null; title: string; tier: Tier; dueAt: string | null; completedAt: string | null; meta?: string; }
export interface CalendarEvent { id: string; title: string; startAt: string; endAt: string; location: string | null; isCurrent?: boolean; }
export interface Habit { id: string; goalId?: string | null; title: string; targetFrequency: "daily" | "weekly" | "n_per_week"; consistencyPct: number; streakDays: number; }
export interface HealthSnapshot { sleepMinutes: number | null; sleepTargetMinutes: number | null; recoveryPct: number | null; steps: number | null; stepsTarget: number | null; waterCups: number | null; waterTargetCups: number | null; workoutStatus: "completed" | "scheduled" | "missed" | "not_scheduled"; nutritionStatus: "on_track" | "over" | "under" | "unavailable" | "logged"; }
export interface MoneySnapshot { spentTodayCents: number; weeklyBudgetPctUsed: number; nextBillLabel: string | null; savingsGoalPct: number; }
export interface AIInsight { id: string; domain: "health" | "finance" | "fitness" | "productivity"; type: "observation" | "recommendation" | "action"; content: string; actionTaken: boolean; }
export interface DailyScore { score: number; weeklyDeltaPct: number; personalBest: number; breakdown: Record<string, number>; }
export interface RunMyDayPlanItem { time: string; title: string; note?: string; }
export interface RunMyDayPlan { items: RunMyDayPlanItem[]; explanation: string; }
export interface WeeklyReviewData { score: number; weeklyDeltaPct: number; tasksCompletedLabel: string; goalsProgressedLabel: string; habitConsistencyPct: number; fitnessScore: number; sleepScore: number; moneyScore: number; whatWentWell: string; needsAttention: string; biggestOpportunity: string; nextWeekPlan: string[]; }
export interface CoachMessage { id: string; role: "user" | "assistant"; content: string; }
