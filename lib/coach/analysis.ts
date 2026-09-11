import type { CoachActionDraft, CoachAnalysis, CoachContextSnapshot, CoachEvidence, SpecialistInsight } from "@/lib/coach/types";
import { specialistsForIntent } from "@/lib/coach/intents";
import { WEEKDAYS } from "@/lib/health/schedule";

const TIER_WEIGHT: Record<string, number> = { critical: 100, important: 65, optional: 25 };

export function analyzeCoachContext(snapshot: CoachContextSnapshot, message: string): CoachAnalysis {
  const specialists = specialistsForIntent(snapshot.intent, snapshot);
  const insights = analysisForIntent(snapshot, message).filter((item) => specialists.includes(item.domain));
  const ranked = rankCoachInsights(insights).slice(0, 3);
  return { intent: snapshot.intent, specialists, insights: ranked, actions: ranked.flatMap((item) => item.action ? [item.action] : []).slice(0, 2) };
}

export function rankCoachInsights(insights: SpecialistInsight[]) {
  return [...insights].sort((a, b) => score(b) - score(a));
}

export function composeCoachResponse(analysis: CoachAnalysis, snapshot: CoachContextSnapshot) {
  if (!analysis.insights.length) return insufficient(snapshot);
  const primary = analysis.insights[0];
  const direct = directAnswer(analysis, snapshot);
  const lines = [direct, "", "Observation", primary.observation, "", "Why it matters", primary.recommendation?.reason ?? meaning(primary, snapshot), "", "Recommended action", recommendationText(analysis), "", "Expected impact", primary.recommendation?.expectedImpact ?? "This focuses the next decision on the strongest available evidence without adding unnecessary commitments."];
  if (analysis.actions.length) lines.push("", `Review the proposed change below, then confirm it before Project You+ updates anything.`);
  if (snapshot.missing.length) lines.push("", `Missing context: ${snapshot.missing.join("; ")}.`);
  return lines.join("\n");
}

export function coachSuggestions(snapshot: CoachContextSnapshot) {
  const prompts = ["What should I focus on today?", "Why did my score change?", "Plan tomorrow."];
  if (snapshot.today.workout && snapshot.today.workout.status !== "completed") prompts.unshift("When should I work out?");
  if (snapshot.finance?.upcomingBills.count || snapshot.finance?.budgetRemaining != null) prompts.unshift("Am I on track financially?");
  if (snapshot.patterns.length) prompts.unshift("What changed this week?");
  return [...new Set(prompts)].slice(0, 4);
}

function analysisForIntent(snapshot: CoachContextSnapshot, message: string): SpecialistInsight[] {
  switch (snapshot.intent) {
    case "today_focus": return todayFocus(snapshot);
    case "score_explanation": return scoreExplanation(snapshot);
    case "tomorrow_planning": return tomorrowPlan(snapshot);
    case "neglect_analysis": return neglect(snapshot);
    case "training_schedule": return trainingSchedule(snapshot, message);
    case "weekly_change": return weeklyChange(snapshot);
    case "finance_status": return financeStatus(snapshot);
    case "goal_blockers": return goalBlockers(snapshot);
    case "health_question": return healthStatus(snapshot);
    case "schedule_question": return tomorrowPlan(snapshot);
    case "progress_question": return progressionAnswer(snapshot, message);
    case "action_request": return requestedAction(snapshot, message);
    default: return todayFocus(snapshot);
  }
}

