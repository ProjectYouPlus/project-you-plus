import "server-only";

import { createHash } from "node:crypto";
import type { UserContext } from "@/lib/ai/context";
import { dayName, type DirectionDomain, type OnboardingAnswers } from "@/lib/onboarding/schema";
import {
  SYSTEM_GENERATOR_VERSION,
  type MissingInformationIndicator,
  type SystemAction,
  type SystemGoal,
  type SystemMetricDefinition,
  type SystemProposal,
  type SystemScheduleBlock,
} from "@/lib/onboarding/system-schema";

export type SpecialistNotes = {
  planner?:Record<string,unknown>|null;
  health?:Record<string,unknown>|null;
  finance?:Record<string,unknown>|null;
  progress?:Record<string,unknown>|null;
};

export type SystemBuildInput = {
  proposalId:string;
  userId:string;
  onboardingSessionId:string;
  answers:OnboardingAnswers;
  context:UserContext;
  specialistNotes?:SpecialistNotes;
  now?:Date;
};

type Interval={day:number;start:number;end:number;label:string};

const DAY_MINUTES=1440;
const TIME_CANDIDATES:Record<string,string[]>={
  morning:["06:00","07:00","08:00","09:00"],midday:["11:30","12:00","13:00"],afternoon:["15:00","16:00","17:00"],evening:["18:00","19:00","20:00"],flexible:["07:00","12:00","17:00","19:00"],
};

export function contextVersionForSystem(answers:OnboardingAnswers,context:UserContext){
  const relevant={
    onboarding:answers,
    timezone:context.profile.timezone,
    goals:context.goals.map(g=>({id:g.id,title:g.title,status:g.status,deadline:g.deadline,progress:g.progress})),
    tasks:context.tasks.filter(t=>!t.completedAt).map(t=>({id:t.id,title:t.title,goalId:t.goalId,dueAt:t.dueAt,tier:t.tier})),
    habits:context.habits.map(h=>({id:h.id,title:h.title,goalId:h.goalId,targetFrequency:h.targetFrequency})),
    workSchedule:context.workSchedule,
    calendar:context.schedule.map(e=>({id:e.id,startAt:e.startAt,endAt:e.endAt})),
    training:context.training.activePlan?{id:context.training.activePlan.id,daysPerWeek:context.training.activePlan.daysPerWeek,sessionMinutes:context.training.activePlan.sessionMinutes,schedule:context.training.activePlan.schedule.map(s=>({dayIndex:s.dayIndex,duration:s.duration}))}:null,
    nutritionTargets:context.nutrition.targets??null,
    financeGoals:context.domains.finance.data?.goals?.map(g=>({name:g.name,progressPct:g.progressPct,targetPaceDate:g.targetPaceDate}))??[],
  };
  return createHash("sha256").update(stableStringify(relevant)).digest("hex").slice(0,40);
}

export function buildDeterministicSystem(input:SystemBuildInput):SystemProposal{
  const now=input.now??new Date();const timezone=input.context.profile.timezone||"UTC";const answers=input.answers;
  const contextVersion=contextVersionForSystem(answers,input.context);
  const missing:MissingInformationIndicator[]=[];
  const sourceGoals=answers.goals.slice(0,3);
  const goals:SystemGoal[]=sourceGoals.map((source,index)=>buildGoal(source,index,answers,input.context,missing));
  if(answers.friction.categories.includes("overcommitment")&&goals.length===3)goals[2].deferred=true;
  let actions:SystemAction[]=[];
  for(const goal of goals){if(goal.deferred)continue;actions.push(...actionsForGoal(goal,answers,input.context,missing,now));}
  actions=capStartingActions(actions,goals,answers);
  let schedule=buildSchedule(actions,answers,input.context,timezone,now);
  const conflictActions=new Set(schedule.filter(block=>block.conflictStatus==="conflict").map(block=>block.actionClientId));
  if(conflictActions.size){
    actions=actions.map(action=>conflictActions.has(action.clientId)?{...action,preferredTime:null,rationale:`${action.rationale} Exact timing needs confirmation because the first available slot conflicts with an existing commitment.`}:action);
    schedule=buildSchedule(actions,answers,input.context,timezone,now);
  }
  const metrics:SystemMetricDefinition[]=goals.flatMap(goal=>goal.successMetrics.map(metric=>({...metric,linkedGoalClientId:goal.clientId})));
  const workload=calculateWorkload(goals,actions,schedule,answers);
  const activeGoals=goals.filter(g=>!g.deferred);
  const firstAction=chooseFirstAction(actions,activeGoals);
  const todayPriorities=actions.filter(a=>!a.deferred&&a.kind!=="habit").sort((a,b)=>goalPriority(activeGoals,a.linkedGoalClientId)-goalPriority(activeGoals,b.linkedGoalClientId)).slice(0,3).map(a=>a.clientId);
  if(firstAction&&!todayPriorities.includes(firstAction.clientId))todayPriorities.unshift(firstAction.clientId);
  const weeklyReview={
    day:answers.coaching.weeklyReviewDay??0,time:answers.coaching.weeklyReviewTime||"18:00",reminderIntent:answers.coaching.reminderIntent,
    rationale:"Use real completion evidence to adjust workload, timing, and targets instead of judging the week by motivation alone.",goalCheckpointFrequency:"weekly" as const,
    healthCheckIn:goals.some(g=>g.domain==="health"&&!g.deferred),financeCheckIn:goals.some(g=>g.domain==="money"&&!g.deferred),
    questions:["What did you actually complete?","Which time windows worked best?","What was repeatedly skipped or rescheduled?","Was the workload realistic?","Did a minimum version keep momentum?","What should change next week—with your approval?"],
  };
  const confidence=missing.some(item=>item.blocksActivation)?"low":missing.length?"medium":"high";
  const proposal:SystemProposal={
    metadata:{proposalId:input.proposalId,userId:input.userId,onboardingSessionId:input.onboardingSessionId,sourceContextVersion:contextVersion,generatorVersion:SYSTEM_GENERATOR_VERSION,createdAt:now.toISOString(),status:"awaiting_confirmation",confidence,missingInformation:dedupeMissing(missing),validationVersion:"v3"},
    goals,actions,schedule,metrics,weeklyReview,
    today:{firstMeaningfulActionClientId:firstAction?.clientId??actions[0]?.clientId??"",priorityActionClientIds:todayPriorities.slice(0,3),habitActionClientIds:actions.filter(a=>!a.deferred&&a.kind==="habit"&&isDueToday(a,now,timezone)).slice(0,3).map(a=>a.clientId),coachOpeningMessage:coachOpening(answers.coaching.style??"balanced")},
    workload,frictionSummary:frictionSummary(answers),activationWarnings:activationWarnings(schedule,missing),
    generationVersion:SYSTEM_GENERATOR_VERSION,generatedAt:now.toISOString(),status:"draft",
    habits:actions.filter(a=>!a.deferred&&a.kind==="habit").map(a=>({clientId:a.clientId,title:a.title,frequency:a.frequency==="daily"?"daily":a.frequency==="weekly"?"weekly":"n_per_week",goalClientId:a.linkedGoalClientId,rationale:a.rationale,minimumVersion:a.minimumVersion})),
    priorities:actions.filter(a=>!a.deferred&&(a.kind==="task"||a.kind==="recurring_action"||a.kind==="review")).slice(0,3).map((a,index)=>({clientId:a.clientId,title:a.title,goalClientId:a.linkedGoalClientId,dueWindow:index===0?"today":"this_week",rationale:a.rationale})),
    healthPlan:buildHealthCompatibility(goals,actions,answers),
    financialFocus:buildFinanceCompatibility(goals,actions,answers,now),
  };
  return proposal;
}

