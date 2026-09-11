"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { buildUserContext } from "@/lib/ai/context";
import { runStructuredSpecialistTask } from "@/lib/ai/orchestrator";
import { createRecommendation } from "@/lib/ai/recommendations";
import { refreshProgressionAfterMutation } from "@/lib/progression/service";

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
  await refreshProgressionAfterMutation();
  revalidatePath("/fitness"); revalidatePath("/health"); revalidatePath("/dashboard");
  return { error: null };
}

export async function generateWorkoutPlan(formData: FormData) {
  const goal = String(formData.get("goal") ?? "Build strength and improve body composition").trim();
  const requestedDays = formData.getAll("trainingDays").map(Number).filter((value) => Number.isInteger(value) && value >= 0 && value <= 6);
  const fallbackDaysCount = Math.max(1, Math.min(6, Number(formData.get("days") ?? 4)));
  const selectedDays = requestedDays.length ? [...new Set(requestedDays)].sort((a,b)=>a-b) : daySlots(fallbackDaysCount);
  const days = selectedDays.length;
  const minutes = Math.max(25, Math.min(90, Number(formData.get("minutes") ?? 50)));
  const experience = String(formData.get("experience") ?? "intermediate");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in again." };

  let schedule = fallbackPlan(goal, selectedDays, minutes);
  let planTitle = `${days}-Day ${titleCase(goal)} Plan`;
  let source = "project_you_fallback";

  try {
      const context=await buildUserContext();
      const result = await runStructuredSpecialistTask({specialist:"health",context,schema:`{"title":"...","schedule":[{"key":"day-1","day":"Monday","dayIndex":1,"title":"...","focus":"...","duration":${minutes},"exercises":[{"name":"...","sets":"3","reps":"8-10","rest":"90 sec"}]}]}`,request:`Build a practical general-fitness plan for a ${experience} user. Goal: ${goal}. Session length: about ${minutes} minutes. Use only these training days: ${selectedDays.map(dayName).join(", ")}. Include 4-7 exercises per session, distribute recovery sensibly, avoid medical claims and return exactly ${days} sessions.`,maxTokens:1900});
      const parsed = JSON.parse(result.text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim()) as { title?: string; schedule?: PlanSession[] };
      if (Array.isArray(parsed.schedule) && parsed.schedule.length === days) {
        schedule = parsed.schedule.map((session, index) => normalizeSession(session, index, minutes, selectedDays));
        planTitle = String(parsed.title || planTitle).slice(0, 120);
        source = result.provider;
      }
  } catch (error) { console.error("Workout plan specialist fallback:", error); }

  const { data: currentPlan } = await supabase.from("workout_plans").select("id,title").eq("user_id", user.id).eq("active", true).limit(1).maybeSingle();
  const recommendation = await createRecommendation({
    domain: "health",
    observation: currentPlan ? `Your current plan can be rebuilt around ${selectedDays.map(dayName).join(", ")}.` : `A ${days}-day training week fits the days you selected.`,
    supportingEvidence: currentPlan ? [{ table: "workout_plans", id: currentPlan.id, detail: `Currently active: ${currentPlan.title}` }] : [],
    reasonItMatters: "A plan should match your real availability before it changes your active training schedule.",
    suggestedAction: `Activate “${planTitle}” on ${selectedDays.map(dayName).join(", ")}.`,
    expectedImpact: "A realistic weekly structure should make workout consistency easier to sustain.",
    confidence: "high",
    relatedEntities: currentPlan ? [{ type: "workout_plan", id: currentPlan.id, label: currentPlan.title }] : [],
    source: "coach",
    actionType: "workout_plan.activate",
    actionPayload: { title: planTitle, goal, daysPerWeek: days, sessionMinutes: minutes, experience, schedule, source },
    dedupeKey:`workout-plan:${user.id}:${selectedDays.join("-")}:${minutes}:${goal.toLowerCase()}`,
  });
  revalidatePath("/fitness"); revalidatePath("/health"); revalidatePath("/dashboard"); revalidatePath("/coach");
  return { error: null, recommendationId: recommendation.id };
}

export async function confirmWorkoutPlanRecommendation(recommendationId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in again." };
  const { data, error } = await supabase.rpc("activate_workout_plan_recommendation", { p_id: recommendationId });
  if (error) return { error: error.message };
  revalidatePath("/fitness"); revalidatePath("/health"); revalidatePath("/dashboard"); revalidatePath("/coach");
  return { error: null, planId: data as string };
}

