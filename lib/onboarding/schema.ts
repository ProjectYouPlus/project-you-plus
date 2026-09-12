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

export type GoalDraft = {
  clientId: string;
  raw: string;
  title: string;
  domain: DirectionDomain;
  desiredOutcome: string;
  measurableTarget?: string | null;
  targetDate?: string | null;
  why?: string | null;
  priority: number;
  status: "draft";
  rationale?: string | null;
};

export type RecurringCommitment = {
  clientId: string;
  label: string;
  days: number[];
  startTime: string;
  endTime: string;
  frequency: "weekly"|"biweekly"|"monthly"|"custom";
};

export type OnboardingAnswers = {
  direction: { domains: DirectionDomain[]; primaryDomain: DirectionDomain | null };
  friction: { categories: string[]; note: string };
  goals: GoalDraft[];
  life: {
    work: { type: "fixed"|"variable"|"none"|null; days: number[]; startTime: string; endTime: string; commuteMinutes: number | null; patternNote: string; availableNote: string };
    commitments: RecurringCommitment[];
    wakeSleep: { mode: "fixed"|"varies"|null; wakeTime: string; sleepTime: string };
  };
  health: {
    included: boolean;
    deferred: boolean;
    objective: string | null;
    objectiveOther: string;
    experience: string | null;
    trainingDaysPerWeek: number | null;
    preferredDays: number[];
    workoutDurationMinutes: number | null;
    timeOfDay: string | null;
    setting: string | null;
    nutritionObjective: string | null;
    supplements: string[];
    limitations: string;
  };
  finance: {
    deferred: boolean;
    primaryGoal: string | null;
    secondaryGoals: string[];
    optionalDetail: string;
  };
  coaching: {
    style: CoachStyle | null;
    checkInFrequency: string | null;
    checkInWindow: string | null;
    weeklyReviewDay: number | null;
    weeklyReviewTime: string;
    reminderIntent: boolean;
  };
};

export type ProposalGoal = Omit<GoalDraft,"raw"|"status"> & { rationale: string };
export type ProposalHabit = { clientId:string; title:string; frequency:"daily"|"weekly"|"n_per_week"; goalClientId?:string|null; rationale:string };
export type ProposalPriority = { clientId:string; title:string; goalClientId?:string|null; dueWindow:"today"|"this_week"; rationale:string };
export type HealthPlanProposal = { title:string; goal:string; daysPerWeek:number; sessionMinutes:number; experience:"beginner"|"intermediate"|"advanced"|"returning"; schedule:Array<{key:string;day:string;dayIndex:number;title:string;focus?:string;duration:number}>; rationale:string };
export type FinancialFocusProposal = { title:string; action:string; goalType:string; rationale:string };
export type WeeklyReviewProposal = { day:number; time:string; reminderIntent:boolean; rationale:string };
export type OnboardingProposal = {
  generationVersion: string;
  generatedAt: string;
  goals: ProposalGoal[];
  habits: ProposalHabit[];
  priorities: ProposalPriority[];
  healthPlan: HealthPlanProposal | null;
  financialFocus: FinancialFocusProposal | null;
  weeklyReview: WeeklyReviewProposal;
  status: "draft";
};

export const EMPTY_ANSWERS: OnboardingAnswers = {
  direction:{domains:[],primaryDomain:null},
  friction:{categories:[],note:""},
  goals:[],
  life:{work:{type:null,days:[],startTime:"09:00",endTime:"17:00",commuteMinutes:null,patternNote:"",availableNote:""},commitments:[],wakeSleep:{mode:null,wakeTime:"07:00",sleepTime:"23:00"}},
  health:{included:false,deferred:false,objective:null,objectiveOther:"",experience:null,trainingDaysPerWeek:null,preferredDays:[],workoutDurationMinutes:null,timeOfDay:null,setting:null,nutritionObjective:null,supplements:[],limitations:""},
  finance:{deferred:false,primaryGoal:null,secondaryGoals:[],optionalDetail:""},
  coaching:{style:null,checkInFrequency:null,checkInWindow:null,weeklyReviewDay:null,weeklyReviewTime:"18:00",reminderIntent:false},
};