export function makeSystemLighter(proposal:SystemProposal,answers:OnboardingAnswers):SystemProposal{
  const next=structuredClone(proposal);const activeGoals=next.goals.filter(g=>!g.deferred);const kept=new Set<string>();const reductions:string[]=[];
  for(const goal of activeGoals){const candidates=next.actions.filter(a=>!a.deferred&&a.linkedGoalClientId===goal.clientId).sort(actionImportance);if(candidates[0])kept.add(candidates[0].clientId);}
  for(const action of next.actions){
    if(action.deferred)continue;
    if(action.kind==="workout"&&action.targetPerWeek&&action.targetPerWeek>2){action.targetPerWeek-=1;action.preferredDays=action.preferredDays.slice(0,action.targetPerWeek);reductions.push(`Reduced ${action.title} to ${action.targetPerWeek} sessions per week.`);kept.add(action.clientId);continue;}
    if(action.frequency==="daily"&&action.kind==="habit"&&kept.has(action.clientId)){action.frequency="weekdays";action.targetPerWeek=5;reductions.push(`Changed ${action.title} from every day to weekdays.`);continue;}
    if(!kept.has(action.clientId)&&next.actions.filter(a=>!a.deferred&&a.linkedGoalClientId===action.linkedGoalClientId).length>1){action.deferred=true;reductions.push(`Deferred ${action.title} from the starting week.`);}
  }
  next.schedule=next.schedule.filter(block=>!next.actions.find(a=>a.clientId===block.actionClientId)?.deferred);
  next.workload={...calculateWorkload(next.goals,next.actions,next.schedule,answers),phased:true,phaseLabel:"Week 1 · lighter start",reductions:[...next.workload.reductions,...reductions]};
  refreshCompatibility(next,answers);
  next.metadata.status="awaiting_confirmation";return next;
}

export function replaceSystemAction(proposal:SystemProposal,actionId:string,answers:OnboardingAnswers):SystemProposal{
  const next=structuredClone(proposal);const action=next.actions.find(item=>item.clientId===actionId);if(!action)return next;
  if(action.kind==="habit"){action.title=action.domain==="discipline"?"Five-minute tomorrow plan":action.domain==="health"?"Log a simple movement check-in":`Complete a five-minute ${action.domain} check-in`;action.durationMinutes=5;action.minimumVersion="Do the two-minute version.";}
  else if(action.kind==="workout"){action.title="Minimum training session";action.durationMinutes=Math.min(action.durationMinutes,30);action.minimumVersion="Complete 10 minutes of movement if the full session is not realistic.";}
  else{action.title=`Complete one focused ${action.domain} action`;action.durationMinutes=Math.min(action.durationMinutes||15,20);action.minimumVersion="Spend five focused minutes on the next concrete step.";}
  action.rationale=`Replacement selected to keep the same goal while lowering friction.`;
  next.workload=calculateWorkload(next.goals,next.actions,next.schedule,answers);refreshCompatibility(next,answers);return next;
}