function progressionAnswer(snapshot: CoachContextSnapshot, message: string): SpecialistInsight[] {
  const state = snapshot.stable.progression?.state;
  if (!state) return [insight("progress", "Your progression level is still calibrating because no canonical progression state has been recorded yet.", [], 70, 35, 80, "Keep logging meaningful actions and open Progress & Achievements to calculate the first level.", "A level needs sustained history; the current score alone is not enough.", "Creates an evidence-backed baseline without inventing progress.", "low")];
  const text = message.toLowerCase(), evidence: CoachEvidence[] = [{ key: "progression_level", value: state.level, sourceType: "user_progression", sourceId: "current" }];
  if (text.includes("achievement") || text.includes("biggest win")) {
    const latest = snapshot.stable.latestAchievements ?? [];
    if (!latest.length) return [insight("progress", "No evidence-backed achievement is recorded yet.", evidence, 60, 25, 65, "Keep completing meaningful actions; Project You+ will unlock achievements only when their evidence is provable.", "Achievements are stored separately from score and cannot be inferred from activity volume alone.", "The next unlock will represent real behavior history.", "high")];
    return [insight("progress", `${latest[0].title} is your latest recorded achievement${latest.length > 1 ? `, followed by ${latest.slice(1, 3).map((item) => item.title).join(" and ")}` : ""}.`, evidence, 80, 30, 75, "Use the underlying behavior as evidence of what is working; no extra activity is required for its own sake.", "These unlocks came from the canonical achievement record.", "Keeps attention on meaningful outcomes rather than collecting badges.", "high")];
  }
  if (text.includes("1%") || text.includes("one percent")) return [insight("progress", `You are Level ${state.level} — ${state.stage}. ${state.onePercentUnlocked ? (state.onePercentCurrent ? "You are currently operating at the 1% standard." : "You earned 1% historically, while your current operating level is lower.") : `The final 1% milestone is ${Math.max(0, 99-state.level)} levels away, with full calibration still required.`}`, evidence, 95, 35, 95, state.limitingFactors[0] ?? "Keep the strongest current behavior stable across the longer horizon.", "1% requires sustained 28 and 90-day performance, balance across active domains, high consistency, enough history, and clean integrity signals.", "Moves the slow progression signal without treating one strong day as qualification.", "high")];
  if (text.includes("keeping") || text.includes("from") || text.includes("close") || text.includes("why")) return [insight("progress", `You are Level ${state.level} — ${state.stage}${state.nextMilestone ? `, moving toward ${state.nextMilestone}` : ""}. ${state.limitingFactors.length ? state.limitingFactors.join("; ") : "No limiting factor is currently stronger than the normal need to sustain this level."}`, evidence, 90, 40, 90, state.limitingFactors[0] ?? "Keep current commitments reliable across the next measured window.", "The level changes gradually from multi-horizon performance, consistency, balance, and priority-weighted execution.", "Improves the limiting evidence while preserving the separation between today's score and long-term progression.", "high")];
  return [insight("progress", `Your current progression is Level ${state.level} — ${state.stage}. Your current score is ${state.currentScore}; it is a faster daily signal and is not your level.`, evidence, 85, 30, 85, state.nextMilestone ? `Keep the most reliable current behavior stable while moving toward Level ${state.nextMilestone}.` : "Maintain the standard across the longer horizon.", "Progression reflects sustained behavior rather than a single score.", "Builds dependable evidence for the next milestone.", "high")];
}

