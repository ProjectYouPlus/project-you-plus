import assert from "node:assert/strict";
import test from "node:test";
import {
  addLocalDays,
  buildConsistencyTarget,
  buildRecoveryActions,
  calculateDailyCompletion,
  calculateResetDay,
  canPromotePatternWithoutFeedback,
  compareScores,
  completionGate,
  detectEarlyPattern,
  localDateInTimezone,
  patternFeedbackState,
  shouldStartTomorrow,
  surfacePattern,
  zonedLocalTimeToUtc,
  type PlannedResetAction,
} from "../lib/reset/engine";

const action = (overrides: Partial<PlannedResetAction> = {}): PlannedResetAction => ({
  key: "task:1", sourceType: "task", sourceId: "1", title: "Primary action", domain: "discipline", due: true, completed: false, isPrimary: true, durationMinutes: 30, minimumVersion: "Do 10 minutes", preferredTime: "09:00", ...overrides,
});

test("reset day advances by local calendar date and never restarts after misses", () => {
  assert.equal(calculateResetDay("2026-11-01", "2026-11-01"), 1);
  assert.equal(calculateResetDay("2026-11-01", "2026-11-06"), 6);
  assert.equal(calculateResetDay("2026-11-01", "2026-11-15"), 7);
  assert.equal(calculateResetDay("2026-11-02", "2026-11-01"), 0);
});

test("local dates remain date-based across DST boundaries", () => {
  assert.equal(addLocalDays("2026-10-31", 1), "2026-11-01");
  assert.equal(addLocalDays("2026-11-01", 1), "2026-11-02");
  assert.equal(localDateInTimezone(new Date("2026-11-01T05:30:00Z"), "America/New_York"), "2026-11-01");
});

test("zoned local scheduling keeps the intended clock time through DST", () => {
  const before = zonedLocalTimeToUtc("2026-10-31", "09:00", "America/New_York");
  const after = zonedLocalTimeToUtc("2026-11-02", "09:00", "America/New_York");
  assert.equal(before.toISOString(), "2026-10-31T13:00:00.000Z");
  assert.equal(after.toISOString(), "2026-11-02T14:00:00.000Z");
});

test("late local onboarding becomes a preparation evening", () => {
  assert.equal(shouldStartTomorrow({ now: new Date("2026-09-13T01:30:00Z"), timezone: "America/New_York", sleepTime: "22:30", estimatedMinutes: 60 }), true);
  assert.equal(shouldStartTomorrow({ now: new Date("2026-09-12T14:00:00Z"), timezone: "America/New_York", sleepTime: "22:30", estimatedMinutes: 60 }), false);
});

test("completion uses eligible real actions only and partial/minimum receive half credit", () => {
  const planned = [
    action(),
    action({ key: "habit:2", sourceType: "habit", sourceId: "2", title: "Habit", isPrimary: false }),
    action({ key: "task:future", sourceId: "future", title: "Future", due: false, isPrimary: false }),
    action({ key: "task:optional", sourceId: "optional", title: "Optional", optional: true, isPrimary: false }),
    action({ key: "task:1", title: "duplicate" }),
  ];
  const result = calculateDailyCompletion(planned, [{ key: "task:1", status: "completed" }, { key: "habit:2", status: "minimum" }]);
  assert.equal(result.eligibleCount, 2);
  assert.equal(result.completedCount, 1);
  assert.equal(result.partialCount, 1);
  assert.equal(result.completionPercentage, 75);
});

test("zero-action days can close without fabricated failure", () => {
  const result = calculateDailyCompletion([action({ due: false })], []);
  assert.equal(result.eligibleCount, 0);
  assert.equal(result.completionPercentage, null);
  assert.equal(result.dataQuality, "no_eligible_actions");
});

test("consistency target matches actual habit cadence", () => {
  const target = buildConsistencyTarget({ habits: [{ title: "Plan tomorrow", targetFrequency: "n_per_week", targetPerWeek: 3 }] });
  assert.equal(target.target, 3);
  assert.match(target.label, /3/);
});

test("patterns require evidence and can honestly remain unavailable", () => {
  assert.equal(detectEarlyPattern([{ completionPercentage: 50, blocker: "ran_out_of_time", minimumUsed: false, closed: true }]), null);
  const pattern = detectEarlyPattern([
    { completionPercentage: 50, blocker: "ran_out_of_time", minimumUsed: false, closed: true },
    { completionPercentage: 60, blocker: "ran_out_of_time", minimumUsed: false, closed: true },
    { completionPercentage: 90, blocker: null, minimumUsed: false, closed: true },
  ]);
  assert.ok(pattern);
  assert.ok(surfacePattern(pattern));
  assert.equal(canPromotePatternWithoutFeedback(3, 0.8), false);
  assert.equal(canPromotePatternWithoutFeedback(5, 0.8), true);
});

test("pattern feedback confirmation/rejection is explicit", () => {
  assert.equal(patternFeedbackState({ feedback: "yes", confidence: 0.62, observations: 3 }).status, "confirmed");
  assert.equal(patternFeedbackState({ feedback: "no", confidence: 0.7, observations: 3 }).status, "rejected");
});

test("recovery path contains only actual planned actions", () => {
  const planned = [action(), action({ key: "workout:2", sourceType: "workout", sourceId: "2", domain: "health", title: "Workout", isPrimary: false, minimumVersion: "15-minute workout" })];
  const recovery = buildRecoveryActions(planned);
  assert.ok(recovery.length <= 3);
  assert.deepEqual(new Set(recovery.map((item) => item.key)).size, recovery.length);
  assert.ok(recovery.every((item) => planned.some((plannedItem) => plannedItem.key === item.key)));
});

test("score comparison refuses mismatched scoring versions and reports flat/decrease honestly", () => {
  assert.equal(compareScores({ starting: 61, current: 64, startingVersion: "v1", currentVersion: "v2" }).comparable, false);
  assert.equal(compareScores({ starting: 61, current: 61, startingVersion: "v1", currentVersion: "v1", startingCoverage: 40, currentCoverage: 50 }).direction, "flat");
  assert.equal(compareScores({ starting: 61, current: 60, startingVersion: "v1", currentVersion: "v1" }).direction, "down");
});

test("completion gate waits for seven days, reviewed review, resolution, and refreshed context", () => {
  const base = { localDate: "2026-09-18", startDate: "2026-09-12", reviewGenerated: true, reviewOpened: true, scoreStateValid: true, nextWeekResolved: true, contextRefreshed: true };
  assert.equal(completionGate(base), true);
  assert.equal(completionGate({ ...base, reviewOpened: false }), false);
  assert.equal(completionGate({ ...base, localDate: "2026-09-17" }), false);
});
