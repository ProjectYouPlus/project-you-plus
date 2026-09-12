import assert from "node:assert/strict";
import test from "node:test";
import { checkMarketingRunLimit, MARKETING_DEPARTMENT_DAILY_LIMIT, utcDayStart } from "../lib/marketing/run-limits";

const now = new Date("2026-09-11T16:00:00.000Z");

test("allows the first run and calculates the UTC day boundary", () => {
  assert.deepEqual(checkMarketingRunLimit([], { dailyLimit: 3, cooldownMs: 60_000 }, now), { allowed: true });
  assert.equal(utcDayStart(now), "2026-09-11T00:00:00.000Z");
  assert.equal(MARKETING_DEPARTMENT_DAILY_LIMIT, 120);
});

test("blocks a concurrent run", () => {
  const decision = checkMarketingRunLimit(
    [{ status: "running", created_at: "2026-09-11T15:59:30.000Z" }],
    { dailyLimit: 3, cooldownMs: 60_000 },
    now
  );
  assert.equal(decision.allowed, false);
  if (!decision.allowed) assert.match(decision.message, /execution lanes are busy/i);
});

test("counts failed attempts toward the daily cap", () => {
  const decision = checkMarketingRunLimit(
    [
      { status: "failed", created_at: "2026-09-11T15:00:00.000Z" },
      { status: "completed", created_at: "2026-09-11T14:00:00.000Z" },
      { status: "failed", created_at: "2026-09-11T13:00:00.000Z" },
    ],
    { dailyLimit: 3, cooldownMs: 60_000 },
    now
  );
  assert.equal(decision.allowed, false);
  if (!decision.allowed) assert.match(decision.message, /Daily agent run safety limit reached/);
});

test("enforces a short cooldown between attempts", () => {
  const decision = checkMarketingRunLimit(
    [{ status: "failed", created_at: "2026-09-11T15:59:30.000Z" }],
    { dailyLimit: 3, cooldownMs: 60_000 },
    now
  );
  assert.deepEqual(decision, {
    allowed: false,
    message: "Please wait a moment before running this agent again.",
    retryAfterSeconds: 30,
  });
});