function todayFocus(snapshot: CoachContextSnapshot): SpecialistInsight[] {
  const rows: SpecialistInsight[] = [];
  for (const task of snapshot.today.tasks) {
    const goal = snapshot.goals.find((item) => item.id === task.goalId);
    const urgency = task.overdue ? 100 : task.dueAt ? 80 : 40;
    rows.push(insight("planner", `${task.title} is ${task.overdue ? "overdue and " : ""}the highest-value open ${task.tier} task in today's plan.`, taskEvidence(task), TIER_WEIGHT[task.tier] ?? 25, urgency, goal ? 90 : 45, `Finish “${task.title}” before adding another commitment.`, goal ? `It directly advances ${goal.title}.` : "It closes the most important tracked work.", "Clears the strongest execution priority currently visible to Coach."));
  }
  if (snapshot.today.workout && snapshot.today.workout.status !== "completed") {
    const workout = snapshot.today.workout;
    rows.push(insight("health", `${workout.title} is scheduled today and is still ${workout.status.replaceAll("_", " ")}.`, [{ key: "scheduled_workout", value: workout.title, sourceType: "workout_plans", sourceId: workout.planId }], 75, 70, snapshot.goals.some((goal) => goal.category === "fitness" || goal.category === "health") ? 90 : 55, `Complete the ${workout.duration}-minute ${workout.title} session.`, "It is an existing commitment in the active training plan.", "Protects weekly training adherence without adding a new session."));
  }
  if (snapshot.today.supplements.remaining.length) rows.push(insight("health", `${snapshot.today.supplements.remaining.length} scheduled supplement check-in${snapshot.today.supplements.remaining.length === 1 ? " remains" : "s remain"} today.`, evidenceFromDomain(snapshot, "supplements", snapshot.today.supplements.remaining.length), 40, 50, 35, "Complete the remaining scheduled check-ins you already follow.", "They are part of the user's confirmed routine.", "Closes an existing Health commitment; it does not change the routine."));
  if (snapshot.finance?.upcomingBills.count) rows.push(insight("finance", `${snapshot.finance.upcomingBills.count} tracked bill${snapshot.finance.upcomingBills.count === 1 ? " is" : "s are"} upcoming${snapshot.finance.upcomingBills.next ? `, led by ${snapshot.finance.upcomingBills.next}` : ""}.`, evidenceFromDomain(snapshot, "finance", snapshot.finance.upcomingBills.count), 85, 90, 70, "Protect the upcoming bill before discretionary decisions.", "Upcoming obligations have a direct cash-flow consequence.", "Preserves bill coverage and the current financial trajectory."));
  return rows.length ? rows : [insight("planner", "No deadline task, scheduled workout, or urgent bill is currently visible for today.", [], 20, 20, 20, "Choose one active goal and add a concrete next task.", "Coach cannot prioritize an empty plan without inventing commitments.", "Creates a real priority for the day.", "low")];
}

function scoreExplanation(snapshot: CoachContextSnapshot): SpecialistInsight[] {
  const explanation = snapshot.scores.explanation;
  if (explanation.delta === null || explanation.previousScore === null) return [insight("progress", `Your current 1% Score is ${explanation.currentScore}, but there is no earlier saved score to explain a change.`, [], 60, 40, 50, "Keep completing tracked actions until a second score snapshot is available.", "A score change requires a real before-and-after comparison.", "The next comparison can identify actual drivers instead of guessing.", "low")];
  const changed = explanation.factors.filter((factor) => factor.scoreImpact !== null && factor.scoreImpact !== 0).slice(0, 3);
  const negative = changed.filter((factor) => (factor.scoreImpact ?? 0) < 0);
  const evidence = evidenceFromDomain(snapshot, "recentScores", Math.abs(explanation.delta));
  const detail = changed.length ? changed.map((factor) => `${factor.label} ${signed(factor.scoreImpact ?? 0)}`).join(", ") : "no measured domain factor changed";
  return [insight("progress", `Your 1% Score moved from ${explanation.previousScore} to ${explanation.currentScore} (${signed(explanation.delta)}). The measured factor changes were ${detail}.`, evidence, 100, 70, 80, negative[0] ? `Recover ${negative[0].label} with the next related scheduled action.` : "Keep the strongest current behavior stable.", "The comparison uses saved score factors rather than inference.", negative[0] ? `Targets the largest measured drag (${signed(negative[0].scoreImpact ?? 0)} in ${negative[0].label}).` : "Preserves the measured improvement." )];
}