export function deterministicSavings(input:{target:number;current:number|null;targetDate:string|null;now:Date}){
  if(!Number.isFinite(input.target)||input.target<=0)return null;
  if(!input.targetDate)return {target:input.target,current:input.current,remaining:null,months:null,monthly:null,weekly:null,calculation:null};
  const months=monthsRemaining(input.now,input.targetDate);if(months<=0)return {target:input.target,current:input.current,remaining:null,months,monthly:null,weekly:null,calculation:null};
  if(input.current==null)return {target:input.target,current:null,remaining:null,months,monthly:null,weekly:null,calculation:null};
  const remaining=Math.max(0,input.target-input.current);const monthly=roundMoney(remaining/months);const weekly=roundMoney(monthly*12/52);
  return {target:input.target,current:input.current,remaining,months,monthly,weekly,calculation:`$${money(remaining)} remaining ÷ ${months} month${months===1?"":"s"} = $${money(monthly)}/month`};
}

function buildGoal(source:OnboardingAnswers["goals"][number],index:number,answers:OnboardingAnswers,context:UserContext,missing:MissingInformationIndicator[]):SystemGoal{
  const domain=inferDomain(source);const raw=`${source.raw} ${source.title} ${source.desiredOutcome}`.trim();const lower=raw.toLowerCase();
  let title=source.title.trim()||source.raw.trim();let desired=source.desiredOutcome.trim()||source.raw.trim();let targetValue:number|null=null,targetUnit:string|null=null,currentValue:number|null=null;
  if(domain==="health"&&/(lose|weight|fat|body composition)/i.test(raw)){const n=extractNumberBeforeUnit(raw,/\b(lb|lbs|pound|pounds)\b/i);if(n){targetValue=n;targetUnit="lb";}title="Improve body composition";desired=targetValue?`Lose ${trimNumber(targetValue)} pounds sustainably while protecting strength and consistency.`:desired;}
  if(domain==="money"&&/(save|saving|fund|purchase)/i.test(raw)){const amount=extractMoney(raw);if(amount){targetValue=amount;targetUnit="USD";}const saved=parseAlreadySaved(raw)||parseAlreadySaved(answers.finance.optionalDetail);if(saved!=null)currentValue=saved;title=targetValue?`Save $${money(targetValue)}`:title;}
  if(domain==="discipline"||/disciplin|consistent|consistency/i.test(lower)){title="Build a consistent daily execution system";desired="Build visible consistency through a small daily execution rhythm that supports the other active goals.";}
  const successMetrics=metricsForGoal(domain,title,targetValue,targetUnit,currentValue,context,missing,source.clientId);
  const milestones=milestonesForGoal(domain,targetValue,targetUnit,source.targetDate??null);
  return {clientId:`system-${source.clientId}`,sourceGoalClientId:source.clientId,sourceOnboardingGoal:source.raw||source.title,domain,title,desiredOutcome:desired,measurableTarget:source.measurableTarget??(targetValue!=null?`${trimNumber(targetValue)} ${targetUnit??""}`.trim():null),targetValue,targetUnit,targetDate:source.targetDate??null,currentValue,priority:index+1,successMetrics,milestones,rationale:goalRationale(domain,answers),frictionResponse:frictionSummary(answers),deferred:false};
}

function metricsForGoal(domain:DirectionDomain,title:string,targetValue:number|null,targetUnit:string|null,currentValue:number|null,context:UserContext,missing:MissingInformationIndicator[],sourceId:string){
  if(domain==="health"){
    const bodyComp=/body composition|weight|fat/i.test(title);const rows=[
      {id:`metric-${sourceId}-workout`,name:"Workout completion",unit:"sessions",direction:"increase" as const,type:"leading" as const,entryFrequency:"weekly" as const,dataSource:"workout" as const,baseline:null,targetValue:null,targetLabel:"Complete the scheduled sessions",needsConfirmation:false},
    ];
    if(bodyComp){rows.unshift({id:`metric-${sourceId}-weight`,name:"Weight trend",unit:"lb",direction:"decrease" as const,type:"outcome" as const,entryFrequency:"weekly" as const,dataSource:"health_metric" as const,baseline:null,targetValue,targetLabel:targetValue?`Lose ${trimNumber(targetValue)} lb`:null,needsConfirmation:targetValue==null});}
    const steps=context.health.steps;if(steps!=null)rows.push({id:`metric-${sourceId}-movement`,name:"Daily movement",unit:"steps",direction:"maintain" as const,type:"leading" as const,entryFrequency:"daily" as const,dataSource:"health_metric" as const,baseline:steps,targetValue:Math.max(1000,Math.round(steps/500)*500),targetLabel:"Start from the current movement baseline",needsConfirmation:false});
    else{rows.push({id:`metric-${sourceId}-movement`,name:"Daily movement",unit:"steps",direction:"increase" as const,type:"leading" as const,entryFrequency:"daily" as const,dataSource:"health_metric" as const,baseline:null,targetValue:null,targetLabel:"Needs a baseline before a numeric target is set",needsConfirmation:true});missing.push({key:"health_movement_baseline",domain:"health",label:"A movement baseline is needed before setting a numeric daily target.",blocksActivation:false,resolution:"editable_target"});}
    return rows;
  }
  if(domain==="money")return [{id:`metric-${sourceId}-savings`,name:"Savings balance",unit:"USD",direction:"increase" as const,type:"outcome" as const,entryFrequency:"monthly" as const,dataSource:"finance" as const,baseline:currentValue,targetValue,targetLabel:targetValue?`Reach $${money(targetValue)}`:null,needsConfirmation:targetValue==null},{id:`metric-${sourceId}-review`,name:"Financial review completion",unit:"reviews",direction:"complete" as const,type:"leading" as const,entryFrequency:"weekly" as const,dataSource:"weekly_review" as const,baseline:null,targetValue:1,targetLabel:"One review per week",needsConfirmation:false}];
  if(domain==="discipline")return [{id:`metric-${sourceId}-planning`,name:"Daily planning consistency",unit:"days",direction:"increase" as const,type:"leading" as const,entryFrequency:"weekly" as const,dataSource:"habit" as const,baseline:null,targetValue:5,targetLabel:"Plan on five days per week to start",needsConfirmation:false},{id:`metric-${sourceId}-review`,name:"Weekly Review completion",unit:"reviews",direction:"complete" as const,type:"leading" as const,entryFrequency:"weekly" as const,dataSource:"weekly_review" as const,baseline:null,targetValue:1,targetLabel:"Complete the Weekly Review",needsConfirmation:false}];
  return [{id:`metric-${sourceId}-actions`,name:"Goal actions completed",unit:"actions",direction:"increase" as const,type:"leading" as const,entryFrequency:"weekly" as const,dataSource:"task" as const,baseline:null,targetValue:1,targetLabel:"Complete at least one concrete action each week",needsConfirmation:false}];
}

