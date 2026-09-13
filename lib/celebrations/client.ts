import type { FeedbackKind } from "./types";

export function emitFeedback(kind: FeedbackKind) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("py:feedback", { detail: { kind } }));
}

export function feedbackKind(detail: unknown): FeedbackKind | null {
  const kind = typeof detail === "string" ? detail : detail && typeof detail === "object" && "kind" in detail ? detail.kind : null;
  return typeof kind === "string" && ["task", "habit", "workout", "day", "achievement", "milestone", "one"].includes(kind) ? kind as FeedbackKind : null;
}
