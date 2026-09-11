import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateHealthScore,
  type HealthScoreInput,
} from "../lib/health/score";
import {
  userDate,
  dateStart,
  shiftDate,
  supplementDue,
  supplementDays,
  scheduleForDate,
  type TrainingSession,
} from "../lib/health/schedule";
import { validateFoods, macroTotals } from "../lib/health/nutrition";
const session: TrainingSession = {
  key: "push",
  title: "Push",
  day: "Friday",
  dayIndex: 5,
  duration: 45,
  exercises: [{ name: "Press", sets: "3", reps: "8" }],
};
const base: HealthScoreInput = {
  now: new Date("2026-09-11T16:00:00Z"),
  timezone: "America/New_York",
  plan: null,
  planLogs: [],
  nutritionLogs: [],
  supplements: [],
  supplementLogs: [],
};
test("new accounts are not penalized for days before tracking existed", () => {
  const score = calculateHealthScore({
    ...base,
    trackingSince: "2026-09-11T12:00:00Z",
    nutritionLogs: [{ logged_at: "2026-09-11T15:00:00Z" }],
  });
  assert.equal(score.diet, 100);
});
test("empty and optional recovery data produce no invented Health score", () => {
  const score = calculateHealthScore(base);
  assert.equal(score.overall, null);
  assert.equal(score.supplements, null);
  assert.equal(
    score.factors.find((x) => x.category === "recovery")?.status,
    "neutral",
  );
});
test("scheduled workouts alone determine training and starting is not completion", () => {
  const input = {
    ...base,
    plan: { id: "p", schedule: [session] },
    planLogs: [
      {
        plan_id: "p",
        session_key: "push",
        completed_on: "2026-09-11",
        status: "in_progress",
      },
    ],
  };
  assert.equal(calculateHealthScore(input).training, 0);
  input.planLogs[0].status = "completed";
  const score = calculateHealthScore(input);
  assert.equal(score.training, 100);
  assert.equal(score.overall, 100);
  assert.match(score.factors[0].label, /1 of 1/);
});
test("an unscheduled day is not an extra missed workout", () => {
  const score = calculateHealthScore({
    ...base,
    now: new Date("2026-09-12T16:00:00Z"),
    plan: { id: "p", schedule: [session] },
    planLogs: [
      {
        plan_id: "p",
        session_key: "push",
        completed_on: "2026-09-11",
        status: "completed",
      },
    ],
  });
  assert.equal(score.training, 100);
});
test("all supplement schedules follow selected training days", () => {
  assert.equal(supplementDue("daily", 0, false), true);
  assert.equal(supplementDue("weekdays", 6, false), false);
  assert.equal(supplementDue("days:1,3,5", 3, false), true);
  assert.equal(supplementDue("as_needed", 1, true), false);
  assert.deepEqual(supplementDays("training_days", [1, 3, 5]), [1, 3, 5]);
  assert.deepEqual(supplementDays("training_days", [2, 4]), [2, 4]);
});
test("training-day supplement completion uses the same expected schedule", () => {
  const score = calculateHealthScore({
    ...base,
    plan: { id: "p", schedule: [session] },
    supplements: [{ id: "s", frequency: "training_days" }],
    supplementLogs: [
      { supplement_id: "s", logged_on: "2026-09-11" },
      { supplement_id: "s", logged_on: "2026-09-11" },
    ],
  });
  assert.equal(score.supplements, 100);
  assert.ok(score.overall !== null && score.overall <= 100);
});
test("schedule history preserves previous weekday expectations", () => {
  const plan = {
    schedule: [{ ...session, dayIndex: 6 }],
    schedule_history: [
      { from: "2026-09-01", schedule: [session] },
      { from: "2026-09-12", schedule: [{ ...session, dayIndex: 6 }] },
    ],
  };
  assert.equal(scheduleForDate(plan, "2026-09-11")[0].dayIndex, 5);
  assert.equal(scheduleForDate(plan, "2026-09-12")[0].dayIndex, 6);
});
test("user-local dates and DST boundaries are respected", () => {
  assert.equal(
    userDate(new Date("2026-09-12T02:00:00Z"), "America/New_York"),
    "2026-09-11",
  );
  const day = "2026-03-08";
  assert.equal(
    (dateStart(shiftDate(day, 1), "America/New_York").getTime() -
      dateStart(day, "America/New_York").getTime()) /
      36e5,
    23,
  );
});
test("a failed diet source leaves valid training available", () => {
  const score = calculateHealthScore({
    ...base,
    plan: { id: "p", schedule: [session] },
    planLogs: [
      { plan_id: "p", session_key: "push", completed_on: "2026-09-11" },
    ],
    available: { training: true, diet: false, supplements: true },
  });
  assert.equal(score.overall, 100);
  assert.equal(score.diet, null);
});
test("meal macros are summed and malformed AI data is rejected", () => {
  const food = {
    name: "Rice",
    portion: 1,
    unit: "cup",
    calories: 200,
    protein: 4,
    carbs: 45,
    fat: 1,
  };
  assert.equal(macroTotals(validateFoods([food, food])).calories, 400);
  for (const invalid of [
    [],
    [{ ...food, name: "" }],
    [{ ...food, protein: Infinity }],
    [{ ...food, calories: -2 }],
    "bad",
  ]) {
    assert.throws(() => validateFoods(invalid));
  }
});
