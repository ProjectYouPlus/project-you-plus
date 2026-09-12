import type { FeedbackKind } from "./types";

export function emitFeedback(kind: FeedbackKind) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("py:feedback", { detail: { kind } }));
}