function tomorrowPlan(snapshot: CoachContextSnapshot): SpecialistInsight[] {
  const commitments = snapshot.tomorrow.calendar;
  const tasks = snapshot.tomorrow.tasks.length ? snapshot.tomorrow.tasks : snapshot.today.tasks.filter((task) => task.overdue).map(({ overdue: _overdue, ...task }) => task);
  const pieces = [commitments.length ? `${commitments.length} fixed calendar commitment${commitments.length === 1 ? "" : "s"}` : "no connected calendar commitments", tasks.length ? `${tasks.length} deadline or carry-forward task${tasks.length === 1 ? "" : "s"}` : "no deadline tasks", snapshot.tomorrow.workout ? `${snapshot.tomorrow.workout.title} training` : "no scheduled workout" ];
  const ordered = [...commitments.map((item) => ({ at: item.startAt, label: `${time(item.startAt, snapshot.timezone)} — ${item.title}` })), ...tasks.slice(0, 2).map((item, index) => ({ at: item.dueAt ?? `999${index}`, label: `Priority — ${item.title}` })), ...(snapshot.tomorrow.workout ? [{ at: "998", label: `Training — ${snapshot.tomorrow.workout.title} (${snapshot.tomorrow.workout.duration} min)` }] : [])].sort((a, b) => a.at.localeCompare(b.at)).map((item) => item.label);
  return [insight("planner", `Tomorrow currently has ${pieces.join(", ")}.`, [...commitments.map(calendarEvidence), ...tasks.flatMap(taskEvidence)], 90, 75, 80, ordered.length ? `Use this conflict-free sequence:\n${ordered.map((item, index) => `${index + 1}. ${item}`).join("\n")}` : "Add one priority or connect the calendar before assigning time blocks.", "The sequence keeps fixed events authoritative and carries forward only overdue work.", "Creates a realistic plan without changing any data or inventing open hours.", commitments.length || tasks.length || snapshot.tomorrow.workout ? "high" : "low")];
}

function neglect(snapshot: CoachContextSnapshot): SpecialistInsight[] {
  const candidates: Array<{ domain: "planner" | "health" | "finance"; label: string; value: number; importance: number; action: string }> = [
    metricCandidate("planner", "priority work", snapshot.week.taskCompletion, 85, "Complete the highest-priority overdue or deadline task."),
    metricCandidate("planner", "habits", snapshot.week.habitCompletion, 70, "Return to the lowest-consistency goal-linked habit."),
    metricCandidate("health", "training", snapshot.week.workoutCompletion, 80, "Protect the next scheduled workout."),
    metricCandidate("health", "nutrition tracking", snapshot.week.nutritionConsistency, 65, "Log the next meal to rebuild a reliable nutrition signal."),
    metricCandidate("health", "supplement routine", snapshot.week.supplementConsistency, 60, "Complete only the scheduled supplement check-ins already in your routine."),
  ].filter((item): item is NonNullable<typeof item> => Boolean(item));
  if (snapshot.finance?.drivers.consistency != null) candidates.push({ domain: "finance", label: "financial consistency", value: snapshot.finance.drivers.consistency, importance: 75, action: snapshot.finance.recommendation?.recommendedAction ?? "Review the largest current budget or bill risk." });
  const activeDomains = candidates.filter((item) => item.value !== null);
  if (!activeDomains.length) return [insight("progress", "There is not enough cross-domain history to identify neglect yet.", [], 50, 40, 50, "Complete and log the next existing commitment.", "Neglect requires repeated evidence in an area the user actively chose to pursue.", "Builds a history Coach can compare without labeling an empty domain as neglected.", "low")];
  const lowest = [...activeDomains].sort((a, b) => (a.value ?? 101) - (b.value ?? 101))[0];
  const goalRelevant = snapshot.goals.some((goal) => lowest.domain === "health" ? goal.category === "health" || goal.category === "fitness" : lowest.domain === "finance" ? goal.category === "finance" : true);
  if (!goalRelevant) return [insight("progress", `${lowest.label} has the weakest measured signal at ${lowest.value}%, but it is not connected to a current goal.`, evidenceFromDomain(snapshot, lowest.domain, lowest.value ?? 0), 55, 40, 30, "Keep it deprioritized unless it becomes a current goal.", "A weak optional area is different from neglect.", "Protects attention for the commitments the user has actually chosen.", "medium")];
  return [insight(lowest.domain, `${capitalize(lowest.label)} is the clearest active area being missed at ${lowest.value}% this week.`, evidenceFromDomain(snapshot, lowest.domain, lowest.value ?? 0), 95, 70, 90, lowest.action, `It is both a current commitment and the weakest repeated measurable behavior.`, `Raises ${lowest.label} consistency without diluting attention across every domain.`, (snapshot.history.eventCount >= 6 ? "high" : "medium"))];
}

