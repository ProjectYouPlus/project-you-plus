import {
  scheduleForDate,
  shiftDate,
  supplementDue,
  userDate,
  weekday,
  type TrainingPlan,
} from "./schedule";
export type HealthFactor = {
  id: string;
  category: "training" | "diet" | "supplements" | "consistency" | "recovery";
  label: string;
  impact: number;
  status: "positive" | "neutral" | "needs_attention";
  sourceId?: string;
};
export type HealthScore = {
  overall: number | null;
  training: number | null;
  diet: number | null;
  supplements: number | null;
  consistency: number | null;
  calculatedAt: string;
  factors: HealthFactor[];
};
export type HealthScoreInput = {
  now: Date;
  trackingSince?: string;
  timezone?: string;
  plan: Pick<
    TrainingPlan,
    "id" | "schedule" | "schedule_history" | "created_at"
  > | null;
  planLogs: Array<{
    plan_id: string;
    session_key: string;
    completed_on: string;
    status?: string;
  }>;
  nutritionLogs: Array<{ logged_at: string }>;
  supplements: Array<{ id: string; frequency: string; created_at?: string }>;
  supplementLogs: Array<{ supplement_id: string; logged_on: string }>;
  available?: { training: boolean; diet: boolean; supplements: boolean };
};
const pct = (done: number, total: number) =>
  total ? Math.min(100, Math.max(0, Math.round((done / total) * 100))) : null;
export function calculateHealthScore(input: HealthScoreInput): HealthScore {
  const timezone = input.timezone ?? "UTC",
    today = userDate(input.now, timezone),
    available = input.available ?? {
      training: true,
      diet: true,
      supplements: true,
    };
  let expectedTraining = 0,
    doneTraining = 0,
    expectedSupp = 0,
    doneSupp = 0;
  const meals = new Set(
    input.nutritionLogs.map((x) => userDate(new Date(x.logged_at), timezone)),
  );
  let mealDays = 0;
  const trackedDays = input.trackingSince
    ? Math.max(
        1,
        Math.min(
          7,
          Math.round(
            (Date.parse(today) -
              Date.parse(userDate(new Date(input.trackingSince), timezone))) /
              86400000,
          ) + 1,
        ),
      )
    : 7;
  for (let i = 0; i < 7; i++) {
    const date = shiftDate(today, -i),
      day = weekday(date),
      sessions = scheduleForDate(input.plan, date, timezone).filter(
        (x) => x.dayIndex === day,
      );
    for (const session of sessions) {
      expectedTraining++;
      if (
        input.planLogs.some(
          (log) =>
            log.plan_id === input.plan?.id &&
            log.session_key === session.key &&
            log.completed_on === date &&
            (!log.status || log.status === "completed"),
        )
      )
        doneTraining++;
    }
    if (meals.has(date)) mealDays++;
    for (const supplement of input.supplements) {
      if (
        supplement.created_at &&
        userDate(new Date(supplement.created_at), timezone) > date
      )
        continue;
      if (supplementDue(supplement.frequency, day, sessions.length > 0)) {
        expectedSupp++;
        if (
          input.supplementLogs.some(
            (log) =>
              log.supplement_id === supplement.id && log.logged_on === date,
          )
        )
          doneSupp++;
      }
    }
  }
  const training = available.training
      ? pct(doneTraining, expectedTraining)
      : null,
    diet = available.diet && meals.size ? pct(mealDays, trackedDays) : null,
    supplements = available.supplements ? pct(doneSupp, expectedSupp) : null;
  const values = [training, diet, supplements].filter(
    (x): x is number => x !== null,
  );
  const consistency = values.length
    ? Math.round(values.reduce((a, b) => a + b, 0) / values.length)
    : null;
  const weighted = [
    { v: training, w: 35 },
    { v: diet, w: 30 },
    { v: supplements, w: 20 },
    { v: consistency, w: 15 },
  ].filter((x): x is { v: number; w: number } => x.v !== null);
  const overall = weighted.length
    ? Math.round(
        weighted.reduce((s, x) => s + x.v * x.w, 0) /
          weighted.reduce((s, x) => s + x.w, 0),
      )
    : null;
  const factors: HealthFactor[] = [
    {
      id: "training",
      category: "training",
      label: !available.training
        ? "Training data is temporarily unavailable"
        : expectedTraining
          ? `${doneTraining} of ${expectedTraining} scheduled workouts completed in the last 7 days`
          : "No scheduled training to score in the last 7 days",
      impact: training ?? 0,
      status:
        training === null
          ? "neutral"
          : training === 100
            ? "positive"
            : "needs_attention",
      sourceId: input.plan?.id,
    },
    {
      id: "diet",
      category: "diet",
      label: !available.diet
        ? "Diet data is temporarily unavailable"
        : meals.size
          ? `Meals logged on ${mealDays} of ${trackedDays} tracked days`
          : "No recent meals logged; diet is not scored yet",
      impact: diet ?? 0,
      status:
        diet === null
          ? "neutral"
          : diet === 100
            ? "positive"
            : "needs_attention",
    },
    {
      id: "supplements",
      category: "supplements",
      label: !available.supplements
        ? "Supplement data is temporarily unavailable"
        : expectedSupp
          ? `${doneSupp} of ${expectedSupp} scheduled supplements completed in the last 7 days`
          : "No scheduled supplements to score",
      impact: supplements ?? 0,
      status:
        supplements === null
          ? "neutral"
          : supplements === 100
            ? "positive"
            : "needs_attention",
    },
    {
      id: "recovery",
      category: "recovery",
      label: "Vitals and recovery are optional and do not lower this score",
      impact: 0,
      status: "neutral",
    },
  ];
  return {
    overall,
    training,
    diet,
    supplements,
    consistency,
    calculatedAt: input.now.toISOString(),
    factors,
  };
}