const text = (value:unknown,max=500) => typeof value === "string" ? value.trim().slice(0,max) : "";
const record = (value:unknown):Record<string,unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string,unknown> : {};
const stringArray = (value:unknown,maxItems:number,maxLen=80) => Array.isArray(value) ? value.filter((x):x is string=>typeof x==="string").map(x=>text(x,maxLen)).filter(Boolean).slice(0,maxItems) : [];
const numberArray = (value:unknown,maxItems=7) => Array.isArray(value) ? [...new Set(value.map(Number).filter(x=>Number.isInteger(x)&&x>=0&&x<=6))].slice(0,maxItems) : [];
const enumValue = <T extends readonly string[]>(value:unknown,allowed:T):T[number]|null => typeof value === "string" && (allowed as readonly string[]).includes(value) ? value as T[number] : null;
const timeValue = (value:unknown,fallback="") => typeof value === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : fallback;
const dateValue = (value:unknown) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
const boolValue = (value:unknown) => value === true;
const intRange = (value:unknown,min:number,max:number) => { const n=Number(value); return Number.isInteger(n)&&n>=min&&n<=max?n:null; };

export function sanitizeAnswers(input:unknown):OnboardingAnswers {
  const root=record(input), direction=record(root.direction), friction=record(root.friction), life=record(root.life), work=record(life.work), wakeSleep=record(life.wakeSleep), health=record(root.health), finance=record(root.finance), coaching=record(root.coaching);
  const domains=stringArray(direction.domains,3).filter((x):x is DirectionDomain=>(DIRECTION_DOMAINS as readonly string[]).includes(x));
  const primaryCandidate=enumValue(direction.primaryDomain,DIRECTION_DOMAINS);
  const rawGoals=Array.isArray(root.goals)?root.goals:[];
  const goals:GoalDraft[]=rawGoals.slice(0,3).map((item,index)=>{
    const g=record(item);const raw=text(g.raw,240),title=text(g.title,180)||raw;const domain=enumValue(g.domain,DIRECTION_DOMAINS)??primaryCandidate??domains[0]??"discipline";
    return {clientId:text(g.clientId,80)||`goal-${index+1}`,raw:raw||title,title,domain,desiredOutcome:text(g.desiredOutcome,420)||title,measurableTarget:text(g.measurableTarget,220)||null,targetDate:dateValue(g.targetDate),why:text(g.why,300)||null,priority:index+1,status:"draft",rationale:text(g.rationale,300)||null};
  }).filter(g=>g.title);
  const commitments:RecurringCommitment[]=(Array.isArray(life.commitments)?life.commitments:[]).slice(0,8).map((item,index)=>{const c=record(item);return {clientId:text(c.clientId,80)||`commitment-${index+1}`,label:text(c.label,160),days:numberArray(c.days),startTime:timeValue(c.startTime,"09:00"),endTime:timeValue(c.endTime,"10:00"),frequency:enumValue(c.frequency,["weekly","biweekly","monthly","custom"] as const)??"weekly"};}).filter(c=>c.label&&c.days.length);
  const included=boolValue(health.included), deferred=boolValue(health.deferred);
  return {
    direction:{domains,primaryDomain:primaryCandidate&&domains.includes(primaryCandidate)?primaryCandidate:(domains.length===1?domains[0]:null)},
    friction:{categories:stringArray(friction.categories,3).filter(x=>(FRICTION_CATEGORIES as readonly string[]).includes(x)),note:text(friction.note,280)},
    goals,
    life:{work:{type:enumValue(work.type,WORK_TYPES),days:numberArray(work.days),startTime:timeValue(work.startTime,"09:00"),endTime:timeValue(work.endTime,"17:00"),commuteMinutes:intRange(work.commuteMinutes,0,240),patternNote:text(work.patternNote,360),availableNote:text(work.availableNote,360)},commitments,wakeSleep:{mode:enumValue(wakeSleep.mode,["fixed","varies"] as const),wakeTime:timeValue(wakeSleep.wakeTime,"07:00"),sleepTime:timeValue(wakeSleep.sleepTime,"23:00")}},
    health:{included,deferred:deferred||!included,objective:enumValue(health.objective,HEALTH_OBJECTIVES),objectiveOther:text(health.objectiveOther,180),experience:enumValue(health.experience,HEALTH_EXPERIENCE),trainingDaysPerWeek:intRange(health.trainingDaysPerWeek,1,7),preferredDays:numberArray(health.preferredDays),workoutDurationMinutes:intRange(health.workoutDurationMinutes,10,180),timeOfDay:enumValue(health.timeOfDay,TIME_WINDOWS),setting:enumValue(health.setting,TRAINING_SETTINGS),nutritionObjective:enumValue(health.nutritionObjective,NUTRITION_OBJECTIVES),supplements:stringArray(health.supplements,20,100),limitations:text(health.limitations,500)},
    finance:{deferred:boolValue(finance.deferred),primaryGoal:enumValue(finance.primaryGoal,FINANCE_GOALS),secondaryGoals:stringArray(finance.secondaryGoals,4).filter(x=>(FINANCE_GOALS as readonly string[]).includes(x)),optionalDetail:text(finance.optionalDetail,240)},
    coaching:{style:enumValue(coaching.style,COACH_STYLES),checkInFrequency:enumValue(coaching.checkInFrequency,CHECKIN_FREQUENCIES),checkInWindow:enumValue(coaching.checkInWindow,TIME_WINDOWS),weeklyReviewDay:intRange(coaching.weeklyReviewDay,0,6),weeklyReviewTime:timeValue(coaching.weeklyReviewTime,"18:00"),reminderIntent:boolValue(coaching.reminderIntent)},
  };
}

