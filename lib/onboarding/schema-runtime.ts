import {
  CHECKIN_FREQUENCIES,COACH_STYLES,DIRECTION_DOMAINS,FINANCE_GOALS,FRICTION_CATEGORIES,
  HEALTH_EXPERIENCE,HEALTH_OBJECTIVES,NUTRITION_OBJECTIVES,ONBOARDING_VERSION,TIME_WINDOWS,
  TRAINING_SETTINGS,WORK_TYPES,
  type DirectionDomain,type FinancialFocusProposal,type GoalDraft,type HealthPlanProposal,
  type OnboardingAnswers,type OnboardingProposal,type OnboardingStage,type ProposalGoal,
  type ProposalHabit,type ProposalPriority,type RecurringCommitment,
} from "./schema";

export const EMPTY_ANSWERS:OnboardingAnswers={
  direction:{domains:[],primaryDomain:null},friction:{categories:[],note:""},goals:[],
  life:{work:{type:null,days:[],startTime:"09:00",endTime:"17:00",commuteMinutes:null,patternNote:"",availableNote:""},commitments:[],wakeSleep:{mode:null,wakeTime:"07:00",sleepTime:"23:00"}},
  health:{included:false,deferred:false,objective:null,objectiveOther:"",experience:null,trainingDaysPerWeek:null,preferredDays:[],workoutDurationMinutes:null,timeOfDay:null,setting:null,nutritionObjective:null,supplements:[],limitations:""},
  finance:{deferred:false,primaryGoal:null,secondaryGoals:[],optionalDetail:""},
  coaching:{style:null,checkInFrequency:null,checkInWindow:null,weeklyReviewDay:null,weeklyReviewTime:"18:00",reminderIntent:false},
};

const txt=(v:unknown,max=500)=>typeof v==="string"?v.trim().slice(0,max):"";
const obj=(v:unknown):Record<string,unknown>=>v&&typeof v==="object"&&!Array.isArray(v)?v as Record<string,unknown>:{};
const strings=(v:unknown,max:number,len=80)=>Array.isArray(v)?v.filter((x):x is string=>typeof x==="string").map(x=>txt(x,len)).filter(Boolean).slice(0,max):[];
const days=(v:unknown)=>Array.isArray(v)?[...new Set(v.map(Number).filter(n=>Number.isInteger(n)&&n>=0&&n<=6))].slice(0,7):[];
const pick=<T extends readonly string[]>(v:unknown,allowed:T):T[number]|null=>typeof v==="string"&&(allowed as readonly string[]).includes(v)?v as T[number]:null;
const tm=(v:unknown,fallback="")=>typeof v==="string"&&/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(v)?v:fallback;
const dt=(v:unknown)=>typeof v==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(v)?v:null;
const int=(v:unknown,min:number,max:number)=>{const n=Number(v);return Number.isInteger(n)&&n>=min&&n<=max?n:null};

