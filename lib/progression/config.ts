export const PROGRESSION_CONFIG = {
  windows: { short: 7, medium: 28, long: 90 },
  weights: { short: 0.2, medium: 0.3, long: 0.25, consistency: 0.1, balance: 0.1, execution: 0.05 },
  evidenceCaps: [
    { minimumDays: 90, maximumLevel: 99 },
    { minimumDays: 60, maximumLevel: 98 },
    { minimumDays: 28, maximumLevel: 79 },
    { minimumDays: 7, maximumLevel: 69 },
    { minimumDays: 0, maximumLevel: 59 },
  ],
  maximumDailyRise: 2,
  maximumDailyDecline: 1,
  milestones: [
    { level: 60, stage: "Foundation" },
    { level: 70, stage: "Momentum" },
    { level: 80, stage: "Alignment" },
    { level: 90, stage: "Elite" },
    { level: 99, stage: "1%" },
  ],
  onePercent: { index: 96, average28: 95, average90: 93, domainFloor: 85, consistency: 90, activityDays: 60, domainCount: 3 },
  integrity: { fastCompletionSeconds: 30, fastCompletionRatio: 0.3, dailyTaskLimit: 12, duplicateTitleLimit: 3 },
} as const;