function milestonesForGoal(domain:DirectionDomain,targetValue:number|null,targetUnit:string|null,targetDate:string|null){
  if(targetValue==null)return [];
  const fractions=domain==="money"?[.25,.5,.75,1]:[.33,.66,1];return fractions.map((fraction,index)=>({id:`milestone-${index+1}`,title:fraction===1?"Target reached":`${Math.round(fraction*100)}% checkpoint`,targetValue:roundMoney(targetValue*fraction),unit:targetUnit,targetDate:fraction===1?targetDate:null,order:index+1}));
}

function actionsForGoal(goal:SystemGoal,answers:OnboardingAnswers,context:UserContext,missing:MissingInformationIndicator[],now:Date):SystemAction[]{
  const friction=answers.friction.categories;const recovery=recoveryRule(friction);const actions:SystemAction[]=[];
  if(goal.domain==="health"){
    const count=Math.max(1,Math.min(answers.health.trainingDaysPerWeek??1,7));const duration=Math.max(10,answers.health.workoutDurationMinutes??20);const days=chooseTrainingDays(count,answers,context);
    actions.push({clientId:`action-${goal.clientId}-workout`,linkedGoalClientId:goal.clientId,domain:"health",kind:"workout",title:"Complete scheduled strength or movement session",frequency:"n_per_week",targetPerWeek:count,preferredDays:days,preferredTime:null,durationMinutes:duration,trigger:"Use the first protected training window on the selected day.",minimumVersion:friction.includes("inconsistency")||friction.includes("low_motivation")?`Complete ${Math.min(15,Math.max(10,Math.round(duration/2)))} minutes of movement.`:null,recoveryRule:recovery,evidenceType:"workout_logged",startingDifficulty:"standard",firstDueDate:null,rationale:`Uses the ${count} training day${count===1?"":"s"} and ${duration}-minute session length you said are realistic.`,deferred:false});
    if(/body composition|weight|fat/i.test(`${goal.title} ${goal.desiredOutcome}`))actions.push({clientId:`action-${goal.clientId}-weigh`,linkedGoalClientId:goal.clientId,domain:"health",kind:"recurring_action",title:"Record a weekly weigh-in",frequency:"weekly",targetPerWeek:1,preferredDays:[answers.coaching.weeklyReviewDay??0],preferredTime:"08:00",durationMinutes:3,trigger:"Before the Weekly Review on the selected review day.",minimumVersion:"Record the number only; analysis can happen during Weekly Review.",recoveryRule:recovery,evidenceType:"metric_recorded",startingDifficulty:"easy",firstDueDate:null,rationale:"A weekly trend gives progress evidence without making daily scale movement the goal.",deferred:false});
    const protein=context.nutrition.targets?.protein??null;if(protein!=null)actions.push({clientId:`action-${goal.clientId}-protein`,linkedGoalClientId:goal.clientId,domain:"health",kind:"habit",title:`Reach the existing ${protein} g protein target`,frequency:"daily",targetPerWeek:7,preferredDays:[0,1,2,3,4,5,6],preferredTime:null,durationMinutes:5,trigger:"Use meals already being logged in Project You+.",minimumVersion:"Log protein for the day even if the target is missed.",recoveryRule:recovery,evidenceType:"manual_checkin",startingDifficulty:"standard",firstDueDate:dateInTimezone(now,context.profile.timezone),rationale:"Reuses your existing nutrition target instead of inventing a new protein number.",deferred:false});
    else missing.push({key:"health_protein_target",domain:"health",label:"Protein target needs confirmation because Project You+ does not have the inputs for an approved calculation.",blocksActivation:false,resolution:"follow_up"});
    return actions;
  }
  if(goal.domain==="money"){
    const target=goal.targetValue;const current=goal.currentValue;const calc=target?deterministicSavings({target,current,targetDate:goal.targetDate,now}):null;
    if(target&&!goal.targetDate)missing.push({key:`finance_target_date_${goal.clientId}`,domain:"money",label:"Choose a savings timeline before Project You+ calculates a required monthly contribution.",blocksActivation:false,resolution:"editable_target"});
    if(target&&goal.targetDate&&current==null)missing.push({key:`finance_current_amount_${goal.clientId}`,domain:"money",label:"Current saved amount is needed before calculating the remaining monthly contribution.",blocksActivation:false,resolution:"editable_target"});
    if(calc?.monthly!=null)actions.push({clientId:`action-${goal.clientId}-save`,linkedGoalClientId:goal.clientId,domain:"money",kind:"recurring_action",title:`Contribute about $${money(calc.weekly??0)} per week toward the savings goal`,frequency:"weekly",targetPerWeek:1,preferredDays:[1],preferredTime:null,durationMinutes:5,trigger:"Review the contribution during the weekly finance checkpoint.",minimumVersion:"Record what you can contribute this week; do not hide a shortfall.",recoveryRule:recovery,evidenceType:"manual_checkin",startingDifficulty:"standard",firstDueDate:null,rationale:`Deterministic pace: ${calc.calculation}. No transfer is initiated automatically.`,deferred:false});
    actions.push({clientId:`action-${goal.clientId}-spend`,linkedGoalClientId:goal.clientId,domain:"money",kind:"review",title:"Review discretionary spending for the last 7 days",frequency:"weekly",targetPerWeek:1,preferredDays:[answers.coaching.weeklyReviewDay??0],preferredTime:null,durationMinutes:15,trigger:"Complete immediately before or during Weekly Review.",minimumVersion:"Review one controllable spending category for five minutes.",recoveryRule:recovery,evidenceType:"financial_review_completed",startingDifficulty:"easy",firstDueDate:null,rationale:context.domains.finance.data?.monthlySpending!=null?"Uses the live money picture to make spending visible before recommending a limit.":"Starts with observation because income and expense context is not complete enough to invent a spending limit.",deferred:false});
    actions.push({clientId:`action-${goal.clientId}-month`,linkedGoalClientId:goal.clientId,domain:"money",kind:"recurring_action",title:"Complete a monthly savings checkpoint",frequency:"weekly",targetPerWeek:1,preferredDays:[answers.coaching.weeklyReviewDay??0],preferredTime:null,durationMinutes:5,trigger:"Use the first Weekly Review of each month as the monthly checkpoint.",minimumVersion:"Record the current savings balance.",recoveryRule:recovery,evidenceType:"metric_recorded",startingDifficulty:"easy",firstDueDate:null,rationale:"Keeps the outcome visible without making the plan depend on daily money checks.",deferred:false});
    return actions;
  }
  if(goal.domain==="discipline"){
    actions.push({clientId:`action-${goal.clientId}-plan`,linkedGoalClientId:goal.clientId,domain:"discipline",kind:"habit",title:"Choose today’s three most important actions",frequency:"weekdays",targetPerWeek:5,preferredDays:[1,2,3,4,5],preferredTime:"07:30",durationMinutes:5,trigger:"After the first normal morning transition (wake-up, coffee, or arriving at work).",minimumVersion:"Choose one priority only.",recoveryRule:recovery,evidenceType:"habit_logged",startingDifficulty:"easy",firstDueDate:dateInTimezone(now,context.profile.timezone),rationale:"Turns discipline into a visible behavior instead of a personality goal.",deferred:false});
    actions.push({clientId:`action-${goal.clientId}-reset`,linkedGoalClientId:goal.clientId,domain:"discipline",kind:"habit",title:"Do a short evening reset for tomorrow",frequency:"weekdays",targetPerWeek:5,preferredDays:[0,1,2,3,4],preferredTime:"20:30",durationMinutes:5,trigger:"Before the normal evening wind-down.",minimumVersion:"Write the single first action for tomorrow.",recoveryRule:recovery,evidenceType:"habit_logged",startingDifficulty:"easy",firstDueDate:null,rationale:"Reduces dependence on morning motivation by making the next step visible the night before.",deferred:false});
    return actions;
  }
  actions.push({clientId:`action-${goal.clientId}-focus`,linkedGoalClientId:goal.clientId,domain:goal.domain,kind:"task",title:`Complete the first concrete step for ${goal.title}`,frequency:"once",targetPerWeek:null,preferredDays:[],preferredTime:null,durationMinutes:friction.includes("lack_of_time")?15:25,trigger:"Use the first realistic open block this week.",minimumVersion:"Spend five focused minutes on the next concrete step.",recoveryRule:recovery,evidenceType:"task_completed",startingDifficulty:"easy",firstDueDate:dateInTimezone(now,context.profile.timezone),rationale:"Creates evidence of movement immediately instead of leaving the goal open-ended.",deferred:false});
  return actions;
}