export function sanitizeAnswers(input:unknown):OnboardingAnswers{
  const r=obj(input),d=obj(r.direction),f=obj(r.friction),l=obj(r.life),w=obj(l.work),ws=obj(l.wakeSleep),h=obj(r.health),m=obj(r.finance),c=obj(r.coaching);
  const domains=strings(d.domains,3).filter((x):x is DirectionDomain=>(DIRECTION_DOMAINS as readonly string[]).includes(x));
  const primary=pick(d.primaryDomain,DIRECTION_DOMAINS);
  const goals:GoalDraft[]=(Array.isArray(r.goals)?r.goals:[]).slice(0,3).map((item,index):GoalDraft=>{
    const g=obj(item),raw=txt(g.raw,240),title=txt(g.title,180)||raw,domain=pick(g.domain,DIRECTION_DOMAINS)??primary??domains[0]??"discipline";
    return {clientId:txt(g.clientId,80)||`goal-${index+1}`,raw:raw||title,title,domain,desiredOutcome:txt(g.desiredOutcome,420)||title,measurableTarget:txt(g.measurableTarget,220)||null,targetDate:dt(g.targetDate),why:txt(g.why,300)||null,priority:index+1,status:"draft",rationale:txt(g.rationale,300)||null};
  }).filter(g=>Boolean(g.title));
  const commitments:RecurringCommitment[]=(Array.isArray(l.commitments)?l.commitments:[]).slice(0,8).map((item,index):RecurringCommitment=>{const x=obj(item);return {clientId:txt(x.clientId,80)||`commitment-${index+1}`,label:txt(x.label,160),days:days(x.days),startTime:tm(x.startTime,"09:00"),endTime:tm(x.endTime,"10:00"),frequency:pick(x.frequency,["weekly","biweekly","monthly","custom"] as const)??"weekly"}}).filter(x=>Boolean(x.label)&&x.days.length>0);
  const included=h.included===true;
  return {
    direction:{domains,primaryDomain:primary&&domains.includes(primary)?primary:(domains.length===1?domains[0]:null)},
    friction:{categories:strings(f.categories,3).filter(x=>(FRICTION_CATEGORIES as readonly string[]).includes(x)),note:txt(f.note,280)},goals,
    life:{work:{type:pick(w.type,WORK_TYPES),days:days(w.days),startTime:tm(w.startTime,"09:00"),endTime:tm(w.endTime,"17:00"),commuteMinutes:int(w.commuteMinutes,0,240),patternNote:txt(w.patternNote,360),availableNote:txt(w.availableNote,360)},commitments,wakeSleep:{mode:pick(ws.mode,["fixed","varies"] as const),wakeTime:tm(ws.wakeTime,"07:00"),sleepTime:tm(ws.sleepTime,"23:00")}},
    health:{included,deferred:h.deferred===true||!included,objective:pick(h.objective,HEALTH_OBJECTIVES),objectiveOther:txt(h.objectiveOther,180),experience:pick(h.experience,HEALTH_EXPERIENCE),trainingDaysPerWeek:int(h.trainingDaysPerWeek,1,7),preferredDays:days(h.preferredDays),workoutDurationMinutes:int(h.workoutDurationMinutes,10,180),timeOfDay:pick(h.timeOfDay,TIME_WINDOWS),setting:pick(h.setting,TRAINING_SETTINGS),nutritionObjective:pick(h.nutritionObjective,NUTRITION_OBJECTIVES),supplements:strings(h.supplements,20,100),limitations:txt(h.limitations,500)},
    finance:{deferred:m.deferred===true,primaryGoal:pick(m.primaryGoal,FINANCE_GOALS),secondaryGoals:strings(m.secondaryGoals,4).filter(x=>(FINANCE_GOALS as readonly string[]).includes(x)),optionalDetail:txt(m.optionalDetail,240)},
    coaching:{style:pick(c.style,COACH_STYLES),checkInFrequency:pick(c.checkInFrequency,CHECKIN_FREQUENCIES),checkInWindow:pick(c.checkInWindow,TIME_WINDOWS),weeklyReviewDay:int(c.weeklyReviewDay,0,6),weeklyReviewTime:tm(c.weeklyReviewTime,"18:00"),reminderIntent:c.reminderIntent===true},
  };
}

export function validateStage(stage:OnboardingStage,a:OnboardingAnswers):string|null{
  if(stage==="direction"){
    if(!a.direction.domains.length)return "Choose at least one area to improve.";
    if(a.direction.domains.length>1&&!a.direction.primaryDomain)return "Choose the area that matters most right now.";
  }
  if(stage==="friction"&&!a.friction.categories.length&&!a.friction.note)return "Choose what is making progress harder, or add a short note.";
  if(stage==="goals"&&!a.goals.length)return "Add at least one goal for Project You+ to build around.";
  if(stage==="life"){
    const w=a.life.work;if(!w.type)return "Choose how your normal work week is structured.";
    if(w.type==="fixed"&&(!w.days.length||!w.startTime||!w.endTime))return "Add the workdays and hours Project You+ should plan around.";
    if(w.type==="variable"&&!w.patternNote)return "Add a brief description of how your schedule usually changes.";
  }
  if(stage==="health"&&a.health.included&&!a.health.deferred){const h=a.health;if(!h.objective||!h.experience||!h.trainingDaysPerWeek||!h.workoutDurationMinutes||!h.setting)return "Complete the starting health preferences so the recommendation stays realistic.";if(h.preferredDays.length>0&&h.preferredDays.length<h.trainingDaysPerWeek)return `Choose at least ${h.trainingDaysPerWeek} preferred training days, or leave preferred days blank.`;}
  if(stage==="finance"&&!a.finance.deferred&&!a.finance.primaryGoal)return "Choose one money priority or set it up later.";
  if(stage==="coaching"){if(!a.coaching.style)return "Choose how your Coach should work with you.";if(!a.coaching.checkInFrequency||!a.coaching.checkInWindow)return "Choose a check-in rhythm.";if(a.coaching.weeklyReviewDay===null||!a.coaching.weeklyReviewTime)return "Choose when your Weekly Review should happen.";}
  return null;
}