function trainingSchedule(snapshot: CoachContextSnapshot, message: string): SpecialistInsight[] {
  const requested = workoutActionFromRequest(snapshot, message);
  if (requested) return [requested];
  const patterns = snapshot.patterns.filter((pattern) => pattern.type.startsWith("workout-adherence-"));
  if (patterns.length >= 2) {
    const sorted = [...patterns].sort((a, b) => rate(b.description) - rate(a.description));
    const best = sorted[0], weakest = sorted.at(-1)!;
    return [insight("health", `${best.description} ${weakest.description}`, [...best.evidence, ...weakest.evidence], 95, 65, 75, `Prefer ${dayFromPattern(best.type)} over ${dayFromPattern(weakest.type)} when the calendar has room.`, "The completion difference is repeated in recorded workout history; it is an association, not proof that workload caused the misses.", "Uses the historically more reliable training day without increasing weekly session count.", best.confidence === "high" && weakest.confidence !== "low" ? "high" : "medium")];
  }
  if (snapshot.tomorrow.workout) return [insight("health", `${snapshot.tomorrow.workout.title} is already scheduled for ${WEEKDAYS[snapshot.tomorrow.workout.dayIndex]}, and tomorrow has ${snapshot.tomorrow.calendar.length} connected calendar commitment${snapshot.tomorrow.calendar.length === 1 ? "" : "s"}.`, [{ key: "workout_plan", value: snapshot.tomorrow.workout.title, sourceType: "workout_plans", sourceId: snapshot.tomorrow.workout.planId }, ...snapshot.tomorrow.calendar.map(calendarEvidence)], 80, 65, 70, `Keep ${snapshot.tomorrow.workout.title} on ${WEEKDAYS[snapshot.tomorrow.workout.dayIndex]} unless a fixed commitment conflicts.`, "There is not enough history to claim another weekday is more reliable.", "Preserves the active plan while Coach collects a stronger adherence pattern.", "medium")];
  return [insight("health", "There is not enough workout history or an active scheduled session to identify the most reliable training day.", [], 50, 40, 45, "Set or complete the current training schedule first.", "Coach needs actual planned and completed sessions to compare weekdays.", "Creates the evidence needed for a grounded schedule recommendation.", "low")];
}

function weeklyChange(snapshot: CoachContextSnapshot): SpecialistInsight[] {
  const current = snapshot.week.comparison.current, previous = snapshot.week.comparison.previous;
  const changes = Object.keys(current).flatMap((key) => current[key] !== null && previous[key] !== null ? [{ key, current: current[key]!, previous: previous[key]!, delta: current[key]! - previous[key]! }] : []).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  if (!changes.length && snapshot.week.overallScoreChange === null) return [insight("progress", "There is not enough comparable current-week and previous-week data to identify a meaningful change.", [], 55, 40, 55, "Keep logging the current plan through the end of the week.", "A comparison needs coverage in both periods.", "The next weekly review can separate a pattern from a one-off day.", "low")];
  const top = changes.slice(0, 3);
  const statement = [snapshot.week.overallScoreChange !== null ? `Overall score ${signed(snapshot.week.overallScoreChange)}` : null, ...top.map((item) => `${label(item.key)} ${signed(item.delta)} points (${item.previous}% → ${item.current}%)`)].filter(Boolean).join("; ");
  const biggest = top[0];
  return [insight("progress", `The largest measured week-over-week changes are: ${statement}.`, evidenceFromDomain(snapshot, "eventHistory", snapshot.week.meaningfulEvents.length), 95, 65, 80, biggest && biggest.delta < 0 ? `Protect the next action tied to ${label(biggest.key)}.` : "Repeat the behavior behind the strongest improvement.", "Only comparable deterministic metrics are included; missing domains are left out.", biggest && biggest.delta < 0 ? `Addresses the largest measured decline in this comparison.` : "Reinforces the strongest measured gain.", "high")];
}

