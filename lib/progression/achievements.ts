export type AchievementCategory =
  | "score"
  | "consistency"
  | "health"
  | "finance"
  | "goals"
  | "planning"
  | "review"
  | "progression"
  | "special";

export type AchievementTier = "standard" | "major" | "elite";

export type AchievementDefinition = {
  key: string;
  title: string;
  description: string;
  category: AchievementCategory;
  tier: AchievementTier;
};

export type AchievementFacts = {
  activeDays: string[];
  goalCompletions: string[];
  workoutCompletions: Array<{ date: string; planId: string; sessionKey: string }>;
  workoutPlanTargets: Record<string, number>;
  reviewDates: string[];
  onTargetBudgetMonths: string[];
  scoreSnapshots: Array<{ date: string; score: number; coveragePct: number }>;
};

export type QualifiedAchievement = AchievementDefinition & {
  earnedAt: string;
  evidence: Record<string, unknown>;
};

export const ACHIEVEMENTS: readonly AchievementDefinition[] = [
  { key: "first_day_completed", title: "First Day Completed", description: "Completed meaningful activity on the first tracked day.", category: "consistency", tier: "standard" },
  { key: "first_full_week", title: "First Full Week", description: "Recorded meaningful activity across a complete Monday–Sunday week.", category: "consistency", tier: "major" },
  { key: "seven_day_consistency", title: "7-Day Consistency", description: "Stayed active for seven consecutive days.", category: "consistency", tier: "major" },
  { key: "first_goal_completed", title: "First Goal Completed", description: "Completed the first tracked goal.", category: "goals", tier: "major" },
  { key: "three_workout_week", title: "3/3 Workout Week", description: "Completed every session in a three-workout weekly plan.", category: "health", tier: "major" },
  { key: "first_month", title: "First Month", description: "Built a meaningful month of active Project You+ history.", category: "progression", tier: "standard" },
  { key: "first_weekly_review", title: "First Weekly Review", description: "Completed the first evidence-based Weekly Review.", category: "review", tier: "standard" },
  { key: "budget_month_completed", title: "Budget Month Completed", description: "Closed a tracked month on or under budget.", category: "finance", tier: "major" },
  { key: "thirty_day_discipline", title: "30-Day Discipline", description: "Recorded meaningful activity on 30 days within a 35-day period.", category: "consistency", tier: "elite" },
  { key: "score_65_reached", title: "Score 65 Reached", description: "Reached a validated Project You+ Score of 65.", category: "score", tier: "standard" },
  { key: "score_75_reached", title: "Score 75 Reached", description: "Reached a validated Project You+ Score of 75.", category: "score", tier: "standard" },
  { key: "score_85_reached", title: "Score 85 Reached", description: "Reached a validated Project You+ Score of 85.", category: "score", tier: "major" },
  { key: "score_95_reached", title: "Score 95 Reached", description: "Reached a validated Project You+ Score of 95.", category: "score", tier: "elite" },
] as const;

const SCORE_RECOGNITIONS = [
  { key: "score_65_reached", threshold: 65 },
  { key: "score_75_reached", threshold: 75 },
  { key: "score_85_reached", threshold: 85 },
  { key: "score_95_reached", threshold: 95 },
] as const;

export function qualifyAchievements(facts: AchievementFacts): QualifiedAchievement[] {
  const active = [...new Set(facts.activeDays)].sort();
  const result: QualifiedAchievement[] = [];

  add("first_day_completed", active[0], { day: active[0] });
  const fullWeek = firstFullWeek(active);
  add("first_full_week", fullWeek, { weekEnding: fullWeek, activeDays: 7 });
  const sevenDayRun = firstRun(active, 7);
  add("seven_day_consistency", sevenDayRun, { endingOn: sevenDayRun, consecutiveDays: 7 });
  const firstGoal = [...facts.goalCompletions].sort()[0];
  add("first_goal_completed", firstGoal, { completedAt: firstGoal });
  const workoutWeek = firstCompletedThreeWorkoutPlanWeek(facts.workoutCompletions, facts.workoutPlanTargets);
  add("three_workout_week", workoutWeek?.earnedAt, workoutWeek?.evidence ?? {});
  const meaningfulMonth = firstMeaningfulMonth(active);
  add("first_month", meaningfulMonth, { endingOn: meaningfulMonth, activeDays: 20, windowDays: 30 });
  const firstReview = [...facts.reviewDates].sort()[0];
  add("first_weekly_review", firstReview, { completedAt: firstReview });
  const budgetMonth = [...facts.onTargetBudgetMonths].sort()[0];
  if (budgetMonth) add("budget_month_completed", `${budgetMonth}-28T12:00:00.000Z`, { month: budgetMonth });
  const discipline = firstThirtyOfThirtyFive(active);
  add("thirty_day_discipline", discipline, { endingOn: discipline, activeDays: 30, windowDays: 35 });

  for (const recognition of SCORE_RECOGNITIONS) {
    const snapshot = [...facts.scoreSnapshots]
      .filter((item) => item.coveragePct >= 40 && Number.isFinite(item.score) && item.score >= recognition.threshold)
      .sort((a, b) => a.date.localeCompare(b.date))[0];
    add(recognition.key, snapshot?.date, {
      threshold: recognition.threshold,
      score: snapshot?.score,
      coveragePct: snapshot?.coveragePct,
    });
  }

  return result;

  function add(key: string, earnedAt: string | undefined, evidence: Record<string, unknown>) {
    if (!earnedAt) return;
    const definition = ACHIEVEMENTS.find((item) => item.key === key)!;
    result.push({
      ...definition,
      earnedAt: earnedAt.length === 10 ? `${earnedAt}T12:00:00.000Z` : earnedAt,
      evidence,
    });
  }
}

