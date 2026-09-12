import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";

const migration = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/20260912143000_seven_day_project_you_reset_v1.sql"), "utf8");
const hardening = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/20260912144500_reset_private_event_boundary.sql"), "utf8");
const service = fs.readFileSync(path.join(process.cwd(), "lib/reset/service.ts"), "utf8");

test("Reset persistence is idempotent per enrollment and local date", () => {
  assert.match(migration, /unique\s+(?:index[^\n]+)?[^\n]*reset_daily_snapshots[^\n]*\(enrollment_id,\s*local_date\)/i);
  assert.match(migration, /unique\s+(?:index[^\n]+)?[^\n]*reset_daily_closures[^\n]*\(enrollment_id,\s*local_date\)/i);
  assert.match(service, /eq\("enrollment_id",\s*enrollment\.id\)\.eq\("local_date",\s*localDate\)/);
});

test("Reset tables enforce own-row RLS", () => {
  for (const table of ["reset_enrollments", "reset_daily_snapshots", "reset_daily_closures", "reset_patterns"]) {
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`, "i"));
  }
  assert.match(migration, /auth\.uid\(\)\s*=\s*user_id/i);
});

test("auto enrollment only follows initial completed activated onboarding", () => {
  assert.match(migration, /new\.mode\s*=\s*'initial'/i);
  assert.match(migration, /new\.status\s*=\s*'completed'/i);
  assert.match(migration, /new\.activated_at\s+is\s+not\s+null/i);
  assert.match(migration, /source_onboarding_session_id/i);
  assert.ok(!migration.includes("new.mode = 'personalize'"));
});

test("meaningful Reset events are allowlisted and screen views stay analytics-only", () => {
  for (const event of ["reset.started", "reset.day_closed", "reset.minimum_day_used", "reset.returned", "reset.pattern_detected", "reset.pattern_confirmed", "reset.pattern_rejected", "reset.adjustment_proposed", "reset.adjustment_approved", "reset.weekly_review_completed", "reset.completed"]) {
    assert.ok(migration.includes(event), event);
  }
  assert.ok(!migration.includes("reset.screen_opened"));
});

test("Reset meaningful-event privilege is private and the exposed RPC is invoker-safe", () => {
  assert.match(hardening, /function\s+private\.append_reset_behavior_event/i);
  assert.match(hardening, /private\.append_reset_behavior_event[\s\S]*security\s+definer/i);
  assert.match(hardening, /function\s+public\.append_reset_behavior_event/i);
  assert.match(hardening, /public\.append_reset_behavior_event[\s\S]*security\s+invoker/i);
  assert.match(hardening, /public\.append_behavior_event\(/i);
  assert.match(hardening, /where\s+id\s*=\s*p_enrollment_id[\s\S]*user_id\s*=\s*v_user_id/i);
});

test("Reset AI operations use the existing orchestrator/Coach boundary", () => {
  assert.match(migration, /run_type\s*=\s*'reset_retention'/i);
  assert.match(migration, /agent_key\s*=\s*'orchestrator'/i);
  assert.match(migration, /user_facing_agent[^\n]*coach/i);
});

test("notification scheduling is generic, source-keyed and retry safe", () => {
  assert.match(service, /source_key:\s*`reset:/);
  assert.ok(service.includes('title: index === 6 ? "Your first week is ready to review." : "Your day is ready."'));
  assert.match(service, /error\.code\s*!==\s*"23505"/);
  assert.ok(!service.includes("$10,000"));
  assert.ok(!service.includes("Lose 15 pounds"));
});

test("minimum-day meaningful event requires actual minimum status", () => {
  assert.match(service, /status\s*===\s*"minimum"/);
  assert.match(service, /minimum_count/);
  assert.ok(!service.includes("partial_count: result.partialCount }, `reset.minimum"));
});
