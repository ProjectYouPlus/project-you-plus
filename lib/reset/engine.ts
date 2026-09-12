export const RESET_VERSION = "2026-09-reset-v1";
export const RESET_SCORE_VERSION = "progression-v1";

export type ResetStatus = "pending" | "active" | "paused" | "awaiting_weekly_review" | "completed";
export type ResetDayStatus = "upcoming" | "available" | "in_progress" | "closed" | "partially_closed" | "missed" | "recovered";
export type ClosureActionStatus = "completed" | "partial" | "minimum" | "skipped" | "blocked" | "rescheduled" | "not_due";
export type ResetActionKind = "task" | "habit" | "workout" | "finance" | "planning";

export type PlannedResetAction = {
  key: string;
  sourceType: ResetActionKind;
  sourceId: string | null;
  title: string;
  domain: string | null;
  due: boolean;
  completed: boolean;
  isPrimary: boolean;
  optional?: boolean;
  durationMinutes: number | null;
  minimumVersion: string | null;
  preferredTime: string | null;
  rescheduled?: boolean;
};

export type ClosureActionInput = { key: string; status: ClosureActionStatus; blocker?: string | null };

export const RESET_DAYS = [
  { day: 1, theme: "Build direction", headline: "Your direction is clear.", focus: "Complete the first meaningful action from the system you approved." },
  { day: 2, theme: "Close a complete day", headline: "Your day is ready.", focus: "Use the full morning-to-evening loop and close the day honestly." },
  { day: 3, theme: "Build consistency", headline: "Consistency is built by repeating what works.", focus: "Repeat the smallest useful version of your real system." },
  { day: 4, theme: "Discover the first pattern", headline: "Project You+ noticed something.", focus: "Look for an early signal supported by your first days of evidence." },
  { day: 5, theme: "Receive a Coach adjustment", headline: "Your system can get smarter.", focus: "Review one evidence-based adjustment, only if one is useful." },
  { day: 6, theme: "See trajectory improvement", headline: "Your trajectory is becoming clearer.", focus: "Compare real evidence without manufacturing progress." },
  { day: 7, theme: "Complete the first Weekly Review", headline: "Your first week is ready to review.", focus: "Turn the first week into a useful next-week plan." },
] as const;

export function dayDefinition(day: number) {
  return RESET_DAYS[Math.max(0, Math.min(6, day - 1))];
}

export function localDateInTimezone(value: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function localClockMinutes(value: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(value);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0) % 24;
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}

export function zonedLocalTimeToUtc(date: string, time: string, timezone: string) {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  let guess = new Date(Date.UTC(year, month - 1, day, hour || 0, minute || 0));
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(guess);
    const read = (kind: string) => Number(parts.find((part) => part.type === kind)?.value ?? 0);
    const observed = Date.UTC(read("year"), read("month") - 1, read("day"), read("hour") % 24, read("minute"));
    const desired = Date.UTC(year, month - 1, day, hour || 0, minute || 0);
    guess = new Date(guess.getTime() + (desired - observed));
  }
  return guess;
}

export function weekdayInTimezone(value: Date, timezone: string) {
  const short = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "short" }).format(value);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(short);
}

export function addLocalDays(date: string, amount: number) {
  const [year, month, day] = date.split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 1, day + amount));
  return value.toISOString().slice(0, 10);
}

export function diffLocalDays(from: string, to: string) {
  const toUtc = (date: string) => {
    const [year, month, day] = date.split("-").map(Number);
    return Date.UTC(year, month - 1, day);
  };
  return Math.floor((toUtc(to) - toUtc(from)) / 86_400_000);
}

export function calculateResetDay(startDate: string | null, localDate: string) {
  if (!startDate) return 0;
  const elapsed = diffLocalDays(startDate, localDate);
  if (elapsed < 0) return 0;
  return Math.min(7, elapsed + 1);
}

function parseTime(value?: string | null) {
  if (!value) return null;
  const match = value.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

export function shouldStartTomorrow(input: {
  now: Date;
  timezone: string;
  sleepTime?: string | null;
  estimatedMinutes?: number | null;
}) {
  const nowMinutes = localClockMinutes(input.now, input.timezone);
  const sleepMinutes = parseTime(input.sleepTime);
  const required = Math.max(90, (input.estimatedMinutes ?? 45) + 30);
  if (sleepMinutes != null) {
    let remaining = sleepMinutes - nowMinutes;
    if (remaining <= -12 * 60) remaining += 24 * 60;
    if (remaining > 0 && remaining < required) return true;
  }
  return nowMinutes >= 20 * 60 + 30;
}

export function actionDueOnDate(action: PlannedResetAction) {
  return action.due && !action.optional;
}

export function dedupeActions(actions: PlannedResetAction[]) {
  const seen = new Set<string>();
  return actions.filter((action) => {
    if (!action.key || seen.has(action.key)) return false;
    seen.add(action.key);
    return true;
  });
}

export function selectPriorityActions(actions: PlannedResetAction[], max = 3) {
  return dedupeActions(actions)
    .filter((action) => action.due && !action.completed)
    .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || Number(a.optional) - Number(b.optional) || (a.durationMinutes ?? 30) - (b.durationMinutes ?? 30))
    .slice(0, max);
}