function capStartingActions(actions:SystemAction[],goals:SystemGoal[],answers:OnboardingAnswers){
  const next=structuredClone(actions);const max=answers.friction.categories.includes("overcommitment")||answers.friction.categories.includes("lack_of_time")?5:7;
  while(next.filter(a=>!a.deferred).length>max){const removable=next.slice().reverse().find(a=>!a.deferred&&next.filter(x=>!x.deferred&&x.linkedGoalClientId===a.linkedGoalClientId).length>1&&a.kind!=="workout");if(!removable)break;removable.deferred=true;}
  let daily=next.filter(a=>!a.deferred&&a.kind==="habit"&&(a.frequency==="daily"||a.frequency==="weekdays"));while(daily.length>3){daily[daily.length-1].deferred=true;daily=next.filter(a=>!a.deferred&&a.kind==="habit"&&(a.frequency==="daily"||a.frequency==="weekdays"));}
  for(const goal of goals.filter(g=>!g.deferred)){if(!next.some(a=>!a.deferred&&a.linkedGoalClientId===goal.clientId)){const first=next.find(a=>a.linkedGoalClientId===goal.clientId);if(first)first.deferred=false;}}
  return next;
}

function buildSchedule(actions:SystemAction[],answers:OnboardingAnswers,context:UserContext,timezone:string,now:Date){
  const busy=busyIntervals(answers,context,timezone,now);const blocks:SystemScheduleBlock[]=[];
  for(const action of actions.filter(a=>!a.deferred)){
    if(action.frequency==="once")continue;
    const days=action.preferredDays.length?action.preferredDays:[answers.coaching.weeklyReviewDay??0];
    let time=action.preferredTime;
    if(action.kind==="workout")time=chooseFreeTime(days,action.durationMinutes,answers.health.timeOfDay,busy,answers)||null;
    else if(!time&&action.kind!=="habit")time=chooseFreeTime(days,action.durationMinutes,"flexible",busy,answers)||null;
    const conflicts=time?days.flatMap(day=>conflictsFor(day,time,action.durationMinutes,busy)):[];
    blocks.push({clientId:`schedule-${action.clientId}`,actionClientId:action.clientId,linkedGoalClientId:action.linkedGoalClientId,recurrence:"weekly",date:null,days,startTime:time,endTime:time?addMinutes(time,action.durationMinutes):null,timezone,flexibility:action.kind==="workout"?"fixed":"flexible",conflictStatus:conflicts.length?"conflict":time?"clear":"needs_confirmation",conflictReason:conflicts.length?`Conflicts with ${conflicts[0]}.`:time?null:"No exact time was assumed; choose a real open window before relying on this schedule."});
  }
  return blocks;
}

