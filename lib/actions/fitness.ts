"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { callProjectYouAI, hasCloudAI } from "@/lib/ai/provider";

type Exercise = { name: string; sets: string; reps: string; rest?: string };
type PlanSession = { key: string; day: string; dayIndex: number; title: string; focus: string; duration: number; exercises: Exercise[] };

export async function addWorkout(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const type = String(formData.get("type") ?? "strength");
  const duration = Number(formData.get("duration"));
  if (!title) return { error: "Name the workout." };
  if (!Number.isFinite(duration) || duration <= 0) return { error: "Enter a valid duration." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in again." };
  const { error } = await supabase.from("workouts").insert({ user_id: user.id, title, type, duration_minutes: duration, source: "manual" });
  if (error) return { error: error.message };
  revalidatePath("/fitness");
  revalidatePath("/health");
  revalidatePath("/dashboard");
  return { error: null };
}

export async function generateWorkoutPlan(formData: FormData) {
  const goal = String(formData.get("goal") ?? "Build strength and improve body composition").trim();
  const days = Math.max(1, Math.min(6, Number(formData.get("days") ?? 4)));
  const minutes = Math.max(25, Math.min(90, Number(formData.get("minutes") ?? 50)));
  const experience = String(formData.get("experience") ?? "intermediate");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in again." };

  let schedule = fallbackPlan(goal, days, minutes);
  let planTitle = `${days}-Day ${titleCase(goal)} Plan`;
  let source = "project_you_fallback";

  if (hasCloudAI()) {
    try {
      const result = await callProjectYouAI({
        system: "You are the Project You+ training planner. Build practical general-fitness plans for healthy adults from the user's stated goal, experience, training frequency, and available session time. Avoid medical claims, max-effort testing, extreme volume, or pretending to know injuries/equipment not provided. Return valid JSON only, without markdown.",
        messages: [{ role: "user", content: `Create a ${days}-day-per-week workout plan for a ${experience} user. Goal: ${goal}. Session length: about ${minutes} minutes. Return exactly {"title":"...","schedule":[{"key":"day-1","day":"Monday","dayIndex":1,"title":"...","focus":"...","duration":${minutes},"exercises":[{"name":"...","sets":"3","reps":"8-10","rest":"90 sec"}]}]}. Use dayIndex 0=Sunday through 6=Saturday. Include 4-7 exercises per session, distribute recovery sensibly, and return exactly ${days} sessions.` }],
        maxTokens: 1900,
      });
      const parsed = JSON.parse(result.text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim()) as { title?: string; schedule?: PlanSession[] };
      if (Array.isArray(parsed.schedule) && parsed.schedule.length === days) {
        schedule = parsed.schedule.map((session, index) => normalizeSession(session, index, minutes));
        planTitle = String(parsed.title || planTitle).slice(0, 120);
        source = result.provider;
      }
    } catch (error) {
      console.error("Workout plan cloud AI fallback:", error);
    }
  }

  await supabase.from("workout_plans").update({ active: false }).eq("user_id", user.id).eq("active", true);
  const { error } = await supabase.from("workout_plans").insert({
    user_id: user.id,
    title: planTitle,
    goal,
    days_per_week: days,
    session_minutes: minutes,
    experience,
    schedule,
    active: true,
    source,
  });
  if (error) return { error: error.message };

  revalidatePath("/fitness");
  revalidatePath("/health");
  revalidatePath("/dashboard");
  revalidatePath("/coach");
  return { error: null };
}

export async function completeWorkoutPlanSession(planId: string, sessionKey: string, durationMinutes: number) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const today = new Date().toISOString().slice(0, 10);
  const { data: existing } = await supabase.from("workout_plan_logs").select("id").eq("plan_id", planId).eq("session_key", sessionKey).eq("completed_on", today).maybeSingle();
  if (!existing) {
    await supabase.from("workout_plan_logs").insert({ user_id: user.id, plan_id: planId, session_key: sessionKey, completed_on: today, duration_minutes: durationMinutes });
    const { data: plan } = await supabase.from("workout_plans").select("schedule").eq("id", planId).maybeSingle();
    const session = Array.isArray(plan?.schedule) ? (plan.schedule as PlanSession[]).find((item) => item.key === sessionKey) : null;
    await supabase.from("workouts").insert({ user_id: user.id, title: session?.title ?? "Planned workout", type: "strength", duration_minutes: durationMinutes, source: "plan" });
  }
  revalidatePath("/fitness");
  revalidatePath("/health");
  revalidatePath("/dashboard");
  revalidatePath("/review");
}