export function selectMinimumDay(actions: PlannedResetAction[]) {
  const candidates = selectPriorityActions(actions, 20);
  const output: PlannedResetAction[] = [];
  const primary = candidates.find((action) => action.isPrimary) ?? candidates[0];
  if (primary) output.push(primary);
  const health = candidates.find((action) => !output.some((item) => item.key === action.key) && ["health", "fitness"].includes(String(action.domain ?? "").toLowerCase()));
  if (health) output.push(health);
  const reflection = candidates.find((action) => !output.some((item) => item.key === action.key) && ["planning", "discipline", "productivity"].includes(String(action.domain ?? action.sourceType).toLowerCase()));
  if (reflection) output.push(reflection);
  for (const action of candidates) {
    if (output.length >= 3) break;
    if (!output.some((item) => item.key === action.key)) output.push(action);
  }
  return output;
}

export function estimateMinutes(actions: PlannedResetAction[]) {
  return selectPriorityActions(actions, 3).reduce((sum, action) => sum + Math.max(5, action.durationMinutes ?? 15), 0);
}

export function calculateDailyCompletion(planned: PlannedResetAction[], submitted: ClosureActionInput[]) {
  const eligible = dedupeActions(planned).filter((action) => action.due && !action.optional);
  const submittedByKey = new Map(submitted.map((item) => [item.key, item]));
  const statuses = eligible.map((action) => {
    const submittedStatus = submittedByKey.get(action.key)?.status;
    const status: ClosureActionStatus = action.completed ? "completed" : submittedStatus && submittedStatus !== "not_due" ? submittedStatus : "skipped";
    return { key: action.key, status, blocker: submittedByKey.get(action.key)?.blocker ?? null };
  });
  const count = (values: ClosureActionStatus[]) => statuses.filter((row) => values.includes(row.status)).length;
  const completedCount = count(["completed"]);
  const partialCount = count(["partial", "minimum"]);
  const skippedCount = count(["skipped"]);
  const blockedCount = count(["blocked"]);
  const rescheduledCount = count(["rescheduled"]);
  if (!eligible.length) {
    return { eligibleActions: statuses, eligibleCount: 0, completedCount: 0, partialCount: 0, skippedCount: 0, blockedCount: 0, rescheduledCount: 0, completionPercentage: null, dataQuality: "no_eligible_actions" as const };
  }
  const credit = completedCount + partialCount * 0.5;
  const completionPercentage = Math.round((credit / eligible.length) * 100);
  return {
    eligibleActions: statuses,
    eligibleCount: eligible.length,
    completedCount,
    partialCount,
    skippedCount,
    blockedCount,
    rescheduledCount,
    completionPercentage,
    dataQuality: partialCount || skippedCount || blockedCount || rescheduledCount ? "partial" as const : "complete" as const,
  };
}

export function closeState(result: ReturnType<typeof calculateDailyCompletion>): ResetDayStatus {
  if (result.eligibleCount === 0 || result.completionPercentage === 100) return "closed";
  return "partially_closed";
}

export function buildConsistencyTarget(input: { habits: Array<{ title: string; targetPerWeek?: number | null; targetFrequency: string }>; workoutDaysPerWeek?: number | null }) {
  const cadenceHabit = input.habits.find((habit) => (habit.targetPerWeek ?? 0) > 0) ?? input.habits.find((habit) => habit.targetFrequency === "daily");
  if (cadenceHabit) {
    const target = cadenceHabit.targetPerWeek ?? (cadenceHabit.targetFrequency === "daily" ? 7 : 1);
    return { label: `Complete ${cadenceHabit.title} on ${target} of ${target === 7 ? 7 : Math.max(target, 3)} planned opportunities`, target, kind: "habit" as const };
  }
  if ((input.workoutDaysPerWeek ?? 0) > 0) {
    const target = input.workoutDaysPerWeek!;
    return { label: `Complete all ${target} scheduled workout${target === 1 ? "" : "s"}`, target, kind: "workout" as const };
  }
  return { label: "Close four or more planned days this week", target: 4, kind: "day_close" as const };
}

export type PatternCandidate = {
  key: string;
  type: string;
  domain: string | null;
  summary: string;
  evidence: Record<string, unknown>;
  observations: number;
  confidence: number;
  whyItMatters: string;
  proposedAdjustment: string | null;
};

export type PatternInput = {
  completionPercentage: number | null;
  blocker: string | null;
  minimumUsed: boolean;
  closed: boolean;
};