export function validateStage(stage:OnboardingStage,answers:OnboardingAnswers):string|null {
  if(stage==="direction"){
    if(!answers.direction.domains.length)return "Choose at least one area to improve.";
    if(answers.direction.domains.length>1&&!answers.direction.primaryDomain)return "Choose the area that matters most right now.";
  }
  if(stage==="friction"&&answers.friction.categories.length===0&&!answers.friction.note)return "Choose what is making progress harder, or add a short note.";
  if(stage==="goals"&&answers.goals.length<1)return "Add at least one goal for Project You+ to build around.";
  if(stage==="life"){
    const work=answers.life.work;if(!work.type)return "Choose how your normal work week is structured.";
    if(work.type==="fixed"&&(!work.days.length||!work.startTime||!work.endTime))return "Add the workdays and hours Project You+ should plan around.";
    if(work.type==="variable"&&!work.patternNote)return "Add a brief description of how your schedule usually changes.";
  }
  if(stage==="health"&&answers.health.included){
    if(!answers.health.objective||!answers.health.experience||!answers.health.trainingDaysPerWeek||!answers.health.workoutDurationMinutes||!answers.health.setting)return "Complete the starting health preferences so the recommendation stays realistic.";
  }
  if(stage==="finance"&&!answers.finance.deferred&&!answers.finance.primaryGoal)return "Choose one money priority or set it up later.";
  if(stage==="coaching"){
    if(!answers.coaching.style)return "Choose how your Coach should work with you.";
    if(!answers.coaching.checkInFrequency||!answers.coaching.checkInWindow)return "Choose a check-in rhythm.";
    if(answers.coaching.weeklyReviewDay===null||!answers.coaching.weeklyReviewTime)return "Choose when your Weekly Review should happen.";
  }
  return null;
}

export function buildFallbackGoalDrafts(rawGoals:string[],domains:DirectionDomain[],primaryDomain:DirectionDomain|null):GoalDraft[] {
  return rawGoals.map((raw,index)=>{const cleaned=text(raw,240);const domain=guessDomain(cleaned,domains,primaryDomain);return {clientId:`goal-${Date.now()}-${index}`,raw:cleaned,title:sentence(cleaned),domain,desiredOutcome:sentence(cleaned),measurableTarget:null,targetDate:null,why:null,priority:index+1,status:"draft",rationale:"Kept close to your wording so you can refine the outcome without Project You+ inventing a target."};}).filter(x=>x.title).slice(0,3);
}