export function buildFallbackGoalDrafts(rawGoals:string[],domains:DirectionDomain[],primary:DirectionDomain|null):GoalDraft[]{
  return rawGoals.map((raw,index):GoalDraft=>{const cleaned=txt(raw,240);return {clientId:`goal-${Date.now()}-${index}`,raw:cleaned,title:sentence(cleaned),domain:guessDomain(cleaned,domains,primary),desiredOutcome:sentence(cleaned),measurableTarget:null,targetDate:null,why:null,priority:index+1,status:"draft",rationale:"Kept close to your wording so you can refine the outcome without Project You+ inventing a target."}}).filter(g=>Boolean(g.title)).slice(0,3);
}

export function validateProposal(value:unknown,a:OnboardingAnswers):{ok:true;value:OnboardingProposal}|{ok:false;error:string}{
  const r=obj(value);if(!Array.isArray(r.goals)||r.goals.length<1||r.goals.length>3)return {ok:false,error:"Proposal must contain one to three goals."};
  const goals:ProposalGoal[]=[];
  for(const [index,item] of (r.goals as unknown[]).entries()){
    const g=obj(item),title=txt(g.title,180),desiredOutcome=txt(g.desiredOutcome,420),domain=pick(g.domain,DIRECTION_DOMAINS);if(!title||!desiredOutcome||!domain)return {ok:false,error:"A proposed goal is incomplete."};
    goals.push({clientId:txt(g.clientId,80)||a.goals[index]?.clientId||`goal-${index+1}`,title,domain,desiredOutcome,measurableTarget:txt(g.measurableTarget,220)||null,targetDate:dt(g.targetDate),why:txt(g.why,300)||null,priority:index+1,rationale:txt(g.rationale,300)||"This goal reflects what you said matters right now."});
  }
  const hr=Array.isArray(r.habits)?r.habits:[];if(hr.length>3)return {ok:false,error:"Proposal contains too many starter habits."};
  const habits:ProposalHabit[]=hr.map((item,index):ProposalHabit=>{const h=obj(item);return {clientId:txt(h.clientId,80)||`habit-${index+1}`,title:txt(h.title,180),frequency:pick(h.frequency,["daily","weekly","n_per_week"] as const)??"daily",goalClientId:txt(h.goalClientId,80)||null,rationale:txt(h.rationale,300)||"A small repeatable action supporting your starting priorities."}}).filter(h=>Boolean(h.title));
  const pr=Array.isArray(r.priorities)?r.priorities:[];if(pr.length<1||pr.length>3)return {ok:false,error:"Proposal must contain one to three first-week priorities."};
  const priorities:ProposalPriority[]=pr.map((item,index):ProposalPriority=>{const p=obj(item);return {clientId:txt(p.clientId,80)||`priority-${index+1}`,title:txt(p.title,220),goalClientId:txt(p.goalClientId,80)||null,dueWindow:pick(p.dueWindow,["today","this_week"] as const)??(index===0?"today":"this_week"),rationale:txt(p.rationale,300)||"Chosen as a manageable first step based on your stated priorities."}}).filter(p=>Boolean(p.title));
  if(!priorities.length)return {ok:false,error:"Proposal has no usable first-week priority."};

  let healthPlan:HealthPlanProposal|null=null;
  if(a.health.included&&!a.health.deferred){
    if(!r.healthPlan)return {ok:false,error:"Health was included but the proposal is missing a health plan."};
    const h=obj(r.healthPlan),n=int(h.daysPerWeek,1,7),minutes=int(h.sessionMinutes,10,180),experience=pick(h.experience,HEALTH_EXPERIENCE),sr=Array.isArray(h.schedule)?h.schedule:[];
    if(!n||!minutes||!experience||sr.length!==n)return {ok:false,error:"Health proposal does not match the stated training availability."};
    if(n!==a.health.trainingDaysPerWeek||minutes!==a.health.workoutDurationMinutes)return {ok:false,error:"Health proposal changed the training frequency or duration the user confirmed."};
    const schedule=sr.map((item,index)=>{const s=obj(item),dayIndex=int(s.dayIndex,0,6),duration=int(s.duration,10,180);return {key:txt(s.key,80)||`session-${index+1}`,day:txt(s.day,40)||dayName(dayIndex??0),dayIndex:dayIndex??0,title:txt(s.title,140)||"Training session",focus:txt(s.focus,160)||undefined,duration:duration??minutes}});
    if(new Set(schedule.map(s=>s.dayIndex)).size!==schedule.length)return {ok:false,error:"Health proposal repeats a training day."};
    if(schedule.some(s=>s.duration!==minutes))return {ok:false,error:"Health proposal changed the confirmed workout duration."};
    if(a.health.preferredDays.length&&schedule.some(s=>!a.health.preferredDays.includes(s.dayIndex)))return {ok:false,error:"Health proposal scheduled outside the preferred training days."};
    healthPlan={title:txt(h.title,180)||"Project You+ starting plan",goal:txt(h.goal,180)||label(a.health.objective??"general_health"),daysPerWeek:n,sessionMinutes:minutes,experience,schedule,rationale:txt(h.rationale,360)||"Built around the availability and experience you provided."};
  }

  let financialFocus:FinancialFocusProposal|null=null;
  if(!a.finance.deferred&&a.finance.primaryGoal){const f=obj(r.financialFocus),action=txt(f.action,220);if(!action)return {ok:false,error:"Finance was included but the proposal has no usable starting action."};financialFocus={title:txt(f.title,160)||label(a.finance.primaryGoal),action,goalType:txt(f.goalType,80)||a.finance.primaryGoal,rationale:txt(f.rationale,320)||"Keeps your starting money system focused on one controllable next step."};}
  const w=obj(r.weeklyReview),day=int(w.day,0,6)??a.coaching.weeklyReviewDay,time=tm(w.time,a.coaching.weeklyReviewTime);if(day===null||!time)return {ok:false,error:"Weekly Review configuration is missing."};
  if(day!==a.coaching.weeklyReviewDay||time!==a.coaching.weeklyReviewTime)return {ok:false,error:"Weekly Review must use the schedule the user confirmed."};
  return {ok:true,value:{generationVersion:txt(r.generationVersion,80)||ONBOARDING_VERSION,generatedAt:txt(r.generatedAt,60)||new Date().toISOString(),goals,habits,priorities,healthPlan,financialFocus,weeklyReview:{day,time,reminderIntent:a.coaching.reminderIntent,rationale:txt(w.rationale,320)||`Scheduled for ${dayName(day)} because that is the review time you selected.`},status:"draft"}};
}