export function detectEarlyPattern(rows: PatternInput[]): PatternCandidate | null {
  const observed = rows.filter((row) => row.closed);
  if (observed.length < 3) return null;
  const minimumCount = observed.filter((row) => row.minimumUsed).length;
  if (minimumCount >= 2) {
    const supportRatio = minimumCount / observed.length;
    const confidence = Math.min(0.82, 0.28 + supportRatio * 0.57 + Math.min(observed.length, 5) * 0.02);
    return {
      key: "minimum-version-return",
      type: "minimum_version_use",
      domain: "discipline",
      summary: "Early signal: the minimum version helped you keep returning to the system.",
      evidence: { minimumUses: minimumCount, observedDays: observed.length },
      observations: observed.length,
      confidence,
      whyItMatters: "A smaller fallback can protect consistency when the full plan is unrealistic.",
      proposedAdjustment: "Keep minimum versions visible on difficult days.",
    };
  }
  const blockerCounts = new Map<string, number>();
  for (const row of observed) if (row.blocker) blockerCounts.set(row.blocker, (blockerCounts.get(row.blocker) ?? 0) + 1);
  const repeated = [...blockerCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  const average = observed.reduce((sum, row) => sum + (row.completionPercentage ?? 0), 0) / observed.length;
  if (repeated && repeated[1] >= 2 && average <= 70) {
    const supportRatio = repeated[1] / observed.length;
    const confidence = Math.min(0.82, 0.28 + supportRatio * 0.57 + Math.min(observed.length, 5) * 0.02);
    return {
      key: `blocker-${repeated[0]}`,
      type: "repeated_blocker",
      domain: null,
      summary: `Early signal: “${humanizeBlocker(repeated[0])}” showed up more than once during lower-completion days.`,
      evidence: { blocker: repeated[0], occurrences: repeated[1], observedDays: observed.length, averageCompletion: Math.round(average) },
      observations: observed.length,
      confidence,
      whyItMatters: "Repeated friction is more useful to adjust than a single difficult day.",
      proposedAdjustment: repeated[0] === "plan_unrealistic" || repeated[0] === "ran_out_of_time" ? "Reduce or reschedule one lower-priority action." : null,
    };
  }
  return null;
}

function humanizeBlocker(value: string) {
  return value.replaceAll("_", " ").replace(/^./, (char) => char.toUpperCase());
}

export function surfacePattern(candidate: PatternCandidate | null) {
  if (!candidate || candidate.observations < 3 || candidate.confidence < 0.6) return null;
  return candidate;
}

export function patternFeedbackState(input: { feedback: "yes" | "partly" | "no" | "need_more_time"; confidence: number; observations: number }) {
  if (input.feedback === "yes") return { status: "confirmed" as const, confidence: Math.max(input.confidence, 0.75) };
  if (input.feedback === "no") return { status: "rejected" as const, confidence: Math.min(input.confidence, 0.35) };
  if (input.feedback === "partly") return { status: "surfaced" as const, confidence: Math.min(0.74, Math.max(0.55, input.confidence)) };
  return { status: "candidate" as const, confidence: Math.min(input.confidence, 0.69) };
}

export function canPromotePatternWithoutFeedback(observations: number, confidence: number) {
  return observations >= 5 && confidence >= 0.75;
}

export function shouldExpirePattern(observations: number, confidence: number) {
  return observations >= 5 && confidence < 0.45;
}

export function buildRecoveryActions(actions: PlannedResetAction[], limit = 3) {
  return selectMinimumDay(actions).slice(0, limit).map((action) => ({
    ...action,
    recoveryTitle: action.minimumVersion ? action.minimumVersion : action.title,
    usesMinimumVersion: Boolean(action.minimumVersion),
  }));
}

export function compareScores(input: {
  starting: number | null;
  current: number | null;
  startingVersion: string | null;
  currentVersion: string | null;
  startingCoverage?: number | null;
  currentCoverage?: number | null;
}) {
  const comparable = input.starting != null && input.current != null && Boolean(input.startingVersion) && input.startingVersion === input.currentVersion;
  if (!comparable) return { comparable: false, movement: null, direction: "calibrating" as const, confidence: "low" as const };
  const movement = input.current! - input.starting!;
  const coverage = Math.min(input.startingCoverage ?? 0, input.currentCoverage ?? 0);
  return {
    comparable: true,
    movement,
    direction: movement > 0 ? "up" as const : movement < 0 ? "down" as const : "flat" as const,
    confidence: coverage >= 75 ? "medium" as const : "low" as const,
  };
}

export function completionGate(input: {
  localDate: string;
  startDate: string | null;
  reviewGenerated: boolean;
  reviewOpened: boolean;
  scoreStateValid: boolean;
  nextWeekResolved: boolean;
  contextRefreshed: boolean;
}) {
  const sevenDaysElapsed = Boolean(input.startDate && diffLocalDays(input.startDate, input.localDate) >= 6);
  return sevenDaysElapsed && input.reviewGenerated && input.reviewOpened && input.scoreStateValid && input.nextWeekResolved && input.contextRefreshed;
}