function busyIntervals(answers:OnboardingAnswers,context:UserContext,timezone:string,now:Date){
  const rows:Interval[]=[];const work=answers.life.work;
  if(work.type==="fixed")for(const day of work.days)rows.push(...recurringIntervals(day,work.startTime,work.endTime,"Work"));
  for(const item of answers.life.commitments)for(const day of item.days)rows.push(...recurringIntervals(day,item.startTime,item.endTime,item.label));
  for(const event of context.schedule){const start=new Date(event.startAt),end=new Date(event.endAt);if(Number.isNaN(start.getTime())||Number.isNaN(end.getTime()))continue;const day=weekdayInTimezone(start,timezone);const s=timeMinutes(timeInTimezone(start,timezone)),e=timeMinutes(timeInTimezone(end,timezone));if(e>s)rows.push({day,start:s,end:e,label:event.title||"Calendar event"});}
  const wake=answers.life.wakeSleep;if(wake.mode==="fixed"&&wake.wakeTime&&wake.sleepTime){const w=timeMinutes(wake.wakeTime),s=timeMinutes(wake.sleepTime);for(let day=0;day<7;day++){if(w<s){if(w>0)rows.push({day,start:0,end:w,label:"Sleep"});if(s<DAY_MINUTES)rows.push({day,start:s,end:DAY_MINUTES,label:"Sleep"});}else if(w>s){rows.push({day,start:s,end:w,label:"Sleep"});}}}
  return rows;
}

function recurringIntervals(day:number,startText:string,endText:string,label:string){const start=timeMinutes(startText),end=timeMinutes(endText);if(start===end)return [{day,start:0,end:DAY_MINUTES,label}];if(end>start)return [{day,start,end,label}];return [{day,start,end:DAY_MINUTES,label},{day:(day+1)%7,start:0,end,label}];}
function chooseFreeTime(days:number[],duration:number,window:string|null,busy:Interval[],answers:OnboardingAnswers){for(const candidate of TIME_CANDIDATES[window??"flexible"]??TIME_CANDIDATES.flexible){if(days.every(day=>!conflictsFor(day,candidate,duration,busy).length))return candidate;}return null;}
function conflictsFor(day:number,startText:string,duration:number,busy:Interval[]){const start=timeMinutes(startText),end=start+duration;return busy.filter(row=>row.day===day&&start<row.end&&end>row.start).map(row=>row.label);}
function chooseTrainingDays(count:number,answers:OnboardingAnswers,context:UserContext){const preferred=answers.health.preferredDays.filter(day=>day>=0&&day<=6);if(preferred.length>=count)return preferred.slice(0,count);const workDays=new Set(answers.life.work.type==="fixed"?answers.life.work.days:[]);const candidates=[1,3,5,2,4,6,0].filter(day=>!preferred.includes(day)&&!workDays.has(day));const fallback=[1,3,5,2,4,6,0].filter(day=>!preferred.includes(day));return [...preferred,...candidates,...fallback].slice(0,count);}

