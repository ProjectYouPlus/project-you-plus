import type {
  Profile,
  Goal,
  Task,
  Habit,
  CalendarEvent,
  HealthSnapshot,
  MoneySnapshot,
  AIInsight,
  DailyScore,
  RunMyDayPlan,
  WeeklyReviewData,
} from "./types";

// One coherent demo persona — Michael — used everywhere demo/preview data
// is needed, so every screen tells the same story instead of showing
// unrelated placeholder content. Swap each export for a Supabase query
// (see lib/data/*.ts) once NEXT_PUBLIC_DEMO_MODE=false.

export const mockProfile: Profile = {
  id: "demo-michael",
  fullName: "Michael",
  timezone: "America/Los_Angeles",
  onboardingCompleted: true,
  blueprint: {
    vision:
      "A year from now, I've built real financial cushion, I'm in the best shape of my adult life, and my side business is generating steady income alongside my day job.",
    goals: ["Save $20,000", "Improve fitness", "Launch a side business"],
    priorities: ["Money", "Fitness", "Career"],
    habits: ["Workout 4x/week", "Read daily", "Sleep 7+ hours", "Weekly financial review"],
  },
};

export const mockDailyScore: DailyScore = {
  score: 82,
  weeklyDeltaPct: 6,
  personalBest: 89,
  breakdown: {
    fitness: 84,
    sleep: 68,
    money: 79,
    productivity: 87,
    habits: 90,
    goals: 81,
    learning: 72,
  },
};

// Last 7 days and last 12 weeks of the 1% Score, for Progress screen trends.
export const mockWeeklyTrend: number[] = [74, 76, 79, 75, 80, 78, 82];
export const mockMonthlyTrend: number[] = [61, 64, 63, 68, 70, 69, 73, 75, 74, 78, 80, 82];

export const mockGoals: Goal[] = [
  {
    id: "g1",
    title: "Save $20,000",
    category: "finance",
    target: "$20,000",
    deadline: "2027-06-01",
    progress: 62,
    vision12mo: "A 6-month emergency fund in place, freeing up capital to invest in the business.",
    objective90day: "Automate transfers and cut discretionary spend by 15%.",
    status: "active",
  },
  {
    id: "g2",
    title: "Improve fitness",
    category: "fitness",
    target: "Run a half marathon",
    deadline: "2027-03-15",
    progress: 55,
    vision12mo: "Run a half marathon and reach target bodyweight.",
    objective90day: "Train 4x/week consistently and build a mileage base.",
    status: "active",
  },
  {
    id: "g3",
    title: "Launch a side business",
    category: "career",
    target: "First 3 paying clients",
    deadline: "2026-12-31",
    progress: 30,
    vision12mo: "Replace 20% of income with the side business.",
    objective90day: "Finish the brand and proposal templates, land the first client.",
    status: "active",
  },
];

export const mockHabits: Habit[] = [
  { id: "h1", title: "Workout 4x/week", targetFrequency: "n_per_week", consistencyPct: 84, streakDays: 12 },
  { id: "h2", title: "Read daily", targetFrequency: "daily", consistencyPct: 90, streakDays: 21 },
  { id: "h3", title: "Sleep 7+ hours", targetFrequency: "daily", consistencyPct: 58, streakDays: 2 },
  { id: "h4", title: "Weekly financial review", targetFrequency: "weekly", consistencyPct: 75, streakDays: 3 },
];

export const mockTasks: Task[] = [
  {
    id: "t1",
    goalId: "g3",
    title: "Finish the client proposal",
    tier: "critical",
    dueAt: "2026-09-08T15:00:00-07:00",
    completedAt: null,
    meta: "Due 3:00 PM · Blocks side business goal",
  },
  {
    id: "t2",
    goalId: "g1",
    title: "Set up automatic transfer to savings",
    tier: "important",
    dueAt: "2026-09-11T00:00:00-07:00",
    completedAt: null,
    meta: "Automates progress toward the $20K goal",
  },
  {
    id: "t3",
    goalId: "g2",
    title: "Morning mobility routine",
    tier: "optional",
    dueAt: null,
    completedAt: "2026-09-08T07:10:00-07:00",
    meta: "10 min · Habit streak: 12 days",
  },
  {
    id: "t4",
    goalId: null,
    title: "Read 20 pages",
    tier: "optional",
    dueAt: null,
    completedAt: null,
    meta: "Atomic Habits · Habit: Read daily",
  },
];

export const mockSchedule: CalendarEvent[] = [
  { id: "e1", title: "Workout — Upper body", startAt: "2026-09-08T07:00:00-07:00", endAt: "2026-09-08T07:45:00-07:00", location: "Home gym" },
  { id: "e2", title: "Deep work block — Client proposal", startAt: "2026-09-08T09:30:00-07:00", endAt: "2026-09-08T12:30:00-07:00", location: null, isCurrent: true },
  { id: "e3", title: "Team sync", startAt: "2026-09-08T13:00:00-07:00", endAt: "2026-09-08T13:30:00-07:00", location: "Zoom" },
  { id: "e4", title: "Dinner with Sam", startAt: "2026-09-08T18:00:00-07:00", endAt: "2026-09-08T19:30:00-07:00", location: null },
];

