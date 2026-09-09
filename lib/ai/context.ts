import { getProfile } from "@/lib/data/profile";
import { getGoals } from "@/lib/data/goals";
import { getTasks } from "@/lib/data/tasks";
import { getHabits } from "@/lib/data/habits";
import { mockHealth, mockMoney, mockSchedule } from "@/lib/mock-data";
import { calculateOnePercentScore } from "@/lib/score";
import { buildProactiveInsights } from "@/lib/insights";
import type { CalendarEvent, Goal, Habit, HealthSnapshot, MoneySnapshot, Profile, Task } from "@/lib/types";

export interface ProjectYouContext {
  profile: Profile;
  goals: Goal[];
  tasks: Task[];
  habits: Habit[];
  health: HealthSnapshot;
  money: MoneySnapshot;
  schedule: CalendarEvent[];
  score: ReturnType<typeof calculateOnePercentScore>;
  insights: ReturnType<typeof buildProactiveInsights>;
  generatedAt: string;
}

export async function buildProjectYouContext(): Promise<ProjectYouContext> {
  const [profile, goals, tasks, habits] = await Promise.all([
    getProfile(),
    getGoals(),
    getTasks(),
    getHabits(),
  ]);

  const score = calculateOnePercentScore({
    goals,
    tasks,
    habits,
    health: mockHealth,
    money: mockMoney,
  });

  return {
    profile,
    goals,
    tasks,
    habits,
    health: mockHealth,
    money: mockMoney,
    schedule: mockSchedule,
    score,
    insights: buildProactiveInsights({ score, tasks, goals, habits }),
    generatedAt: new Date().toISOString(),
  };
}

export function compactContext(context: ProjectYouContext) {
  return {
    user: {
      name: context.profile.fullName,
      timezone: context.profile.timezone,
      blueprint: context.profile.blueprint,
    },
    onePercentScore: context.score.score,
    scoreBreakdown: context.score.score.breakdown,
    scoreRationale: context.score.rationale,
    goals: context.goals.map(({ id, title, category, target, deadline, progress, objective90day, status }) => ({ id, title, category, target, deadline, progress, objective90day, status })),
    tasks: context.tasks.map(({ id, title, tier, dueAt, completedAt, goalId, meta }) => ({ id, title, tier, dueAt, completedAt, goalId, meta })),
    habits: context.habits,
    health: context.health,
    money: context.money,
    schedule: context.schedule,
    proactiveInsights: context.insights.map((i) => i.content),
    generatedAt: context.generatedAt,
  };
}