function calculateWorkload(goals:SystemGoal[],actions:SystemAction[],schedule:SystemScheduleBlock[],answers:OnboardingAnswers){const active=actions.filter(a=>!a.deferred);let weeklyMinutes=0;for(const action of active){const occurrences=action.frequency==="daily"?7:action.frequency==="weekdays"?5:action.frequency==="weekly"?1:action.frequency==="n_per_week"?(action.targetPerWeek??1):1;weeklyMinutes+=occurrences*action.durationMinutes;}const dailyHabitCount=active.filter(a=>a.kind==="habit"&&(a.frequency==="daily"||a.frequency==="weekdays")).length;const reductions:string[]=[];const phased=goals.some(g=>g.deferred)||active.length<actions.length;if(phased)reductions.push("The starting week was phased to avoid overloading the schedule.");return {weeklyMinutes,dailyHabitCount,weeklyActionCount:active.filter(a=>a.frequency!=="daily"&&a.frequency!=="weekdays").length,scheduledSessionCount:schedule.filter(s=>s.startTime).reduce((sum,s)=>sum+s.days.length,0),activeGoalCount:goals.filter(g=>!g.deferred).length,phased,phaseLabel:phased?"Week 1 · establish the minimum system":"Week 1 · establish the system",bufferPreserved:true,reductions};}
function chooseFirstAction(actions:SystemAction[],goals:SystemGoal[]){return actions.filter(a=>!a.deferred).sort((a,b)=>goalPriority(goals,a.linkedGoalClientId)-goalPriority(goals,b.linkedGoalClientId)||actionImportance(a,b))[0]??null;}
function goalPriority(goals:SystemGoal[],id:string){return goals.find(g=>g.clientId===id)?.priority??99;}
function actionImportance(a:SystemAction,b:SystemAction){const score=(x:SystemAction)=>x.kind==="workout"?0:x.kind==="task"?1:x.kind==="habit"?2:x.kind==="review"?3:4;return score(a)-score(b);}