export function buildFallbackProposal(a:OnboardingAnswers):OnboardingProposal{
  const goals=a.goals.slice(0,3).map((g,index):ProposalGoal=>({clientId:g.clientId,title:g.title,domain:g.domain,desiredOutcome:g.desiredOutcome,measurableTarget:g.measurableTarget??null,targetDate:g.targetDate??null,why:g.why??null,priority:index+1,rationale:g.rationale||"Kept close to your confirmed goal so the first system does not invent commitments."}));
  const habits:ProposalHabit[]=[],first=goals[0];
  if(first)habits.push({clientId:"habit-first-action",title:`Take one small action toward ${first.title}`,frequency:"daily",goalClientId:first.clientId,rationale:"A low-friction daily action builds consistency while Project You+ calibrates to your real behavior."});
  if(a.friction.categories.includes("no_clear_plan")&&habits.length<3)habits.push({clientId:"habit-plan-day",title:"Review today’s top priority",frequency:"daily",goalClientId:first?.clientId,rationale:"You identified lack of a clear plan as friction, so this creates a lightweight planning loop."});
  const priorities:ProposalPriority[]=goals.slice(0,3).map((g,index)=>({clientId:`priority-${index+1}`,title:`Define the next concrete step for ${g.title}`,goalClientId:g.clientId,dueWindow:index===0?"today":"this_week",rationale:index===0?"Starts with your highest-priority confirmed goal.":"Keeps the first week focused without overloading the day."}));
  let healthPlan:HealthPlanProposal|null=null;
  if(a.health.included&&!a.health.deferred&&a.health.trainingDaysPerWeek&&a.health.workoutDurationMinutes&&a.health.experience){const preferred=a.health.preferredDays,all=[1,2,3,4,5,6,0],pool=[...preferred,...all.filter(d=>!preferred.includes(d))],chosen=pool.slice(0,a.health.trainingDaysPerWeek);healthPlan={title:"Project You+ starting training week",goal:label(a.health.objective??"general_health"),daysPerWeek:a.health.trainingDaysPerWeek,sessionMinutes:a.health.workoutDurationMinutes,experience:a.health.experience as HealthPlanProposal["experience"],schedule:chosen.map((d,i)=>({key:`onboarding-session-${i+1}`,day:dayName(d),dayIndex:d,title:"Training session",focus:"Consistent, sustainable training",duration:a.health.workoutDurationMinutes!})),rationale:"Uses the training frequency, duration, experience, and availability you provided; intensity can be refined after real completion data exists."};}
  const financialFocus=!a.finance.deferred&&a.finance.primaryGoal?{title:label(a.finance.primaryGoal),action:financeAction(a.finance.primaryGoal),goalType:a.finance.primaryGoal,rationale:"Creates one organizational money action without requiring balances, income, or account access."}:null;
  const day=a.coaching.weeklyReviewDay??0,time=a.coaching.weeklyReviewTime||"18:00";
  return {generationVersion:`${ONBOARDING_VERSION}-fallback`,generatedAt:new Date().toISOString(),goals,habits:habits.slice(0,3),priorities:priorities.slice(0,3),healthPlan,financialFocus,weeklyReview:{day,time,reminderIntent:a.coaching.reminderIntent,rationale:`Uses the ${dayName(day)} review time you confirmed.`},status:"draft"};
}