export function validateProposal(value:unknown,answers:OnboardingAnswers):{ok:true;value:OnboardingProposal}|{ok:false;error:string} {
  const root=record(value);if(!Array.isArray(root.goals)||root.goals.length<1||root.goals.length>3)return {ok:false,error:"Proposal must contain one to three goals."};
  const goals:ProposalGoal[]=[];
  for(const [index,item] of (root.goals as unknown[]).entries()){
    const g=record(item),title=text(g.title,180),desiredOutcome=text(g.desiredOutcome,420),domain=enumValue(g.domain,DIRECTION_DOMAINS);if(!title||!desiredOutcome||!domain)return {ok:false,error:"A proposed goal is incomplete."};
    goals.push({clientId:text(g.clientId,80)||answers.goals[index]?.clientId||`goal-${index+1}`,title,domain,desiredOutcome,measurableTarget:text(g.measurableTarget,220)||null,targetDate:dateValue(g.targetDate),why:text(g.why,300)||null,priority:index+1,rationale:text(g.rationale,300)||"This goal reflects what you said matters right now."});
  }
  const habitsRaw=Array.isArray(root.habits)?root.habits:[];if(habitsRaw.length>3)return {ok:false,error:"Proposal contains too many starter habits."};
  const habits:ProposalHabit[]=habitsRaw.map((item,index)=>{const h=record(item);return {clientId:text(h.clientId,80)||`habit-${index+1}`,title:text(h.title,180),frequency:enumValue(h.frequency,["daily","weekly","n_per_week"] as const)??"daily",goalClientId:text(h.goalClientId,80)||null,rationale:text(h.rationale,300)||"A small repeatable action supporting your starting priorities."};}).filter(h=>h.title);
  const prioritiesRaw=Array.isArray(root.priorities)?root.priorities:[];if(prioritiesRaw.length<1||prioritiesRaw.length>3)return {ok:false,error:"Proposal must contain one to three first-week priorities."};
  const priorities:ProposalPriority[]=prioritiesRaw.map((item,index)=>{const p=record(item);return {clientId:text(p.clientId,80)||`priority-${index+1}`,title:text(p.title,220),goalClientId:text(p.goalClientId,80)||null,dueWindow:enumValue(p.dueWindow,["today","this_week"] as const)??(index===0?"today":"this_week"),rationale:text(p.rationale,300)||"Chosen as a manageable first step based on your stated priorities."};}).filter(p=>p.title);
  if(!priorities.length)return {ok:false,error:"Proposal has no usable first-week priority."};
  let healthPlan:HealthPlanProposal|null=null;
  if(answers.health.included&&!answers.health.deferred&&root.healthPlan){const h=record(root.healthPlan),days=intRange(h.daysPerWeek,1,7),minutes=intRange(h.sessionMinutes,10,180),experience=enumValue(h.experience,HEALTH_EXPERIENCE);const scheduleRaw=Array.isArray(h.schedule)?h.schedule:[];if(!days||!minutes||!experience||scheduleRaw.length!==days)return {ok:false,error:"Health proposal does not match the stated training availability."};const schedule=scheduleRaw.map((item,index)=>{const s=record(item),dayIndex=intRange(s.dayIndex,0,6),duration=intRange(s.duration,10,180);return {key:text(s.key,80)||`session-${index+1}`,day:text(s.day,40)||dayName(dayIndex??0),dayIndex:dayIndex??0,title:text(s.title,140)||"Training session",focus:text(s.focus,160)||undefined,duration:duration??minutes};});healthPlan={title:text(h.title,180)||"Project You+ starting plan",goal:text(h.goal,180)||label(answers.health.objective??"general_health"),daysPerWeek:days,sessionMinutes:minutes,experience,schedule,rationale:text(h.rationale,360)||"Built around the availability and experience you provided."};}
  let financialFocus:FinancialFocusProposal|null=null;
  if(!answers.finance.deferred&&answers.finance.primaryGoal){const f=record(root.financialFocus);const action=text(f.action,220);if(action)financialFocus={title:text(f.title,160)||label(answers.finance.primaryGoal),action,goalType:text(f.goalType,80)||answers.finance.primaryGoal,rationale:text(f.rationale,320)||"Keeps your starting money system focused on one controllable next step."};}
  const w=record(root.weeklyReview);const day=intRange(w.day,0,6)??answers.coaching.weeklyReviewDay;const reviewTime=timeValue(w.time,answers.coaching.weeklyReviewTime);if(day===null||!reviewTime)return {ok:false,error:"Weekly Review configuration is missing."};
  return {ok:true,value:{generationVersion:text(root.generationVersion,80)||ONBOARDING_VERSION,generatedAt:text(root.generatedAt,60)||new Date().toISOString(),goals,habits,priorities,healthPlan,financialFocus,weeklyReview:{day,time:reviewTime,reminderIntent:answers.coaching.reminderIntent,rationale:text(w.rationale,320)||`Scheduled for ${dayName(day)} because that is the review time you selected.`},status:"draft"}};
}

