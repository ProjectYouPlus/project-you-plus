import type { ProjectYouContext } from "@/lib/ai/context";

export type UserSpecialist = "planner" | "health" | "finance" | "progress";

export interface CoachOrchestration {
  specialists: UserSpecialist[];
  instructions: string;
  requiresConfirmationForMutation: boolean;
}

const specialistInstructions: Record<UserSpecialist, string> = {
  planner: "PLANNER SPECIALIST: reason about goals, priorities, tasks, habits, calendar commitments, work schedule, conflicts, sequencing, and realistic time allocation. Preserve fixed commitments and prefer the smallest high-leverage next action.",
  health: "HEALTH SPECIALIST: reason about training plan/completion, nutrition, supplements, and connected recovery/vitals. Do not diagnose or change prescription dosing. Use only connected signals and clearly state missing data.",
  finance: "FINANCE SPECIALIST: reason about connected accounts, spending pace, budgets, bills, savings goals, and Finance-score drivers. Distinguish observations/planning from professional financial advice and never promise outcomes.",
  progress: "PROGRESS SPECIALIST: reason about trajectory movement, score rationale, coverage/calibration, streaks, recent behavioral events, achievements, milestones, and cross-domain patterns. Do not recalculate the authoritative deterministic score.",
};

export function orchestrateCoachRequest(message: string, context: ProjectYouContext): CoachOrchestration {
  const normalized = message.toLowerCase();
  const selected = new Set<UserSpecialist>();

  if (/today|tomorrow|plan|schedule|calendar|task|priority|goal|habit|time|focus|overwhelm|busy/.test(normalized)) selected.add("planner");
  if (/health|workout|training|gym|exercise|protein|calorie|meal|diet|nutrition|supplement|sleep|recovery|steps|weight/.test(normalized)) selected.add("health");
  if (/money|finance|spend|spending|budget|cash|bill|saving|savings|account|investment|afford|financial/.test(normalized)) selected.add("finance");
  if (/score|trajectory|progress|improv|declin|week|pattern|consisten|streak|achievement|milestone|1%|one percent|level|neglect/.test(normalized)) selected.add("progress");

  if (selected.size === 0) {
    selected.add("planner");
    selected.add("progress");
  }

  // Questions that explicitly ask for a broad life review benefit from all available domains.
  if (/overall|my life|everything|whole week|what am i neglecting|how am i doing/.test(normalized)) {
    selected.add("planner");
    selected.add("health");
    selected.add("finance");
    selected.add("progress");
  }

  const specialists = Array.from(selected);
  const available = availabilityNote(context);
  return {
    specialists,
    requiresConfirmationForMutation: true,
    instructions: [
      "You are still ONE user-facing Project You+ Coach. The specialist roles below are invisible internal lenses; never mention or expose agent names unless the user explicitly asks about system architecture.",
      ...specialists.map((key) => specialistInstructions[key]),
      available,
      "Synthesize one concise answer. When useful, structure the substance as observation -> why it matters -> recommendation -> expected impact.",
      "If a recommendation would change a plan, schedule, goal, task, habit, financial setting, or other meaningful user data, recommend it first and ask for confirmation. Never claim the mutation happened unless a separate product action executed it.",
    ].join("\n"),
  };
}

function availabilityNote(context: ProjectYouContext) {
  const domains = [
    `planner=${context.tasks.length > 0 || context.goals.length > 0 || context.schedule.length > 0 ? "connected" : "limited"}`,
    `health=${context.training.activePlan || context.nutrition.recentMeals.length || context.supplements.active.length ? "connected" : "limited"}`,
    `finance=${context.financeDetail.accounts.length || context.money.weeklyBudgetPctUsed > 0 ? "connected" : "limited"}`,
    `progress=score ${context.score.score.score}/100 at ${context.score.coveragePct}% coverage`,
  ];
  return `CURRENT DOMAIN AVAILABILITY: ${domains.join(", ")}. Treat limited domains as missing context, not as poor performance.`;
}
