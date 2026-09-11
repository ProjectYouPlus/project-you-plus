import type { CoachContextSnapshot, CoachIntent } from "@/lib/coach/types";
import type { Specialist } from "@/lib/types/agent-observations";

export function resolveCoachIntent(message: string): CoachIntent {
  const text = message.trim().toLowerCase();
  if (/\b(what should i|what do i).*(focus|do).*(today|tonight)|\bfocus on (today|tonight)\b/.test(text)) return "today_focus";
  if (/\bwhy\b.*\bscore\b.*\b(fall|fell|drop|dropped|change|changed|down)\b|\bwhy did my score\b/.test(text)) return "score_explanation";
  if (/\b(plan|organize|schedule)\b.*\btomorrow\b|\btomorrow'?s plan\b/.test(text)) return "tomorrow_planning";
  if (/\b(what am i|where am i).*(neglect|ignoring|missing)|\bneglecting\b/.test(text)) return "neglect_analysis";
  if (/\bwhen\b.*\b(work out|workout|train|exercise)\b|\bbest.*\b(training|workout) day\b/.test(text)) return "training_schedule";
  if (/\bwhat changed\b.*\b(this|the) week\b|\bweek over week\b|\bweekly change\b/.test(text)) return "weekly_change";
  if (/\b(on track|doing|status)\b.*\b(financial|financially|finance|money)\b|\bfinancially on track\b/.test(text)) return "finance_status";
  if (/\b(what|why).*(keeping|stopping|blocking|preventing).*(goal|goals)|\bgoal blockers?\b/.test(text)) return "goal_blockers";
  if (/\b(move|reschedule|change|apply|create|add|update|set|mark|complete)\b/.test(text)) return "action_request";
  if (/\b(health|nutrition|diet|supplement|recovery|sleep)\b/.test(text)) return "health_question";
  if (/\b(calendar|schedule|available|free time|overlap|conflict)\b/.test(text)) return "schedule_question";
  if (/\b(progress|trend|trajectory|achievement|milestone|consistency)\b/.test(text)) return "progress_question";
  return "general_coaching";
}

export function specialistsForIntent(intent: CoachIntent, snapshot?: CoachContextSnapshot): Specialist[] {
  const map: Record<CoachIntent, Specialist[]> = {
    today_focus: ["planner", "progress"],
    score_explanation: ["progress"],
    tomorrow_planning: ["planner", "health"],
    neglect_analysis: ["progress", "planner", "health", "finance"],
    training_schedule: ["health", "planner", "progress"],
    weekly_change: ["progress", "planner", "health", "finance"],
    finance_status: ["finance", "progress"],
    goal_blockers: ["progress", "planner"],
    health_question: ["health"],
    schedule_question: ["planner"],
    progress_question: ["progress"],
    action_request: ["planner", "health"],
    general_coaching: ["planner"],
  };
  const selected = new Set(map[intent]);
  if (snapshot && intent === "today_focus") {
    if (snapshot.today.workout || snapshot.today.supplements.remaining.length) selected.add("health");
    if (snapshot.finance?.upcomingBills.count) selected.add("finance");
  }
  if (snapshot && intent === "goal_blockers") {
    if (snapshot.goals.some((goal) => goal.category === "health" || goal.category === "fitness")) selected.add("health");
    if (snapshot.goals.some((goal) => goal.category === "finance")) selected.add("finance");
  }
  return [...selected].slice(0, 4);
}

export function historyWindowForIntent(intent: CoachIntent) {
  if (["neglect_analysis", "training_schedule", "goal_blockers", "progress_question"].includes(intent)) return 56;
  if (["score_explanation", "weekly_change"].includes(intent)) return 28;
  return 14;
}
