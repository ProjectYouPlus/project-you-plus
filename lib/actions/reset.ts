"use server";

import { revalidatePath } from "next/cache";
import {
  approveResetAdjustment,
  closeResetDay,
  declineResetAdjustment,
  openFirstWeeklyReview,
  rebuildTodaySnapshot,
  resolveNextWeek,
  saveDayOneRealism,
  savePatternFeedback,
  saveWeeklyReflection,
  rescheduleResetTaskToTomorrow,
  moveResetTaskToBacklog,
  pauseResetToday,
  startResetManually,
} from "@/lib/reset/service";
import type { ClosureActionStatus } from "@/lib/reset/engine";

const allowedStatuses = new Set<ClosureActionStatus>(["completed","partial","minimum","skipped","blocked","rescheduled","not_due"]);
const allowedBlockers = new Set(["ran_out_of_time","schedule_changed","low_energy","family_responsibility","forgot","plan_unrealistic","no_longer_relevant","other",""]);

function refresh() {
  for (const path of ["/reset","/today","/coach","/progress","/review","/plan","/you"]) revalidatePath(path);
}

export async function startResetAction() {
  await startResetManually();
  refresh();
}

export async function rebuildResetTodayAction() {
  await rebuildTodaySnapshot();
  refresh();
}

export async function closeResetDayAction(formData: FormData) {
  const actions: Array<{ key: string; status: ClosureActionStatus; blocker?: string | null }> = [];
  for (const [name, raw] of formData.entries()) {
    if (!name.startsWith("status:")) continue;
    const key = name.slice(7).slice(0, 180), status = String(raw) as ClosureActionStatus;
    if (!key || !allowedStatuses.has(status)) continue;
    actions.push({ key, status });
  }
  const blockerRaw = String(formData.get("blocker") ?? "");
  const blocker = allowedBlockers.has(blockerRaw) ? blockerRaw || null : "other";
  const reflection = String(formData.get("reflection") ?? "").slice(0, 500);
  await closeResetDay({ actions, blocker, reflection });
  refresh();
}

export async function saveDayOneRealismAction(formData: FormData) {
  const value = String(formData.get("feeling") ?? "");
  if (!["yes","mostly","too_much","too_little"].includes(value)) throw new Error("Choose how realistic today felt.");
  await saveDayOneRealism(value as "yes"|"mostly"|"too_much"|"too_little");
  refresh();
}

export async function savePatternFeedbackAction(formData: FormData) {
  const value = String(formData.get("feedback") ?? "");
  if (!["yes","partly","no","need_more_time"].includes(value)) throw new Error("Choose a pattern response.");
  await savePatternFeedback(value as "yes"|"partly"|"no"|"need_more_time");
  refresh();
}

export async function approveResetAdjustmentAction(formData: FormData) {
  const id = String(formData.get("recommendationId") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Invalid recommendation.");
  await approveResetAdjustment(id);
  refresh();
}

export async function declineResetAdjustmentAction(formData: FormData) {
  const id = String(formData.get("recommendationId") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Invalid recommendation.");
  await declineResetAdjustment(id);
  refresh();
}

export async function openFirstWeeklyReviewAction() {
  await openFirstWeeklyReview();
  refresh();
}

export async function resolveNextWeekAction(formData: FormData) {
  const value = String(formData.get("resolution") ?? "");
  if (!["approved","keep_current","deferred"].includes(value)) throw new Error("Choose a next-week option.");
  await resolveNextWeek(value as "approved"|"keep_current"|"deferred");
  refresh();
}

export async function saveWeeklyReflectionAction(formData: FormData) {
  await saveWeeklyReflection({
    proudOf: String(formData.get("proudOf") ?? ""),
    harderThanExpected: String(formData.get("harderThanExpected") ?? ""),
    adjustNext: String(formData.get("adjustNext") ?? ""),
    note: String(formData.get("note") ?? "").slice(0, 500),
  });
  refresh();
}

export async function rescheduleResetTaskAction(formData: FormData) {
  const id = String(formData.get("taskId") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Invalid task.");
  await rescheduleResetTaskToTomorrow(id);
  refresh();
}

export async function moveResetTaskToBacklogAction(formData: FormData) {
  const id = String(formData.get("taskId") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Invalid task.");
  await moveResetTaskToBacklog(id);
  refresh();
}

export async function pauseResetTodayAction() {
  await pauseResetToday();
  refresh();
}
