export const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
export type Exercise = {
  name: string;
  sets: string;
  reps: string;
  rest?: string;
};
export type TrainingSession = {
  key: string;
  day: string;
  dayIndex: number;
  title: string;
  focus?: string;
  duration: number;
  exercises: Exercise[];
};
export type ScheduleRevision = { from: string; schedule: TrainingSession[] };
export type TrainingPlan = {
  id: string;
  title: string;
  goal: string;
  schedule: TrainingSession[];
  schedule_history?: ScheduleRevision[];
  created_at?: string;
  days_per_week: number;
  session_minutes: number;
};
export type WorkoutStatus =
  | "not_started"
  | "in_progress"
  | "completed"
  | "skipped";

export function userDate(now: Date, timezone = "UTC") {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: validTimezone(timezone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function validTimezone(value: string) {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format();
    return value;
  } catch {
    return "UTC";
  }
}
export function shiftDate(date: string, offset: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}
export function weekday(date: string) {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}
export function dateStart(date: string, timezone: string) {
  let timestamp = Date.parse(`${date}T00:00:00Z`);
  for (let i = 0; i < 3; i++) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: validTimezone(timezone),
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(timestamp));
    const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
    const local = Date.UTC(
      Number(p.year),
      Number(p.month) - 1,
      Number(p.day),
      Number(p.hour),
      Number(p.minute),
      Number(p.second),
    );
    timestamp += Date.parse(`${date}T00:00:00Z`) - local;
  }
  return new Date(timestamp);
}
export function scheduleForDate(
  plan: Pick<
    TrainingPlan,
    "schedule" | "schedule_history" | "created_at"
  > | null,
  date: string,
  timezone = "UTC",
): TrainingSession[] {
  if (
    !plan ||
    (plan.created_at && userDate(new Date(plan.created_at), timezone) > date)
  )
    return [];
  const revisions = plan.schedule_history ?? [];
  const revision = [...revisions].reverse().find((x) => x.from <= date);
  return revision?.schedule ?? plan.schedule ?? [];
}
export function supplementDue(
  frequency: string,
  day: number,
  training: boolean,
) {
  if (frequency === "daily") return true;
  if (frequency === "weekdays") return day > 0 && day < 6;
  if (frequency === "training_days") return training;
  if (frequency === "weekly") return day === 1;
  if (frequency.startsWith("weekly_"))
    return frequency === `weekly_${WEEKDAYS[day].toLowerCase()}`;
  if (frequency.startsWith("days:"))
    return frequency.slice(5).split(",").map(Number).includes(day);
  return false;
}
export function supplementDays(frequency: string, trainingDays: number[]) {
  return [0, 1, 2, 3, 4, 5, 6].filter((day) =>
    supplementDue(frequency, day, trainingDays.includes(day)),
  );
}
export function scheduleLabel(frequency: string) {
  if (frequency.startsWith("days:"))
    return frequency
      .slice(5)
      .split(",")
      .map(Number)
      .map((day) => WEEKDAYS[day])
      .join(", ");
  return frequency.replaceAll("_", " ");
}
export function validFrequency(frequency: string) {
  return (
    ["daily", "weekdays", "training_days", "as_needed", "weekly"].includes(
      frequency,
    ) ||
    WEEKDAYS.some((day) => frequency === `weekly_${day.toLowerCase()}`) ||
    /^days:[0-6](,[0-6])*$/.test(frequency)
  );
}