export function buildFallbackProposal(answers:OnboardingAnswers):OnboardingProposal {
  const goals=answers.goals.slice(0,3).map((g,index):ProposalGoal=>({clientId:g.clientId,title:g.title,domain:g.domain,desiredOutcome:g.desiredOutcome,measurableTarget:g.measurableTarget??null,targetDate:g.targetDate??null,why:g.why??null,priority:index+1,rationale:g.rationale||"Kept close to your confirmed goal so the first system does not invent commitments."}));
  const habits:ProposalHabit[]=[];
  const first=goals[0];
  if(first)habits.push({clientId:"habit-first-action",title:`Take one small action toward ${first.title}`,frequency:"daily",goalClientId:first.clientId,rationale:"A low-friction daily action builds consistency while Project You+ calibrates to your real behavior."});
  if(answers.friction.categories.includes("no_clear_plan")&&habits.length<3)habits.push({clientId:"habit-plan-day",title:"Review today’s top priority",frequency:"daily",goalClientId:first?.clientId,rationale:"You identified lack of a clear plan as friction, so this creates a lightweight planning loop."});
  const priorities:ProposalPriority[]=goals.slice(0,3).map((g,index)=>({clientId:`priority-${index+1}`,title:`Define the next concrete step for ${g.title}`,goalClientId:g.clientId,dueWindow:index===0?"today":"this_week",rationale:index===0?"Starts with your highest-priority confirmed goal.":"Keeps the first week focused without overloading the day."}));
  let healthPlan:HealthPlanProposal|null=null;
  if(answers.health.included&&!answers.health.deferred&&answers.health.trainingDaysPerWeek&&answers.health.workoutDurationMinutes&&answers.health.experience){const available=answers.health.preferredDays.length?answers.health.preferredDays:[1,3,5,6,2,4,0];const days=available.slice(0,answers.health.trainingDaysPerWeek);healthPlan={title:"Project You+ starting training week",goal:label(answers.health.objective??"general_health"),daysPerWeek:days.length,sessionMinutes:answers.health.workoutDurationMinutes,experience:answers.health.experience as HealthPlanProposal["experience"],schedule:days.map((d,i)=>({key:`onboarding-session-${i+1}`,day:dayName(d),dayIndex:d,title:"Training session",focus:"Consistent, sustainable training",duration:answers.health.workoutDurationMinutes!})),rationale:"Uses only the training days, duration, experience, and objective you provided; intensity can be refined after real completion data exists."};}
  const financialFocus=!answers.finance.deferred&&answers.finance.primaryGoal?{title:label(answers.finance.primaryGoal),action:financeFallbackAction(answers.finance.primaryGoal),goalType:answers.finance.primaryGoal,rationale:"Creates one organizational money action without requiring balances, income, or account access."}:null;
  const day=answers.coaching.weeklyReviewDay??0,time=answers.coaching.weeklyReviewTime||"18:00";
  return {generationVersion:`${ONBOARDING_VERSION}-fallback`,generatedAt:new Date().toISOString(),goals,habits:habits.slice(0,3),priorities:priorities.slice(0,3),healthPlan,financialFocus,weeklyReview:{day,time,reminderIntent:answers.coaching.reminderIntent,rationale:`Uses the ${dayName(day)} review time you confirmed.`},status:"draft"};
}

export function label(value:string){return value.split("_").map(part=>part?part[0].toUpperCase()+part.slice(1):part).join(" ");}
export function dayName(day:number){return ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][day]??"Day";}
function sentence(value:string){const v=value.trim().replace(/[.]+$/g,"");return v?`${v[0].toUpperCase()}${v.slice(1)}`:"";}
function guessDomain(raw:string,domains:DirectionDomain[],primary:DirectionDomain|null):DirectionDomain{const value=raw.toLowerCase();if(/workout|weight|fat|muscle|health|energy|run|gym/.test(value))return "health";if(/save|money|debt|spend|credit|invest|income/.test(value))return "money";if(/business|client|lead|revenue|company/.test(value))return "business";if(/career|job|promotion|resume|work/.test(value))return "career";return primary??domains[0]??"discipline";}
function financeFallbackAction(goal:string){switch(goal){case"emergency_fund":return"Choose the next amount you can move toward your emergency fund.";case"pay_down_debt":return"Choose the highest-priority debt and define the next payment action.";case"control_spending":return"Choose one spending category to review this week.";case"save_for_purchase":return"Define the purchase you are saving for and the next contribution.";case"increase_income":return"Choose one concrete income-building action for this week.";case"invest_consistently":return"Define a recurring investing review without changing investments yet.";case"build_business":return"Choose one business money action that improves cash generation.";case"improve_credit":return"Review the next credit-improvement action you can control.";case"understand_spending":return"Review where your money went this week and name one pattern.";default:return"Define one money action you can complete this week.";}}
