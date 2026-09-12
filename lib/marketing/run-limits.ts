export type MarketingRunForLimit = {
  status: string;
  created_at: string;
};

export type MarketingRunLimit = {
  dailyLimit: number;
  cooldownMs: number;
  activeWindowMs?: number;
  maxConcurrent?: number;
};

export type MarketingRunDecision =
  | { allowed: true }
  | { allowed: false; message: string; retryAfterSeconds: number };

// Keep a generous safety ceiling while allowing the department to do real work.
export const MARKETING_DEPARTMENT_DAILY_LIMIT = 120;

export function utcDayStart(now = new Date()) {
  return `${now.toISOString().slice(0, 10)}T00:00:00.000Z`;
}

export function checkMarketingRunLimit(
  runs: MarketingRunForLimit[],
  limit: MarketingRunLimit,
  now = new Date()
): MarketingRunDecision {
  const nowMs = now.getTime();
  const activeWindowMs = limit.activeWindowMs ?? 5 * 60_000;
  const maxConcurrent = Math.max(1, limit.maxConcurrent ?? 1);
  const activeRuns = runs.filter((run) => {
    const age = nowMs - new Date(run.created_at).getTime();
    return ["queued", "running"].includes(run.status) && age >= 0 && age < activeWindowMs;
  });

  if (activeRuns.length >= maxConcurrent) {
    const oldestActive = activeRuns.reduce((oldest, run) =>
      new Date(run.created_at).getTime() < new Date(oldest.created_at).getTime() ? run : oldest
    );
    const remaining = Math.max(1, activeWindowMs - (nowMs - new Date(oldestActive.created_at).getTime()));
    return {
      allowed: false,
      message: `Marketing execution lanes are busy (${activeRuns.length}/${maxConcurrent}).`,
      retryAfterSeconds: Math.ceil(remaining / 1000),
    };
  }

  if (runs.length >= limit.dailyLimit) {
    const nextDay = new Date(utcDayStart(now));
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    return {
      allowed: false,
      message: `Daily agent run safety limit reached (${limit.dailyLimit}). Try again tomorrow.`,
      retryAfterSeconds: Math.max(1, Math.ceil((nextDay.getTime() - nowMs) / 1000)),
    };
  }

  const newest = runs[0];
  if (newest && limit.cooldownMs > 0) {
    const age = nowMs - new Date(newest.created_at).getTime();
    if (age >= 0 && age < limit.cooldownMs) {
      return {
        allowed: false,
        message: "Please wait a moment before running this agent again.",
        retryAfterSeconds: Math.max(1, Math.ceil((limit.cooldownMs - age) / 1000)),
      };
    }
  }

  return { allowed: true };
}
