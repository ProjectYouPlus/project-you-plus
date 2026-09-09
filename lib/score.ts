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
  strongest: { key: string; value: number } | null;
  opportunity: { key: string; value: number } | null;
  rationale: Record<string, string>;
  coveragePct: number;
}

export function calculateOnePercentScore({
  goals,
  tasks,
  habits,
  health,
  money,
  now = new Date(),
  personalBest = 0,
  previousScore = 0,
}: ScoreInputs): ScoreExplanation {
  const breakdown: Record<string, number> = {};
  const rationale: Record<string, string> = {};
  const weighted: Array<{ key: string; value: number; weight: number }> = [];

  const habitAverage = habits.length
    ? habits.reduce((sum, habit) => sum + habit.consistencyPct, 0) / habits.length
    : null;
  const workoutHabit = habits.find((habit) => /workout|train|gym|exercise/i.test(habit.title));
  const sleepHabit = habits.find((habit) => /sleep/i.test(habit.title));
  const learningHabit = habits.find((habit) => /read|learn|study/i.test(habit.title));

  if (health.sleepMinutes > 0 || sleepHabit) {
    const sleepDurationPct = health.sleepMinutes > 0
      ? clamp((health.sleepMinutes / Math.max(1, health.sleepTargetMinutes)) * 100)
      : null;
    const parts = [sleepDurationPct, sleepHabit?.consistencyPct ?? null].filter((value): value is number => value != null);
    const sleep = clamp(parts.reduce((sum, value) => sum + value, 0) / parts.length);
    add("sleep", sleep, 0.15, health.sleepMinutes > 0
      ? `${Math.floor(health.sleepMinutes / 60)}h ${health.sleepMinutes % 60}m versus a ${Math.round(health.sleepTargetMinutes / 60)}h target${sleepHabit ? " plus sleep consistency" : ""}.`
      : `${sleepHabit?.consistencyPct ?? 0}% consistency on ${sleepHabit?.title ?? "sleep"}.`);
  }

  const hasFitnessSignal = Boolean(workoutHabit) || health.recoveryPct > 0 || health.workoutStatus === "completed" || health.workoutStatus === "scheduled";
  if (hasFitnessSignal) {
    const parts: number[] = [];
    if (workoutHabit) parts.push(workoutHabit.consistencyPct);
    if (health.recoveryPct > 0) parts.push(health.recoveryPct);
    if (health.workoutStatus === "completed") parts.push(100);
    else if (health.workoutStatus === "scheduled") parts.push(70);
    const fitness = clamp(parts.reduce((sum, value) => sum + value, 0) / Math.max(1, parts.length));
    add("fitness", fitness, 0.15, `Based on ${parts.length} real training or recovery signal${parts.length === 1 ? "" : "s"}.`);
  }

  const hasMoneySignal = money.spentTodayCents > 0 || money.weeklyBudgetPctUsed > 0 || money.savingsGoalPct > 0 || Boolean(money.nextBillLabel);
  if (hasMoneySignal) {
    const parts: number[] = [];
    if (money.weeklyBudgetPctUsed > 0) parts.push(money.weeklyBudgetPctUsed <= 100 ? clamp(100 - Math.max(0, money.weeklyBudgetPctUsed - 75) * 2.5) : 0);
    if (money.savingsGoalPct > 0) parts.push(clamp(money.savingsGoalPct));
    if (money.nextBillLabel) parts.push(80);
    const moneyScore = clamp(parts.reduce((sum, value) => sum + value, 0) / Math.max(1, parts.length));
    add("money", moneyScore, 0.15, `Built from the financial signals currently connected to Project You+.`);
  }

  const openTasks = tasks.filter((task) => !task.completedAt);
  const completedTasks = tasks.filter((task) => !!task.completedAt);
  const overdueTasks = openTasks.filter((task) => task.dueAt && new Date(task.dueAt).getTime() < now.getTime());
  const openCritical = openTasks.filter((task) => task.tier === "critical").length;
  if (tasks.length) {
    const completionPct = (completedTasks.length / tasks.length) * 100;
    const productivity = clamp(completionPct - overdueTasks.length * 8 - openCritical * 3);
    add("productivity", productivity, 0.2, `${completedTasks.length}/${tasks.length} tracked tasks complete, ${overdueTasks.length} overdue, ${openCritical} open critical task${openCritical === 1 ? "" : "s"}.`);
  }

  const activeGoals = goals.filter((goal) => goal.status === "active");
  if (activeGoals.length) {
    const averageGoalProgress = activeGoals.reduce((sum, goal) => sum + goal.progress, 0) / activeGoals.length;
    add("goals", clamp(averageGoalProgress), 0.15, `${Math.round(averageGoalProgress)}% average progress across ${activeGoals.length} active goal${activeGoals.length === 1 ? "" : "s"}.`);
  }

  if (habitAverage != null) {
    add("habits", clamp(habitAverage), 0.15, `${Math.round(habitAverage)}% average consistency across ${habits.length} tracked habit${habits.length === 1 ? "" : "s"}.`);
  }

  if (learningHabit) {
    add("learning", clamp(learningHabit.consistencyPct), 0.05, `${learningHabit.consistencyPct}% consistency on ${learningHabit.title}.`);
  }

  const totalWeight = weighted.reduce((sum, item) => sum + item.weight, 0);
  const scoreValue = totalWeight
    ? clamp(weighted.reduce((sum, item) => sum + item.value * item.weight, 0) / totalWeight)
    : 0;
  const delta = previousScore > 0 ? Math.round(((scoreValue - previousScore) / previousScore) * 100) : 0;
  const sorted = Object.entries(breakdown).sort((a, b) => b[1] - a[1]);
  const possibleWeight = 1;
  const coveragePct = Math.min(100, Math.round((totalWeight / possibleWeight) * 100));

  const score: DailyScore = {
    score: scoreValue,
    weeklyDeltaPct: delta,
    personalBest: Math.max(personalBest, scoreValue),
    breakdown,
  };

  return {
    score,
    strongest: sorted.length ? { key: sorted[0][0], value: sorted[0][1] } : null,
    opportunity: sorted.length ? { key: sorted[sorted.length - 1][0], value: sorted[sorted.length - 1][1] } : null,
    rationale,
    coveragePct,
  };

  function add(key: string, value: number, weight: number, reason: string) {
    breakdown[key] = value;
    rationale[key] = reason;
    weighted.push({ key, value, weight });
  }
}
