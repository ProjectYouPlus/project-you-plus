"use client";
import Link from "next/link";
import { useState } from "react";
import type { HealthOverview } from "@/lib/data/health";
import {
  updateTrainingDays,
  updateWorkoutStatus,
} from "@/lib/actions/health-plan";
import { WEEKDAYS } from "@/lib/health/schedule";
import { HealthAction } from "./health-action";
export function TrainingSection({
  training,
  error,
}: {
  training: HealthOverview["training"];
  error: boolean;
}) {
  const { activePlan: plan, todayWorkout: workout, status } = training;
  const [days, setDays] = useState<number[]>(
    plan?.schedule.map((x) => x.dayIndex) ?? [],
  );
  if (error)
    return (
      <section className="py-glass-soft p-4">
        <h2>Training</h2>
        <p role="alert">
          Training is temporarily unavailable. Your other Health sections still
          work.
        </p>
      </section>
    );
  return (
    <section id="training" className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="m-0 text-xl font-semibold">Today’s Workout</h2>
        <Link href="/fitness" className="text-xs text-accent-text">
          Manage plan
        </Link>
      </div>
      <div className="py-glass-soft p-4">
        {!plan ? (
          <>
            <p className="font-semibold">No active workout plan.</p>
            <Link
              href="/fitness"
              className="py-button-secondary mt-2 inline-flex"
            >
              Set up training
            </Link>
          </>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="m-0 text-xs text-accent-text">
                  {plan.title} · Active
                </p>
                <h3 className="mt-2 text-xl font-semibold">
                  {workout?.title ?? "Recovery day"}
                </h3>
              </div>
              <span className="py-glass-pill shrink-0">
                {status.replaceAll("_", " ")}
              </span>
            </div>
            {workout ? (
              <>
                <p className="text-xs text-text-3">
                  {workout.focus} · Estimated {workout.duration} min
                </p>
                <div className="mt-3 divide-y divide-border">
                  {workout.exercises.map((exercise, index) => (
                    <div
                      key={index}
                      className="flex items-start justify-between gap-4 py-3"
                    >
                      <span className="min-w-0 break-words text-sm">
                        {exercise.name}
                      </span>
                      <span className="shrink-0 text-right text-xs text-text-2">
                        {exercise.sets} × {exercise.reps}
                        {exercise.rest && (
                          <span className="mt-1 block text-text-3">
                            Rest {exercise.rest}
                          </span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
                {status !== "completed" ? (
                  <div className="mt-3 grid gap-2">
                    <HealthAction
                      className="py-liquid-button w-full"
                      feedback="workout"
                      action={() =>
                        updateWorkoutStatus(plan.id, workout.key, "completed")
                      }
                    >
                      Complete Workout
                    </HealthAction>
                    <div className="grid grid-cols-2 gap-2">
                      <HealthAction
                        disabled={status === "in_progress"}
                        className="py-button-secondary w-full"
                        action={() =>
                          updateWorkoutStatus(
                            plan.id,
                            workout.key,
                            "in_progress",
                          )
                        }
                      >
                        {status === "in_progress"
                          ? "In progress"
                          : "Start workout"}
                      </HealthAction>
                      <HealthAction
                        disabled={status === "skipped"}
                        className="py-button-secondary w-full"
                        action={() =>
                          updateWorkoutStatus(plan.id, workout.key, "skipped")
                        }
                      >
                        Skip today
                      </HealthAction>
                    </div>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-positive" role="status">
                    ✓ Workout completed
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-text-2">
                No workout is scheduled today. Recovery days do not count as
                missed workouts.
              </p>
            )}
            <details className="mt-4 border-t border-border pt-4">
              <summary className="cursor-pointer text-sm font-semibold">
                Training days & active plan
              </summary>
              <p className="text-xs text-text-3">{plan.goal}</p>
              <p className="text-xs text-text-3">
                Choose {plan.schedule.length} days for your existing sessions.
                Save to confirm the change.
              </p>
              <div className="my-3 grid grid-cols-7 gap-1">
                {[1, 2, 3, 4, 5, 6, 0].map((day) => (
                  <button
                    type="button"
                    aria-label={WEEKDAYS[day]}
                    aria-pressed={days.includes(day)}
                    key={day}
                    onClick={() =>
                      setDays((current) =>
                        current.includes(day)
                          ? current.filter((x) => x !== day)
                          : [...current, day],
                      )
                    }
                    className={`min-h-[44px] rounded-xl border text-xs ${days.includes(day) ? "border-accent bg-accent-soft text-accent-text" : "border-border text-text-3"}`}
                  >
                    {WEEKDAYS[day][0]}
                  </button>
                ))}
              </div>
              <ul className="mb-3 space-y-1 pl-4 text-xs text-text-2">
                {plan.schedule.map((session, index) => (
                  <li key={session.key}>
                    {WEEKDAYS[
                      [...days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))[
                        index
                      ]
                    ] ?? "Choose a day"}{" "}
                    — {session.title}
                  </li>
                ))}
              </ul>
              <HealthAction
                disabled={days.length !== plan.schedule.length}
                action={() =>
                  updateTrainingDays(
                    plan.id,
                    [...days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)),
                  )
                }
              >
                Save training days
              </HealthAction>
            </details>
          </>
        )}
      </div>
    </section>
  );
}