function normalizeSession(session: PlanSession, index: number, minutes: number): PlanSession {
  const fallbackDays = daySlots(Math.max(1, index + 1));
  const dayIndex = Number.isInteger(session.dayIndex) && session.dayIndex >= 0 && session.dayIndex <= 6 ? session.dayIndex : fallbackDays[Math.min(index, fallbackDays.length - 1)];
  return {
    key: session.key || `session-${index + 1}`,
    day: session.day || dayName(dayIndex),
    dayIndex,
    title: session.title || `Training Session ${index + 1}`,
    focus: session.focus || "Strength and movement quality",
    duration: Number(session.duration) || minutes,
    exercises: Array.isArray(session.exercises) ? session.exercises.slice(0, 8).map((exercise) => ({ name: String(exercise.name || "Exercise"), sets: String(exercise.sets || "3"), reps: String(exercise.reps || "8-12"), rest: String(exercise.rest || "60-90 sec") })) : [],
  };
}

function fallbackPlan(goal: string, days: number, minutes: number): PlanSession[] {
  const slots = daySlots(days);
  const templates: Array<{ title: string; focus: string; exercises: Exercise[] }> = days <= 2
    ? [fullBody("A"), fullBody("B")]
    : days === 3
      ? [push(), pull(), legs()]
      : days === 4
        ? [upper("A"), lower("A"), upper("B"), lower("B")]
        : [push(), pull(), legs(), upper("Power"), lower("Athletic"), fullBody("Conditioning")];
  return slots.map((dayIndex, index) => {
    const template = templates[index % templates.length];
    return { key: `day-${index + 1}`, day: dayName(dayIndex), dayIndex, title: template.title, focus: `${template.focus} · ${goal}`, duration: minutes, exercises: template.exercises };
  });
}

function daySlots(days: number) {
  const map: Record<number, number[]> = { 1: [2], 2: [2, 5], 3: [1, 3, 5], 4: [1, 2, 4, 6], 5: [1, 2, 3, 5, 6], 6: [1, 2, 3, 4, 5, 6] };
  return map[days] ?? map[4];
}
function dayName(index: number) { return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][index]; }
function ex(name: string, sets = "3", reps = "8-12", rest = "75 sec"): Exercise { return { name, sets, reps, rest }; }
function fullBody(label: string) { return { title: `Full Body ${label}`, focus: "Total-body strength", exercises: [ex("Squat pattern", "3", "6-10"), ex("Horizontal press"), ex("Row"), ex("Hip hinge", "3", "8-10"), ex("Vertical pull", "3", "8-12"), ex("Loaded carry", "3", "30-45 sec")] }; }
function push() { return { title: "Push", focus: "Chest, shoulders, triceps", exercises: [ex("Bench press", "3", "6-10"), ex("Incline dumbbell press"), ex("Shoulder press", "3", "8-10"), ex("Lateral raise", "3", "12-15"), ex("Triceps pressdown", "3", "10-15")] }; }
function pull() { return { title: "Pull", focus: "Back and biceps", exercises: [ex("Pull-up or pulldown", "3", "6-10"), ex("Chest-supported row"), ex("Single-arm row", "3", "10-12"), ex("Rear-delt raise", "3", "12-15"), ex("Biceps curl", "3", "10-15")] }; }
function legs() { return { title: "Legs", focus: "Quads, glutes, hamstrings", exercises: [ex("Squat", "3", "6-10"), ex("Romanian deadlift", "3", "8-10"), ex("Split squat", "3", "8-12 / side"), ex("Leg curl", "3", "10-15"), ex("Calf raise", "3", "12-15")] }; }
function upper(label: string) { return { title: `Upper ${label}`, focus: "Balanced upper-body strength", exercises: [ex("Press", "3", "6-10"), ex("Row", "3", "8-12"), ex("Pulldown", "3", "8-12"), ex("Shoulder press", "2", "8-12"), ex("Lateral raise", "2", "12-15"), ex("Arm superset", "2", "10-15")] }; }
function lower(label: string) { return { title: `Lower ${label}`, focus: "Lower-body strength and stability", exercises: [ex("Squat pattern", "3", "6-10"), ex("Hip hinge", "3", "8-10"), ex("Single-leg movement", "3", "8-12 / side"), ex("Hamstring curl", "2", "10-15"), ex("Calf raise", "3", "12-15"), ex("Core carry", "3", "30 sec")] }; }
function titleCase(value: string) { const short = value.split(/\s+/).slice(0, 4).join(" "); return short.replace(/\b\w/g, (char) => char.toUpperCase()); }