function buildHealthCompatibility(goals:SystemGoal[],actions:SystemAction[],answers:OnboardingAnswers):SystemProposal["healthPlan"]{const goal=goals.find(g=>g.domain==="health"&&!g.deferred),workout=actions.find(a=>a.kind==="workout"&&!a.deferred);if(!goal||!workout||!answers.health.experience)return null;return {title:"Starting health system",goal:goal.desiredOutcome,daysPerWeek:workout.targetPerWeek??workout.preferredDays.length,sessionMinutes:workout.durationMinutes,experience:answers.health.experience as any,schedule:workout.preferredDays.map((day,index)=>({key:`session-${index+1}`,day:dayName(day),dayIndex:day,title:"Training session",focus:answers.health.objective??"general health",duration:workout.durationMinutes,time:null})),rationale:workout.rationale};}
function buildFinanceCompatibility(goals:SystemGoal[],actions:SystemAction[],answers:OnboardingAnswers,now:Date):SystemProposal["financialFocus"]{const goal=goals.find(g=>g.domain==="money"&&!g.deferred);if(!goal)return null;const calc=goal.targetValue?deterministicSavings({target:goal.targetValue,current:goal.currentValue,targetDate:goal.targetDate,now}):null;const review=actions.find(a=>a.linkedGoalClientId===goal.clientId&&!a.deferred);return {title:goal.title,action:review?.title??"Review the current financial picture",goalType:answers.finance.primaryGoal??"savings",rationale:calc?.calculation?`${calc.calculation}. The system records a target only; it does not move money.`:"The first system avoids inventing a deadline, contribution, or spending limit when the required values are missing.",targetAmount:goal.targetValue,currentAmount:goal.currentValue,monthlyTarget:calc?.monthly??null,weeklyEquivalent:calc?.weekly??null,calculation:calc?.calculation??null};}
function refreshCompatibility(proposal:SystemProposal,answers:OnboardingAnswers){proposal.habits=proposal.actions.filter(a=>!a.deferred&&a.kind==="habit").map(a=>({clientId:a.clientId,title:a.title,frequency:a.frequency==="daily"?"daily":a.frequency==="weekly"?"weekly":"n_per_week",goalClientId:a.linkedGoalClientId,rationale:a.rationale,minimumVersion:a.minimumVersion}));proposal.priorities=proposal.actions.filter(a=>!a.deferred&&(a.kind==="task"||a.kind==="recurring_action"||a.kind==="review")).slice(0,3).map((a,i)=>({clientId:a.clientId,title:a.title,goalClientId:a.linkedGoalClientId,dueWindow:i===0?"today":"this_week",rationale:a.rationale}));proposal.healthPlan=buildHealthCompatibility(proposal.goals,proposal.actions,answers);proposal.financialFocus=buildFinanceCompatibility(proposal.goals,proposal.actions,answers,new Date());proposal.today.priorityActionClientIds=proposal.actions.filter(a=>!a.deferred&&a.kind!=="habit").slice(0,3).map(a=>a.clientId);proposal.today.habitActionClientIds=proposal.actions.filter(a=>!a.deferred&&a.kind==="habit").slice(0,3).map(a=>a.clientId);if(!proposal.actions.find(a=>a.clientId===proposal.today.firstMeaningfulActionClientId&&!a.deferred)proposal.today.firstMeaningfulActionClientId=proposal.actions.find(a=>!a.deferred)?.clientId??"";}

function inferDomain(goal:OnboardingAnswers["goals"][number]):DirectionDomain{const text=`${goal.raw} ${goal.title}`.toLowerCase();if(/save|saving|debt|spend|money|income|credit|invest|budget|\$/.test(text))return"money";if(/weight|pound|lbs|fat|muscle|workout|health|strength|fitness/.test(text))return"health";if(/disciplin|consistent|habit|routine/.test(text))return"discipline";return goal.domain;}
function goalRationale(domain:DirectionDomain,answers:OnboardingAnswers){const friction=answers.friction.categories.map(value=>value.replaceAll("_"," ")).join(", ");return `Built from your ${domain} goal and calibrated around ${friction||"your stated life structure"}. The starting system emphasizes controllable behaviors and evidence rather than motivation.`;}
function frictionSummary(answers:OnboardingAnswers){const items=answers.friction.categories;if(!items.length)return"The starting system stays intentionally small and evidence-based.";const map:Record<string,string>={inconsistency:"minimum versions and a missed-day recovery rule",lack_of_time:"short actions and protected windows",no_clear_plan:"defined first actions and visible next steps",poor_habits:"specific triggers and preparation cues",spending:"a weekly spending checkpoint before setting limits",low_motivation:"small starts and progress visibility",overcommitment:"fewer simultaneous commitments and phased work"};return `This plan responds to ${items.map(x=>x.replaceAll("_"," ")).join(", ")} with ${items.map(x=>map[x]??"a lighter starting structure").join(", ")}.`;}
function recoveryRule(friction:string[]){return friction.includes("inconsistency")||friction.includes("low_motivation")||friction.includes("poor_habits")?"Missing one day does not reset progress. Resume with the minimum version at the next available opportunity.":"If the planned window is missed, reschedule once to the next realistic open window instead of doubling the workload.";}
function coachOpening(style:string){if(style==="direct")return"Your system is ready. Start with the first priority and use the minimum version if the full action will not fit. We will adjust from evidence, not excuses or perfection.";if(style==="gentle")return"Your system is ready. Today is intentionally manageable: begin with the first priority, use the minimum version when needed, and let real evidence guide the next adjustment.";return"Your system is ready. Today is intentionally simple: complete your first priority, follow the health action if it is due, and use the minimum version when needed. We’ll build from evidence—not perfection.";}
function activationWarnings(schedule:SystemScheduleBlock[],missing:MissingInformationIndicator[]){const out:string[]=[];if(schedule.some(s=>s.conflictStatus==="conflict"))out.push("Resolve schedule conflicts before activation.");if(schedule.some(s=>s.conflictStatus==="needs_confirmation"))out.push("Some actions are intentionally flexible because no exact safe time was available from current context.");for(const item of missing.filter(m=>m.blocksActivation))out.push(item.label);return out;}
function dedupeMissing(items:MissingInformationIndicator[]){return Array.from(new Map(items.map(item=>[item.key,item])).values());}
function isDueToday(action:SystemAction,now:Date,timezone:string){return !action.preferredDays.length||action.preferredDays.includes(weekdayInTimezone(now,timezone));}
function extractMoney(text:string){const match=text.match(/\$\s*([0-9][0-9,]*(?:\.\d{1,2})?)/);if(match)return Number(match[1].replaceAll(",",""));const plain=text.match(/\b(?:save|saving|target|goal)\D{0,12}([0-9][0-9,]{2,})\b/i);return plain?Number(plain[1].replaceAll(",","")):null;}
function parseAlreadySaved(text:string){const match=text.match(/(?:already\s+saved|currently\s+saved|saved\s+so\s+far|have\s+saved)\D{0,10}\$?\s*([0-9][0-9,]*(?:\.\d{1,2})?)/i);return match?Number(match[1].replaceAll(",","")):null;}
function extractNumberBeforeUnit(text:string,unit:RegExp){const pattern=new RegExp(`([0-9]+(?:\\.[0-9]+)?)\\s*${unit.source}`,unit.flags);const match=text.match(pattern);return match?Number(match[1]):null;}
function monthsRemaining(now:Date,targetDate:string){const target=new Date(`${targetDate}T12:00:00Z`);if(Number.isNaN(target.getTime()))return 0;const nowDate=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()));if(target<=nowDate)return 0;const days=(target.getTime()-nowDate.getTime())/86400000;return Math.max(1,Math.ceil(days/30.4375));}
function roundMoney(n:number){return Math.round((n+Number.EPSILON)*100)/100;}
function money(n:number){return roundMoney(n).toLocaleString("en-US",{maximumFractionDigits:2});}
function trimNumber(n:number){return Number.isInteger(n)?String(n):String(roundMoney(n));}
function timeMinutes(text:string){const [h,m]=text.split(":").map(Number);return Math.max(0,Math.min(DAY_MINUTES,(h||0)*60+(m||0)));}
function addMinutes(text:string,amount:number){const total=(timeMinutes(text)+amount)%DAY_MINUTES;return `${String(Math.floor(total/60)).padStart(2,"0")}:${String(total%60).padStart(2,"0")}`;}
function weekdayInTimezone(date:Date,timezone:string){const name=new Intl.DateTimeFormat("en-US",{timeZone:timezone,weekday:"short"}).format(date);return ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].indexOf(name);}
function timeInTimezone(date:Date,timezone:string){const parts=new Intl.DateTimeFormat("en-US",{timeZone:timezone,hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(date);return `${parts.find(p=>p.type==="hour")?.value??"00"}:${parts.find(p=>p.type==="minute")?.value??"00"}`;}
function dateInTimezone(date:Date,timezone:string){const parts=new Intl.DateTimeFormat("en-CA",{timeZone:timezone,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(date);return `${parts.find(p=>p.type==="year")?.value}-${parts.find(p=>p.type==="month")?.value}-${parts.find(p=>p.type==="day")?.value}`;}
function stableStringify(value:unknown):string{if(value===null||typeof value!=="object")return JSON.stringify(value);if(Array.isArray(value))return `[${value.map(stableStringify).join(",")}]`;const row=value as Record<string,unknown>;return `{${Object.keys(row).sort().map(key=>`${JSON.stringify(key)}:${stableStringify(row[key])}`).join(",")}}`;}
