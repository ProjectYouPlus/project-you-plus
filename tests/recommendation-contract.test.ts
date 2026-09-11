import assert from "node:assert/strict";
import test from "node:test";
import { normalizeRecommendationAction, recommendationDedupeKey } from "../lib/ai/recommendation-contract";

test("rejects a task mutation without a real context reference",()=>{
 assert.equal(normalizeRecommendationAction("task.complete",{taskId:"invented"},new Set(["tasks:real-task"])),null);
});

test("normalizes a referenced task reschedule",()=>{
 const result=normalizeRecommendationAction("task.reschedule",{taskId:"real-task",dueAt:"2026-09-12T09:00:00-04:00"},new Set(["tasks:real-task"]));
 assert.deepEqual(result,{actionType:"task.reschedule",actionPayload:{taskId:"real-task",dueAt:"2026-09-12T13:00:00.000Z"}});
});

test("rejects invalid calendar ranges",()=>{
 assert.equal(normalizeRecommendationAction("calendar.reschedule",{eventId:"event-1",startAt:"2026-09-12T10:00:00Z",endAt:"2026-09-12T09:00:00Z"},new Set(["calendar_events:event-1"])),null);
});

test("deduplication ignores wording and entity order",()=>{
 const first=recommendationDedupeKey({sourceAgent:"planner",actionType:"task.complete",actionPayload:{taskId:"task-1"},relatedEntities:[{type:"goal",id:"goal-1"},{type:"task",id:"task-1"}]});
 const second=recommendationDedupeKey({sourceAgent:"planner",actionType:"task.complete",actionPayload:{taskId:"task-1"},relatedEntities:[{type:"task",id:"task-1"},{type:"goal",id:"goal-1"}]});
 assert.equal(first,second);
});
