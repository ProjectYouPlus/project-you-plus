export type MarketingRunForLimit = {
  status: string;
  created_at: string;
};

export type MarketingRunLimit = {
  dailyLimit: number;
  cooldownMs: number;
  activeWindowMs?: number;
};

export type MarketingRunDecision =
  | { allowed: true }
  | { allowed: false; message: string; retryAfterSeconds: number };

export const MARKETING_DEPARTMENT_DAILY_LIMIT = 20;

export function utcDayStart(now = new Date()) {
  return `${now.toISOString().slice(0, 10)}T00:00:00.000Z`;
}

export function checkMarketingRunLimit(
  runs: MarketingRunForLimit[],
  limit: MarketingRunLimit,
  now = new Date()
): MarketingRunDecision {
  const nowMs = now.getTime();
  const activeWindowMs = limit.activeWindowMs ?? 10 * 60_000;
  const recentActive = runs.find((run) => {
    const age = nowMs - new Date(run.created_at).getTime();
    return ["queued", "running"].includes(run.status) && age >= 0 && age < activeWindowMs;
  });

  if (recentActive) {
    const remaining = Math.max(1, activeWindowMs - (nowMs - new Date(recentActive.created_at).getTime()));
    return {
      allowed: false,
      message: "This agent already has a run in progress.",
      retryAfterSeconds: Math.ceil(remaining / 1000),
    };
  }

  if (runs.length >= limit.dailyLimit) {
    const nextDay = new Date(utcDayStart(now));
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    return {
      allowed: false,
      message: `Daily agent run limit reached (${limit.dailyLimit}). Try again tomorrow.`,
      retryAfterSeconds: Math.max(1, Math.ceil((nextDay.getTime() - nowMs) / 1000)),
    };
  }

  const newest = runs[0];
  if (newest) {
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