function financeStatus(snapshot: CoachContextSnapshot): SpecialistInsight[] {
  const finance = snapshot.finance;
  if (!finance) return [insight("finance", "Project You+ does not yet have enough Finance data to determine whether you are on track.", [], 70, 55, 75, "Connect an account or add a monthly budget and numeric financial goal.", "A financial status requires confirmed spending, cash-flow, budget, bill, or goal evidence.", "Creates the minimum data needed for an honest trajectory.", "low")];
  const onTrack = finance.score >= 70 && (finance.spendingPacePct === null || finance.spendingPacePct <= 100) && !finance.goals.some((goal) => goal.status === "behind");
  const risks = [finance.spendingPacePct !== null && finance.spendingPacePct > 100 ? `spending pace is ${Math.round(finance.spendingPacePct)}% of the current monthly target pace` : null, finance.goals.find((goal) => goal.status === "behind") ? `${finance.goals.find((goal) => goal.status === "behind")!.name} is behind its configured pace` : null, finance.upcomingBills.count ? `${finance.upcomingBills.count} bill${finance.upcomingBills.count === 1 ? " is" : "s are"} upcoming` : null].filter(Boolean);
  return [insight("finance", `${onTrack ? "You are on track on the currently connected Finance signals" : "The currently connected Finance signals need attention"}. Finance Score is ${finance.score} (${snapshot.contextSections.includes("finance") ? "current" : "available"})${risks.length ? `; ${risks.join("; ")}` : "."}`, evidenceFromDomain(snapshot, "finance", finance.score), 100, risks.length ? 85 : 55, 90, finance.recommendation?.recommendedAction ?? (onTrack ? "Keep the current budget and savings pace stable." : "Review budget room, upcoming bills, and the first behind goal before discretionary spending."), finance.primaryReason, finance.recommendation?.impact ?? "Protects the current cash-flow and goal trajectory without moving money.", "high")];
}

function goalBlockers(snapshot: CoachContextSnapshot): SpecialistInsight[] {
  if (!snapshot.goals.length) return [insight("progress", "No active goal is configured, so Coach cannot identify a behavior blocking goal progress.", [], 70, 60, 100, "Create one active goal with a measurable target and next action.", "A blocker must be evaluated against an intended outcome.", "Gives Project You+ a destination for prioritization.", "low")];
  return snapshot.goals.map((goal) => {
    const blocker = goal.overdueTasks ? `${goal.overdueTasks} linked task${goal.overdueTasks === 1 ? " is" : "s are"} overdue` : goal.openTasks === 0 ? "no open task is linked to the goal" : goal.progress === 0 ? `${goal.openTasks} action${goal.openTasks === 1 ? " is" : "s are"} linked but progress is still 0%` : null;
    const observation = blocker ? `${goal.title} is blocked because ${blocker}.` : `${goal.title} is at ${goal.progress}% with ${goal.openTasks} open linked action${goal.openTasks === 1 ? "" : "s"}; no stronger blocker is proven by the available data.`;
    const evidence: CoachEvidence[] = [{ key: "goal_progress", value: goal.progress, sourceType: "goals", sourceId: goal.id }];
    return insight("progress", observation, evidence, blocker ? 95 : 55, goal.overdueTasks ? 90 : 55, 100, goal.overdueTasks ? "Complete or reschedule the oldest overdue linked task." : goal.openTasks === 0 ? `Add one concrete next task to ${goal.title}.` : "Complete the next linked action before changing the target.", blocker ? "The blocker is specific to the goal's current linked actions." : "Coach will not label normal progress as failure without evidence.", blocker ? "Restores a measurable path toward the goal." : "Keeps progress connected to actual behavior.", blocker ? "high" : "medium");
  });
}

