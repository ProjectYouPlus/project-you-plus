export interface OnboardingAnswers {
  name: string;
  topGoals: string[];
  focusAreas: string[];
  idealLifeOneYear: string;
  holdingBack: string;
  exerciseFrequency: string;
  healthEnergyRating: string;
  financeDescription: string;
  habitsToBuild: string;
  habitsToEliminate: string;
  wakeTime: string;
  sleepTime: string;
  primaryActivity: string;
  coachingStyle: string[];
  availableDailyTime: string;
  peakEnergy: string;
  protectedCommitments: string;
  nutritionPhotoTracking: boolean;
  moneyGoals: string[];
  connectionPrefs: string[];
}

export interface Blueprint {
  vision: string;
  goals: string[];
  priorities: string[];
  habits: string[];
  challenges: string;
  ninetyDayDirection: string;
  coachingStyle?: string[];
  rhythm?: { wakeTime?: string; sleepTime?: string; primaryActivity?: string };
  healthEnergy?: string;
  financeContext?: string;
  availableDailyTime?: string;
  peakEnergy?: string;
  protectedCommitments?: string;
  nutritionPhotoTracking?: boolean;
  moneyGoals?: string[];
  connectionPrefs?: string[];
}

export function generateBlueprint(answers: OnboardingAnswers): Blueprint {
  const goals = answers.topGoals.filter(Boolean).slice(0, 3);
  const priorities = answers.focusAreas.length > 0 ? answers.focusAreas.slice(0, 4) : ["Productivity"];
  const habitsToBuild = answers.habitsToBuild.split(",").map((habit) => habit.trim()).filter(Boolean);
  const vision = answers.idealLifeOneYear?.trim().length > 0
    ? answers.idealLifeOneYear.trim()
    : `A year from now, ${answers.name || "you"} will have made visible progress on ${goals[0] ?? "your top goal"}.`;

  const timeContext = answers.availableDailyTime ? ` using roughly ${answers.availableDailyTime.toLowerCase()} of protected daily capacity` : "";
  const ninetyDayDirection = goals[0]
    ? `Build visible momentum on “${goals[0]}”${timeContext}, while protecting the routines that support your energy, focus, and financial stability.`
    : "Set your first goal to generate a 90-day direction.";

  return {
    vision,
    goals,
    priorities,
    habits: habitsToBuild.length > 0 ? habitsToBuild : ["Build one keystone habit to start"],
    challenges: answers.holdingBack?.trim() || "Not specified yet",
    ninetyDayDirection,
    coachingStyle: answers.coachingStyle,
    rhythm: { wakeTime: answers.wakeTime, sleepTime: answers.sleepTime, primaryActivity: answers.primaryActivity },
    healthEnergy: answers.healthEnergyRating || answers.exerciseFrequency,
    financeContext: answers.financeDescription,
    availableDailyTime: answers.availableDailyTime,
    peakEnergy: answers.peakEnergy,
    protectedCommitments: answers.protectedCommitments,
    nutritionPhotoTracking: answers.nutritionPhotoTracking,
    moneyGoals: answers.moneyGoals,
    connectionPrefs: answers.connectionPrefs,
  };
}