export function label(v:string){return v.split("_").map(p=>p?p[0].toUpperCase()+p.slice(1):p).join(" ")}
export function dayName(d:number){return ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][d]??"Day"}
function sentence(v:string){const x=v.trim().replace(/[.]+$/g,"");return x?`${x[0].toUpperCase()}${x.slice(1)}`:""}
function guessDomain(raw:string,domains:DirectionDomain[],primary:DirectionDomain|null):DirectionDomain{const v=raw.toLowerCase();if(/workout|weight|fat|muscle|health|energy|run|gym/.test(v))return"health";if(/save|money|debt|spend|credit|invest|income/.test(v))return"money";if(/business|client|lead|revenue|company/.test(v))return"business";if(/career|job|promotion|resume|work/.test(v))return"career";return primary??domains[0]??"discipline"}
function financeAction(goal:string){const actions:Record<string,string>={emergency_fund:"Choose the next contribution toward your emergency fund.",pay_down_debt:"Choose the highest-priority debt and define the next payment action.",control_spending:"Choose one spending category to review this week.",save_for_purchase:"Define the purchase you are saving for and the next contribution.",increase_income:"Choose one concrete income-building action for this week.",invest_consistently:"Define a recurring investing review without changing investments yet.",build_business:"Choose one business money action that improves cash generation.",improve_credit:"Review the next credit-improvement action you can control.",understand_spending:"Review where your money went this week and name one pattern."};return actions[goal]??"Define one money action you can complete this week."}
