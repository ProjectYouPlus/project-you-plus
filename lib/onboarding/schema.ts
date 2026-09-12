export const ONBOARDING_VERSION = "2026-09-v2";
export const DIRECTION_DOMAINS = ["health","money","career","business","discipline","relationships","stress","organization"] as const;
export const FRICTION_CATEGORIES = ["inconsistency","lack_of_time","no_clear_plan","poor_habits","spending","low_motivation","overcommitment"] as const;
export const HEALTH_OBJECTIVES = ["lose_body_fat","build_muscle","improve_strength","improve_energy","improve_endurance","build_consistency","general_health","other"] as const;
export const HEALTH_EXPERIENCE = ["beginner","intermediate","advanced","returning"] as const;
export const TRAINING_SETTINGS = ["gym","home","outdoors","flexible"] as const;
export const NUTRITION_OBJECTIVES = ["fat_loss","muscle_gain","maintenance","better_food_quality","consistent_eating","none"] as const;
export const FINANCE_GOALS = ["emergency_fund","pay_down_debt","control_spending","save_for_purchase","increase_income","invest_consistently","build_business","improve_credit","understand_spending","other"] as const;
export const COACH_STYLES = ["gentle","balanced","direct"] as const;
export const CHECKIN_FREQUENCIES = ["daily","weekdays","three_times_week","weekly"] as const;
export const TIME_WINDOWS = ["morning","midday","afternoon","evening","flexible"] as const;
export const WORK_TYPES = ["fixed","variable","none"] as const;

export type DirectionDomain = typeof DIRECTION_DOMAINS[number];
export type CoachStyle = typeof COACH_STYLES[number];
export type OnboardingStage = "intro"|"direction"|"friction"|"goals"|"life"|"health"|"finance"|"coaching"|"generating"|"review"|"trajectory";
export type GoalDraft = {clientId:string;raw:string;title:string;domain:DirectionDomain;desiredOutcome:string;measurableTarget?:string|null;targetDate?:string|null;why?:string|null;priority:number;status:"draft";rationale?:string|null};
export type RecurringCommitment = {clientId:string;label:string;days:number[];startTime:string;endTime:string;frequency:"weekly"|"biweekly"|"monthly"|"custom"};
export type OnboardingAnswers = {
  direction:{domains:DirectionDomain[];primaryDomain:DirectionDomain|null};
  friction:{categories:string[];note:string};
  goals:GoalDraft[];
  life:{work:{type:"fixed"|"variable"|"none"|null;days:number[];startTime:string;endTime:string;commuteMinutes:number|null;patternNote:string;availableNote:string};commitments:RecurringCommitment[];wakeSleep:{mode:"fixed"|"varies"|null;wakeTime:string;sleepTime:string}};
  health:{included:boolean;deferred:boolean;objective:string|null;objectiveOther:string;experience:string|null;trainingDaysPerWeek:number|null;preferredDays:number[];workoutDurationMinutes:number|null;timeOfDay:string|null;setting:string|null;nutritionObjective:string|null;supplements:string[];limitations:string};
  finance:{deferred:boolean;primaryGoal:string|null;secondaryGoals:string[];optionalDetail:string};
  coaching:{style:CoachStyle|null;checkInFrequency:string|null;checkInWindow:string|null;weeklyReviewDay:number|null;weeklyReviewTime:string;reminderIntent:boolean};
};
export type ProposalGoal = Omit<GoalDraft,"raw"|"status"> & {rationale:string};
export type ProposalHabit = {clientId:string;title:string;frequency:"daily"|"weekly"|"n_per_week";goalClientId?:string|null;rationale:string};
export type ProposalPriority = {clientId:string;title:string;goalClientId?:string|null;dueWindow:"today"|"this_week";rationale:string};
export type HealthPlanProposal = {title:string;goal:string;daysPerWeek:number;sessionMinutes:number;experience:"beginner"|"intermediate"|"advanced"|"returning";schedule:Array<{key:string;day:string;dayIndex:number;title:string;focus?:string;duration:number}>;rationale:string};
export type FinancialFocusProposal = {title:string;action:string;goalType:string;rationale:string};
export type WeeklyReviewProposal = {day:number;time:string;reminderIntent:boolean;rationale:string};
export type OnboardingProposal = {generationVersion:string;generatedAt:string;goals:ProposalGoal[];habits:ProposalHabit[];priorities:ProposalPriority[];healthPlan:HealthPlanProposal|null;financialFocus:FinancialFocusProposal|null;weeklyReview:WeeklyReviewProposal;status:"draft"};

export {EMPTY_ANSWERS,sanitizeAnswers,validateStage,buildFallbackGoalDrafts,validateProposal,buildFallbackProposal,label,dayName} from "./schema-runtime";
