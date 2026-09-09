// Mirrors supabase/schema.sql. Keep in sync, or generate with
// `supabase gen types typescript` once the project is linked.

export type Tier = "critical" | "important" | "optional";
export interface Profile { id: string; fullName: string | null; timezone: string; onboardingCompleted: boolean; blueprint: { vision?: string; goals?: string[]; priorities?: string[]; habits?: string[]; coachingStyle?: string[]; rhythm?: { wakeTime?: string; sleepTime?: string; primaryActivity?: string }; healthEnergy?: string; financeContext?: string; availableDailyTime?: string; peakEnergy?: string; protectedCommitments?: string; nutritionPhotoTracking?: boolean; moneyGoals?: string[]; connectionPrefs?: string[]; } | null; }
export interface Goal { id: string; title: string; category: "fitness" | "finance" | "career" | "learning" | "health" | "custom"; target: string | null; deadline: string | null; progress: number; vision12mo: string | null; objective90day: string | null; status: "active" | "paused" | "completed" | "abandoned"; }
export interface Task { id: string; goalId: string | null; title: string; tier: Tier; dueAt: string | null; completedAt: string | null; meta?: string; }
export interface CalendarEvent { id: string; title: string; startAt: string; endAt: string; location: string | null; isCurrent?: boolean; }
export interface Habit { id: string; goalId?: string | null; title: string; targetFrequency: "daily" | "weekly" | "n_per_week"; consistencyPct: number; streakDays: number; }
export interface HealthSnapshot { sleepMinutes: number; sleepTargetMinutes: number; recoveryPct: number; steps: number; stepsTarget: number; waterCups: number; waterTargetCups: number; workoutStatus: "completed" | "scheduled" | "missed"; nutritionStatus: "on_track" | "over" | "under"; }
export interface MoneySnapshot { spentTodayCents: number; weeklyBudgetPctUsed: number; nextBillLabel: string | null; savingsGoalPct: number; }
export interface AIInsight { id: string; domain: "health" | "finance" | "fitness" | "productivity"; type: "observation" | "recommendation" | "action"; content: string; actionTaken: boolean; }
export interface DailyScore { score: number; weeklyDeltaPct: number; personalBest: number; breakdown: Record<string, number>; }
export interface RunMyDayPlanItem { time: string; title: string; note?: string; }
export interface RunMyDayPlan { items: RunMyDayPlanItem[]; explanation: string; }
export interface WeeklyReviewData { score: number; weeklyDeltaPct: number; tasksCompletedLabel: string; goalsProgressedLabel: string; habitConsistencyPct: number; fitnessScore: number; sleepScore: number; moneyScore: number; whatWentWell: string; needsAttention: string; biggestOpportunity: string; nextWeekPlan: string[]; }
export interface CoachMessage { id: string; role: "user" | "assistant"; content: string; }
