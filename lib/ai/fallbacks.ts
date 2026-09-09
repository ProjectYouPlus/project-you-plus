import type { ProjectYouContext } from "@/lib/ai/context";
import type { RunMyDayPlan, WeeklyReviewData } from "@/lib/types";

const domainLabel: Record<string, string> = {
  fitness: "fitness",
  sleep: "sleep",
  money: "money",
  productivity: "productivity",
  habits: "habit consistency",
  goals: "goal execution",
  learning: "learning",
};

export function fallbackCoachReply(message: string, context: ProjectYouContext): string {
  const m = message.toLowerCase();
  const priority = context.insights[0]?.content;
  const opportunity = context.score.opportunity;
  const activeGoals = context.goals.filter((g) => g.status === "active");

  if (m.includes("score") || m.includes("progress") || m.includes("doing")) {
    return `Your 1% Score is ${context.score.score.score}. Your strongest area is ${domainLabel[context.score.strongest.key]} at ${context.score.strongest.value}, while ${domainLabel[opportunity.key]} is the clearest opportunity at ${opportunity.value}. ${priority ?? "Keep the next action tied to an active goal."}`;
  }
  if (m.includes("plan") && (m.includes("day") || m.includes("today"))) {
    return `I’d protect your fixed calendar commitments, then give the first open focus block to your highest-priority unfinished task. ${priority ?? "Use Run My Day to turn that into a schedule."}`;
  }
  if (m.includes("goal")) {
    const slowest = [...activeGoals].sort((a, b) => a.progress - b.progress)[0];
    return slowest ? `${slowest.title} is your slowest active goal at ${slowest.progress}% progress. The best next move is to attach one concrete task to its next milestone this week.` : "You don't have an active goal connected yet.";
  }
  if (m.includes("holding") || m.includes("stuck") || m.includes("opportunity")) {
    return `${domainLabel[opportunity.key]} is currently your lowest category at ${opportunity.value}. ${context.score.rationale[opportunity.key]}`;
  }
  return priority ?? `Your 1% Score is ${context.score.score.score}. Focus on one action that directly advances an active goal before adding more commitments.`;
}

export function fallbackRunMyDay(context: ProjectYouContext): RunMyDayPlan {
  const fixed = [...context.schedule].sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  const priorityTasks = context.tasks
    .filter((task) => !task.completedAt)
    .sort((a, b) => ({ critical: 0, important: 1, optional: 2 }[a.tier] - ({ critical: 0, important: 1, optional: 2 }[b.tier])))
    .slice(0, 2);
  const items: RunMyDayPlan["items"] = [];

  if (priorityTasks[0]) items.push({ time: "9:00 AM", title: priorityTasks[0].title, note: "Highest-impact open task" });
  for (const event of fixed) {
    items.push({
      time: new Date(event.startAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
      title: event.title,
      note: event.location ?? undefined,
    });
  }
  if (priorityTasks[1]) items.push({ time: "3:30 PM", title: priorityTasks[1].title, note: "Second priority after fixed commitments" });
  items.push({ time: "10:30 PM", title: "Wind down", note: context.score.opportunity.key === "sleep" ? "Supports your lowest score category" : "Protect tomorrow's energy" });

  const seen = new Set<string>();
  const deduped = items.filter((item) => {
    const key = `${item.time}-${item.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => new Date(`1970/01/01 ${a.time}`).getTime() - new Date(`1970/01/01 ${b.time}`).getTime());

  return {
    explanation: `This plan protects your fixed commitments and gives the best available focus time to your highest-priority open work. It also protects ${domainLabel[context.score.opportunity.key]} because that is currently your biggest 1% Score opportunity.`,
    items: deduped.slice(0, 10),
  };
}

export function fallbackWeeklyReview(context: ProjectYouContext): WeeklyReviewData {
  const completed = context.tasks.filter((task) => task.completedAt).length;
  const activeGoals = context.goals.filter((goal) => goal.status === "active");
  const progressedGoals = activeGoals.filter((goal) => goal.progress > 0).length;
  const habitAvg = context.habits.length ? Math.round(context.habits.reduce((s, h) => s + h.consistencyPct, 0) / context.habits.length) : 0;
  const opportunity = context.score.opportunity;
  const strongest = context.score.strongest;

  return {
    score: context.score.score.score,
    weeklyDeltaPct: context.score.score.weeklyDeltaPct,
    tasksCompletedLabel: `${completed}/${context.tasks.length}`,
    goalsProgressedLabel: `${progressedGoals} of ${activeGoals.length}`,
    habitConsistencyPct: habitAvg,
    fitnessScore: context.score.score.breakdown.fitness,
    sleepScore: context.score.score.breakdown.sleep,
    moneyScore: context.score.score.breakdown.money,
    whatWentWell: `${domainLabel[strongest.key]} is your strongest current category at ${strongest.value}. Keep the behavior behind it stable rather than trying to optimize everything at once.`,
    needsAttention: `${domainLabel[opportunity.key]} is currently at ${opportunity.value}. ${context.score.rationale[opportunity.key]}`,
    biggestOpportunity: `Raise ${domainLabel[opportunity.key]} with one repeatable action this week. That is the clearest path to lifting your overall 1% Score from ${context.score.score.score}.`,
    nextWeekPlan: [
      context.insights[0]?.content ?? "Protect one daily focus block for your top active goal.",
      context.insights[2]?.content ?? "Keep your highest-consistency habit stable.",
      `Review your ${domainLabel[opportunity.key]} score at the end of the week and adjust one behavior, not five.`,
    ],
  };
}
