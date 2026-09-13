import assert from "node:assert/strict";
import test from "node:test";
import { feedbackKind } from "../lib/celebrations/client";

test("completion player reads the event payload emitted by completion actions", () => {
  assert.equal(feedbackKind({ kind: "task" }), "task");
  assert.equal(feedbackKind({ kind: "habit" }), "habit");
  assert.equal(feedbackKind({ kind: "one" }), "one");
  assert.equal(feedbackKind("workout"), "workout");
});
test("invalid completion events cannot reach the sound player", () => {
  for (const detail of [null, undefined, {}, { kind: "invalid" }, { kind: {} }]) assert.equal(feedbackKind(detail), null);
});
