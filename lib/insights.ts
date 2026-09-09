import type { AIInsight, Goal, Habit, Task } from "@/lib/types";
import type { ScoreExplanation } from "@/lib/score";

const label: Record<string, string> = {
  fitness: "fitness",
  sleep: "sleep",
  money: "money",
  productivity: "productivity",
  habits: "habit consistency",
  goals: "goal execution",
  learning: "learning",
};

export function buildProactiveInsights(args: {
  score: ScoreExplanation;
  tasks: Task[];
  goals: Goal[];
  habits: Habit[];
}): AIInsight[] {
  const { score, tasks, goals, habits } = args;
  const openCritical = tasks.find((task) => task.tier === "critical" && !task.completedAt);
  const weakestHabit = [...habits].sort((a, b) => a.consistencyPct - b.consistencyPct)[0];
  const slowestGoal = [...goals].filter((g) => g.status === "active").sort((a, b) => a.progress - b.progress)[0];
  const items: AIInsight[] = [];

  if (openCritical) {
    items.push({
      id: "priority-now",
      domain: "productivity",
      type: "recommendation",
      content: `${openCritical.title} is your highest-leverage open task right now${openCritical.meta ? ` — ${openCritical.meta.toLowerCase()}` : ""}. Protect a focused block for it before lower-impact work.`,
      actionTaken: false,
    });
  }

  if (score.opportunity) {
    const opportunity = score.opportunity;
    items.push({
      id: "score-opportunity",
      domain: opportunity.key === "money" ? "finance" : opportunity.key === "fitness" || opportunity.key === "sleep" ? "health" : "productivity",
      type: "observation",
      content: `${label[opportunity.key] ?? opportunity.key} is your lowest calibrated 1% Score category at ${opportunity.value}. Improving it is the clearest way to raise your overall score from ${score.score.score}.`,
      actionTaken: false,
    });
  }

  if (weakestHabit) {
    items.push({
      id: "habit-gap",
      domain: /workout|gym|sleep/i.test(weakestHabit.title) ? "health" : "productivity",
      type: "recommendation",
      content: `${weakestHabit.title} is your least consistent tracked habit at ${weakestHabit.consistencyPct}%. Make the next repetition smaller and easier rather than adding another habit.`,
      actionTaken: false,
    });
  }

  if (slowestGoal) {
    items.push({
      id: "goal-gap",
      domain: slowestGoal.category === "finance" ? "finance" : slowestGoal.category === "fitness" ? "fitness" : "productivity",
      type: "observation",
      content: `${slowestGoal.title} is currently your slowest active goal at ${slowestGoal.progress}% progress. Link at least one task this week directly to its next milestone.`,
      actionTaken: false,
    });
  }

  if (!items.length && score.coveragePct < 40) {
    items.push({
      id: "calibration",
      domain: "productivity",
      type: "recommendation",
      content: "Your score is still calibrating. Add one active goal, one real task, and one repeatable habit before optimizing the number.",
      actionTaken: false,
    });
  }

  return items;
}