export async function completeWorkoutPlanSession(planId: string, sessionKey: string, _durationMinutes: number) {
 const { updateWorkoutStatus } = await import("@/lib/actions/health-plan");
 const result=await updateWorkoutStatus(planId,sessionKey,"completed");
 if(result.error)throw new Error(result.error);
 await refreshProgressionAfterMutation();
}

function normalizeSession(session: PlanSession, index: number, minutes: number, selectedDays:number[]): PlanSession {
  const dayIndex = selectedDays[index] ?? 1;
  return { key: session.key || `session-${index + 1}`, day: dayName(dayIndex), dayIndex, title: session.title || `Training Session ${index + 1}`, focus: session.focus || "Strength and movement quality", duration: Number(session.duration) || minutes, exercises: Array.isArray(session.exercises) ? session.exercises.slice(0, 8).map((exercise) => ({ name: String(exercise.name || "Exercise"), sets: String(exercise.sets || "3"), reps: String(exercise.reps || "8-12"), rest: String(exercise.rest || "60-90 sec") })) : [] };
}

function fallbackPlan(goal: string, selectedDays:number[], minutes: number): PlanSession[] {
  const days=selectedDays.length;
  const templates = days <= 2 ? [fullBody("A"), fullBody("B")] : days === 3 ? [push(), pull(), legs()] : days === 4 ? [upper("A"), lower("A"), upper("B"), lower("B")] : [push(), pull(), legs(), upper("Power"), lower("Athletic"), fullBody("Conditioning")];
  return selectedDays.map((dayIndex, index) => { const template = templates[index % templates.length]; return { key: `day-${index + 1}`, day: dayName(dayIndex), dayIndex, title: template.title, focus: `${template.focus} · ${goal}`, duration: minutes, exercises: template.exercises }; });
}
function daySlots(days: number) { const map: Record<number, number[]> = { 1: [2], 2: [2, 5], 3: [1, 3, 5], 4: [1, 2, 4, 6], 5: [1, 2, 3, 5, 6], 6: [1, 2, 3, 4, 5, 6] }; return map[days] ?? map[4]; }
function dayName(index: number) { return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][index]; }
function ex(name: string, sets = "3", reps = "8-12", rest = "75 sec"): Exercise { return { name, sets, reps, rest }; }
function fullBody(label: string) { return { title: `Full Body ${label}`, focus: "Total-body strength", exercises: [ex("Squat pattern", "3", "6-10"), ex("Horizontal press"), ex("Row"), ex("Hip hinge", "3", "8-10"), ex("Vertical pull", "3", "8-12"), ex("Loaded carry", "3", "30-45 sec")] }; }
function push() { return { title: "Push", focus: "Chest, shoulders, triceps", exercises: [ex("Bench press", "3", "6-10"), ex("Incline dumbbell press"), ex("Shoulder press", "3", "8-10"), ex("Lateral raise", "3", "12-15"), ex("Triceps pressdown", "3", "10-15")] }; }
function pull() { return { title: "Pull", focus: "Back and biceps", exercises: [ex("Pull-up or pulldown", "3", "6-10"), ex("Chest-supported row"), ex("Single-arm row", "3", "10-12"), ex("Rear-delt raise", "3", "12-15"), ex("Biceps curl", "3", "10-15")] }; }
function legs() { return { title: "Legs", focus: "Quads, glutes, hamstrings", exercises: [ex("Squat", "3", "6-10"), ex("Romanian deadlift", "3", "8-10"), ex("Split squat", "3", "8-12 / side"), ex("Leg curl", "3", "10-15"), ex("Calf raise", "3", "12-15")] }; }
function upper(label: string) { return { title: `Upper ${label}`, focus: "Balanced upper-body strength", exercises: [ex("Press", "3", "6-10"), ex("Row", "3", "8-12"), ex("Pulldown", "3", "8-12"), ex("Shoulder press", "2", "8-12"), ex("Lateral raise", "2", "12-15"), ex("Arm superset", "2", "10-15")] }; }
function lower(label: string) { return { title: `Lower ${label}`, focus: "Lower-body strength and stability", exercises: [ex("Squat pattern", "3", "6-10"), ex("Hip hinge", "3", "8-10"), ex("Single-leg movement", "3", "8-12 / side"), ex("Hamstring curl", "2", "10-15"), ex("Calf raise", "3", "12-15"), ex("Core carry", "3", "30 sec")] }; }
function titleCase(value: string) { const short = value.split(/\s+/).slice(0, 4).join(" "); return short.replace(/\b\w/g, (char) => char.toUpperCase()); }
