export type FeedbackKind = "task" | "habit" | "workout" | "day" | "achievement" | "milestone" | "one";
export type CelebrationEvent = {
  eventId: string;
  kind: "achievement" | "milestone" | "one";
  key: string;
  title: string;
  description: string;
  earnedAt: string;
  level?: number;
  tier?: string;
};

export type FeedbackPreferences = { sound: boolean; celebrationSound: boolean; haptics: boolean; reducedMotion: boolean };
export const DEFAULT_FEEDBACK_PREFERENCES: FeedbackPreferences = { sound: true, celebrationSound: true, haptics: true, reducedMotion: false };