function firstRun(days: string[], size: number) {
  const set = new Set(days);
  for (const start of days) {
    const date = new Date(`${start}T12:00:00Z`);
    let complete = true;
    for (let index = 1; index < size; index++) {
      const next = new Date(date);
      next.setUTCDate(date.getUTCDate() + index);
      if (!set.has(next.toISOString().slice(0, 10))) {
        complete = false;
        break;
      }
    }
    if (complete) {
      const end = new Date(date);
      end.setUTCDate(date.getUTCDate() + size - 1);
      return end.toISOString().slice(0, 10);
    }
  }
}

function firstFullWeek(days: string[]) {
  const weeks = new Map<string, Set<number>>();
  for (const day of days) {
    const date = new Date(`${day}T12:00:00Z`);
    const monday = new Date(date);
    monday.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
    const key = monday.toISOString().slice(0, 10);
    if (!weeks.has(key)) weeks.set(key, new Set());
    weeks.get(key)!.add(date.getUTCDay());
  }
  for (const [monday, weekdays] of weeks) {
    if (weekdays.size !== 7) continue;
    const end = new Date(`${monday}T12:00:00Z`);
    end.setUTCDate(end.getUTCDate() + 6);
    return end.toISOString().slice(0, 10);
  }
}

function firstCompletedThreeWorkoutPlanWeek(
  completions: AchievementFacts["workoutCompletions"],
  planTargets: AchievementFacts["workoutPlanTargets"],
) {
  const weeks = new Map<string, Map<string, Set<string>>>();
  for (const completion of completions) {
    if (planTargets[completion.planId] !== 3) continue;
    const date = new Date(`${completion.date}T12:00:00Z`);
    const monday = new Date(date);
    monday.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
    const weekKey = monday.toISOString().slice(0, 10);
    if (!weeks.has(weekKey)) weeks.set(weekKey, new Map());
    const plans = weeks.get(weekKey)!;
    if (!plans.has(completion.planId)) plans.set(completion.planId, new Set());
    plans.get(completion.planId)!.add(completion.sessionKey);
  }
  for (const [weekStart, plans] of [...weeks.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    for (const [planId, sessions] of plans) {
      if (sessions.size !== 3) continue;
      const end = new Date(`${weekStart}T12:00:00Z`);
      end.setUTCDate(end.getUTCDate() + 6);
      return {
        earnedAt: end.toISOString().slice(0, 10),
        evidence: { planId, weekEnding: end.toISOString().slice(0, 10), completedSessions: 3, plannedSessions: 3 },
      };
    }
  }
}

function firstMeaningfulMonth(days: string[]) {
  for (let index = 19; index < days.length; index++) {
    const end = new Date(`${days[index]}T12:00:00Z`).getTime();
    const window = days.filter((day) => {
      const value = new Date(`${day}T12:00:00Z`).getTime();
      return value >= end - 29 * 86_400_000 && value <= end;
    });
    if (window.length < 20) continue;
    const first = new Date(`${window[0]}T12:00:00Z`).getTime();
    if (Math.floor((end - first) / 86_400_000) >= 27) return days[index];
  }
}

function firstThirtyOfThirtyFive(days: string[]) {
  for (let index = 29; index < days.length; index++) {
    const end = new Date(`${days[index]}T12:00:00Z`).getTime();
    const window = days.filter((day) => {
      const value = new Date(`${day}T12:00:00Z`).getTime();
      return value >= end - 34 * 86_400_000 && value <= end;
    });
    if (window.length >= 30) return days[index];
  }
}
