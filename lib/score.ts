import type { DailyScore, Goal, Habit, HealthSnapshot, MoneySnapshot, Task } from "@/lib/types";

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export interface ScoreInputs {
  goals: Goal[];
  tasks: Task[];
  habits: Habit[];
  health: HealthSnapshot;
  money: MoneySnapshot;
  now?: Date;
  personalBest?: number;
  previousScore?: number;
}

export interface ScoreExplanation {
  score: DailyScore;
  strongest: { key: string; value: number };
  opportunity: { key: string; value: number };
  rationale: Record<string, string>;
}

export function calculateOnePercentScore({
  goals,
  tasks,
  habits,
  health,
  money,
  now = new Date(),
  personalBest = 89,
  previousScore = 78,
}: ScoreInputs): ScoreExplanation {
  const habitAverage = habits.length
    ? habits.reduce((sum, habit) => sum + habit.consistencyPct, 0) / habits.length
    : 70;
  const workoutHabit = habits.find((habit) => /workout|train|gym|exercise/i.test(habit.title));
  const sleepHabit = habits.find((habit) => /sleep/i.test(habit.title));
  const learningHabit = habits.find((habit) => /read|learn|study/i.test(habit.title));

  const sleepDurationPct = clamp((health.sleepMinutes / Math.max(1, health.sleepTargetMinutes)) * 100);
  const sleep = clamp(sleepDurationPct * 0.65 + (sleepHabit?.consistencyPct ?? habitAverage) * 0.35);

  const fitness = clamp(
    (workoutHabit?.consistencyPct ?? habitAverage) * 0.55 +
      health.recoveryPct * 0.35 +
      (health.workoutStatus === "completed" ? 10 : health.workoutStatus === "scheduled" ? 6 : 0)
  );

  const budgetPaceScore = money.weeklyBudgetPctUsed <= 80
    ? 92
    : clamp(92 - (money.weeklyBudgetPctUsed - 80) * 3);
  const moneyScore = clamp(money.savingsGoalPct * 0.45 + budgetPaceScore * 0.55);

  const openTasks = tasks.filter((task) => !task.completedAt);
  const completedTasks = tasks.filter((task) => !!task.completedAt);
  const overdueTasks = openTasks.filter((task) => task.dueAt && new Date(task.dueAt).getTime() < now.getTime());
  const openCritical = openTasks.filter((task) => task.tier === "critical").length;
  const completionBonus = tasks.length ? (completedTasks.length / tasks.length) * 10 : 5;
  const productivity = clamp(96 + completionBonus - overdueTasks.length * 12 - openCritical * 4);

  const activeGoals = goals.filter((goal) => goal.status === "active");
  const averageGoalProgress = activeGoals.length
    ? activeGoals.reduce((sum, goal) => sum + goal.progress, 0) / activeGoals.length
    : 50;
  const goalsScore = clamp(averageGoalProgress + 35);
  const learning = clamp(learningHabit?.consistencyPct ?? Math.max(65, habitAverage));
  const habitsScore = clamp(habitAverage);

  const breakdown: Record<string, number> = {
    fitness,
    sleep,
    money: moneyScore,
    productivity,
    habits: habitsScore,
    goals: goalsScore,
    learning,
  };

  const weights: Record<string, number> = {
    fitness: 0.15,
    sleep: 0.15,
    money: 0.15,
    productivity: 0.2,
    habits: 0.15,
    goals: 0.15,
    learning: 0.05,
  };
  const scoreValue = clamp(Object.entries(breakdown).reduce((sum, [key, value]) => sum + value * weights[key], 0));
  const delta = previousScore ? Math.round(((scoreValue - previousScore) / previousScore) * 100) : 0;

  const sorted = Object.entries(breakdown).sort((a, b) => b[1] - a[1]);
  const score: DailyScore = {
    score: scoreValue,
    weeklyDeltaPct: delta,
    personalBest: Math.max(personalBest, scoreValue),
    breakdown,
  };

  return {
    score,
    strongest: { key: sorted[0][0], value: sorted[0][1] },
    opportunity: { key: sorted[sorted.length - 1][0], value: sorted[sorted.length - 1][1] },
    rationale: {
      fitness: `Workout consistency, recovery (${health.recoveryPct}%), and today's workout status.`,
      sleep: `${Math.floor(health.sleepMinutes / 60)}h ${health.sleepMinutes % 60}m versus a ${Math.round(health.sleepTargetMinutes / 60)}h target plus sleep consistency.`,
      money: `${money.savingsGoalPct}% savings-goal progress and ${money.weeklyBudgetPctUsed}% of the weekly budget used.`,
      productivity: `${completedTasks.length}/${tasks.length || 0} tracked tasks complete, ${overdueTasks.length} overdue, ${openCritical} open critical task${openCritical === 1 ? "" : "s"}.`,
      habits: `${Math.round(habitAverage)}% average consistency across ${habits.length} tracked habits.`,
      goals: `${Math.round(averageGoalProgress)}% average progress across ${activeGoals.length} active goals.`,
      learning: learningHabit ? `${learningHabit.consistencyPct}% consistency on ${learningHabit.title}.` : "Based on your overall habit consistency until learning data is connected.",
    },
  };
}