function healthStatus(snapshot: CoachContextSnapshot): SpecialistInsight[] {
  const health = snapshot.health.score;
  if (!health) return [insight("health", "Health Score is unavailable because Project You+ does not have a configured training, nutrition, or supplement signal.", [], 65, 45, 65, "Configure one repeatable Health behavior first.", "A Health explanation needs measured inputs.", "Creates a baseline without diagnosing or prescribing.", "low")];
  const factors = Object.entries(health.drivers).filter(([, value]) => value !== null).sort((a, b) => Number(a[1]) - Number(b[1]));
  const weakest = factors[0];
  return [insight("health", `Health Score is ${health.score}. ${factors.map(([key, value]) => `${label(key)} ${value}`).join(", ")}.`, evidenceFromDomain(snapshot, "health", health.score), 85, 55, 75, weakest ? `Protect the next existing action tied to ${label(weakest[0])}.` : "Keep the current Health routine stable.", "The recommendation targets the lowest measured Health factor and does not infer optional recovery data.", "Improves the clearest measured Health gap.", "high")];
}

function requestedAction(snapshot: CoachContextSnapshot, message: string): SpecialistInsight[] {
  const workout = workoutActionFromRequest(snapshot, message);
  if (workout) return [workout];
  return [insight("planner", "The requested change is not specific enough for a safe typed Coach action.", [], 60, 55, 60, "Name the exact task, workout, goal, or date you want changed.", "Project You+ only offers actions that can be validated against owned records.", "Prevents an ambiguous change while preserving user control.", "low")];
}

function workoutActionFromRequest(snapshot: CoachContextSnapshot, message: string): SpecialistInsight | null {
  const plan = snapshot.health.activePlan;
  if (!plan || !/\b(move|reschedule|change|when should|work out|workout|training)\b/i.test(message)) return null;
  const targetName = message.match(/\b(?:to|on)\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i)?.[1];
  const requestedDay = targetName ? WEEKDAYS.findIndex((day) => day.toLowerCase() === targetName.toLowerCase()) : WEEKDAYS.findIndex((day) => new RegExp(`\\b${day}\\b`, "i").test(message));
  if (requestedDay < 0) return null;
  const sourceName = message.match(/\b(?:from|move(?:\s+my)?)\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i)?.[1];
  const mentionedCurrent = sourceName ? plan.schedule.find((session) => session.day.toLowerCase() === sourceName.toLowerCase()) : plan.schedule.find((session) => new RegExp(`\\b${session.day}\\b`, "i").test(message) && session.dayIndex !== requestedDay);
  const next = mentionedCurrent ?? plan.schedule.find((session) => session.dayIndex !== requestedDay);
  if (!next || plan.schedule.some((session) => session.dayIndex === requestedDay)) return null;
  const nextDays = plan.schedule.map((session) => session.key === next.key ? requestedDay : session.dayIndex);
  const evidence: CoachEvidence[] = [{ key: "active_workout_plan", value: plan.title, sourceType: "workout_plans", sourceId: plan.id }];
  const action: CoachActionDraft = { type: "workout.schedule_move", label: "Move workout", description: `Move ${next.title} from ${WEEKDAYS[next.dayIndex]} to ${WEEKDAYS[requestedDay]}.`, current: `${next.title} — ${WEEKDAYS[next.dayIndex]}`, proposed: `${next.title} — ${WEEKDAYS[requestedDay]}`, payload: { planId: plan.id, sessionKey: next.key, days: nextDays, fromDayIndex: next.dayIndex, toDayIndex: requestedDay }, relatedEntities: [{ type: "workout_plan", id: plan.id, label: plan.title }], evidence, requiresConfirmation: true };
  return insight("health", `${next.title} is currently scheduled for ${WEEKDAYS[next.dayIndex]}; you asked about ${WEEKDAYS[requestedDay]}.`, evidence, 100, 75, 75, `Move ${next.title} to ${WEEKDAYS[requestedDay]} while keeping the same weekly session count.`, "The active plan supports this exact day change and the destination is not already used by another session.", "Changes timing without adding training volume.", "high", action);
}