// A full week of mock events for the Calendar screen's week view.
export const mockWeekSchedule: CalendarEvent[] = [
  ...mockSchedule,
  { id: "e5", title: "Long run — 8 miles", startAt: "2026-09-09T07:00:00-07:00", endAt: "2026-09-09T08:15:00-07:00", location: "Riverside trail" },
  { id: "e6", title: "Weekly financial review", startAt: "2026-09-09T20:00:00-07:00", endAt: "2026-09-09T20:30:00-07:00", location: null },
  { id: "e7", title: "Client discovery call", startAt: "2026-09-10T11:00:00-07:00", endAt: "2026-09-10T11:30:00-07:00", location: "Zoom" },
  { id: "e8", title: "Rest day", startAt: "2026-09-11T00:00:00-07:00", endAt: "2026-09-11T23:59:00-07:00", location: null },
  { id: "e9", title: "Workout — Lower body", startAt: "2026-09-12T07:00:00-07:00", endAt: "2026-09-12T07:45:00-07:00", location: "Home gym" },
];

export const mockHealth: HealthSnapshot = {
  sleepMinutes: 385,
  sleepTargetMinutes: 480,
  recoveryPct: 81,
  steps: 4210,
  stepsTarget: 10000,
  waterCups: 3,
  waterTargetCups: 8,
  workoutStatus: "scheduled",
  nutritionStatus: "on_track",
};

export const mockMoney: MoneySnapshot = {
  spentTodayCents: 4200,
  weeklyBudgetPctUsed: 78,
  nextBillLabel: "Sat",
  savingsGoalPct: 62,
};

export const mockInsight: AIInsight = {
  id: "i1",
  domain: "productivity",
  type: "recommendation",
  content:
    "You have 2.5 hours of open time today. Your highest-impact move is finishing the client proposal before 3 PM — your recovery is good enough that shifting the workout to 6 PM costs you nothing.",
  actionTaken: false,
};

export const mockRunMyDayPlan: RunMyDayPlan = {
  explanation:
    "Moved your workout to 6 PM since recovery is high and your morning is better spent on deep work while focus is freshest. Kept dinner with Sam untouched.",
  items: [
    { time: "6:30 AM", title: "Wake" },
    { time: "7:00 AM", title: "Breakfast" },
    { time: "9:30 AM", title: "Deep work — Client proposal", note: "Highest-leverage task, done before the 3 PM deadline" },
    { time: "1:00 PM", title: "Team sync" },
    { time: "2:00 PM", title: "Send proposal" },
    { time: "6:00 PM", title: "Workout — Upper body", note: "Shifted from 7 AM — recovery supports it" },
    { time: "7:30 PM", title: "Dinner with Sam" },
    { time: "10:30 PM", title: "Wind down" },
  ],
};

export const mockWeeklyReview: WeeklyReviewData = {
  score: 82,
  weeklyDeltaPct: 6,
  tasksCompletedLabel: "18/23",
  goalsProgressedLabel: "2 of 3",
  habitConsistencyPct: 79,
  fitnessScore: 84,
  sleepScore: 68,
  moneyScore: 79,
  whatWentWell:
    "A strong financial week — you automated $400 into savings and stayed under budget three days running.",
  needsAttention:
    "Sleep dropped to a 6h 25m average, four nights below your 7-hour target.",
  biggestOpportunity:
    "Protecting a consistent bedtime would likely lift both your fitness and productivity scores — they move together on your low-sleep days.",
  nextWeekPlan: [
    "Set a 10:30 PM wind-down reminder every night, not just weeknights",
    "Keep the 6 PM workout slot — it's working better than mornings this month",
    "Send the client proposal early to create room for a second discovery call",
  ],
};

// Keyed snippets the AI Coach chat matches against. Swap this whole
// function for a real Claude API call — the chat UI already expects
// an async (message: string) => Promise<string> shape.
export async function getMockCoachReply(message: string): Promise<string> {
  const m = message.toLowerCase();

  if (m.includes("focus")) {
    return mockInsight.content;
  }
  if (m.includes("plan my day") || m.includes("plan today")) {
    return "Tap \"Run My Day\" on the Today screen and I'll lay out an optimized schedule — deep work in your morning focus window, workout shifted to evening since recovery is high today.";
  }
  if (m.includes("progress") || m.includes("how am i doing")) {
    return "You're at 82 on your 1% Score, up 6% this week. Your savings goal is 62% there and fitness is trending up, but sleep has been the drag on the week.";
  }
  if (m.includes("holding") || m.includes("stuck")) {
    return "Sleep is the biggest constraint right now — four nights below 7 hours this week, which tends to drag your workout consistency and focus down with it.";
  }
  if (m.includes("opportunity")) {
    return mockWeeklyReview.biggestOpportunity;
  }
  if (m.includes("overwhelm")) {
    return "That's fair — you have one critical task today. Everything else can wait. Want me to clear your afternoon around it?";
  }
  return "Based on what's connected right now, I'd point you at the client proposal — it's the one task today that's both time-boxed and tied directly to your side-business goal.";
}