function insight(domain: SpecialistInsight["domain"], observation: string, evidence: CoachEvidence[], importance: number, urgency: number, goalRelevance: number, action: string, reason: string, expectedImpact: string, confidence: SpecialistInsight["confidence"] = "high", proposedAction?: CoachActionDraft): SpecialistInsight {
  return { domain, observation, evidence, importance, urgency, goalRelevance, recommendation: { action, reason, expectedImpact }, action: proposedAction, confidence: evidence.length ? confidence : "low" };
}
function score(item: SpecialistInsight) { return item.importance * .38 + item.urgency * .27 + item.goalRelevance * .25 + confidenceWeight(item.confidence) * .1; }
function confidenceWeight(value: SpecialistInsight["confidence"]) { return value === "high" ? 100 : value === "medium" ? 65 : 25; }
function meaning(item: SpecialistInsight, snapshot: CoachContextSnapshot) { return item.evidence.length ? `This is supported by ${item.evidence.length} current Project You+ signal${item.evidence.length === 1 ? "" : "s"}.` : snapshot.missing.length ? "The available context is too sparse for a stronger claim." : "This is the clearest current signal."; }
function recommendationText(analysis: CoachAnalysis) { return analysis.insights.map((item, index) => `${index + 1}. ${item.recommendation?.action ?? item.observation}`).join("\n"); }
function directAnswer(analysis: CoachAnalysis, snapshot: CoachContextSnapshot) { const first = analysis.insights[0]; switch (analysis.intent) { case "today_focus": return `Your highest-value focus is ${first.recommendation?.action.replace(/[.]$/, "").toLowerCase() ?? "the first tracked priority"}.`; case "score_explanation": return first.observation; case "tomorrow_planning": return `Tomorrow should protect fixed commitments first, then the highest-priority tracked work${snapshot.tomorrow.workout ? " and scheduled training" : ""}.`; case "neglect_analysis": return first.observation; case "training_schedule": return first.recommendation?.action ?? first.observation; case "weekly_change": return first.observation; case "finance_status": return first.observation; case "goal_blockers": return first.observation; default: return first.observation; } }
function insufficient(snapshot: CoachContextSnapshot) { return `I don't have enough connected Project You+ data to answer that confidently. ${snapshot.missing.length ? `Missing: ${snapshot.missing.join("; ")}.` : "Add one current goal or commitment and I’ll reassess without guessing."}`; }
function taskEvidence(task: { id: string; title: string; tier: string }) { return [{ key: "task_priority", value: `${task.tier}: ${task.title}`, sourceType: "tasks", sourceId: task.id }]; }
function calendarEvidence(event: { id: string; title: string; startAt: string }) { return { key: "calendar_commitment", value: `${event.title} at ${event.startAt}`, sourceType: "calendar_events", sourceId: event.id }; }
function evidenceFromDomain(snapshot: CoachContextSnapshot, domain: string, value: number) { return (snapshot.evidence[domain] ?? []).map((item) => ({ ...item, value })).slice(0, 8); }
function metricCandidate(domain: "planner" | "health", labelValue: string, value: number | null, importance: number, action: string) { return value === null ? null : { domain, label: labelValue, value, importance, action }; }
function rate(description: string) { return Number(description.match(/is (\d+)%/)?.[1] ?? -1); }
function dayFromPattern(type: string) { return WEEKDAYS[Number(type.split("-").at(-1))] ?? "the stronger recorded day"; }
function signed(value: number) { return `${value > 0 ? "+" : ""}${Math.round(value)}`; }
function label(value: string) { return value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase()); }
function capitalize(value: string) { return value.charAt(0).toUpperCase() + value.slice(1); }
function time(value: string, timezone: string) { return new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "numeric", minute: "2-digit" }).format(new Date(value)); }
