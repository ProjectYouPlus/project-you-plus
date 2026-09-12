import type { OnboardingAnswers } from "@/lib/onboarding/schema";
import type { SystemAction, SystemProposal } from "@/lib/onboarding/system-schema";

/**
 * Deterministic safety repair after specialist/model analysis and before schema validation.
 * It removes inferred numeric/timing commitments that the confirmed context cannot support,
 * and recalculates editable finance fields with application logic rather than model guesses.
 */
export function repairSystemProposal(proposal:SystemProposal,answers:OnboardingAnswers):SystemProposal{
  const next=structuredClone(proposal);
  repairHealth(next,answers);
  repairFinance(next,answers);
  repairReviewCadence(next);
  repairUnconfirmedTimes(next,answers);
  syncSchedules(next);
  refreshCompatibility(next,answers);
  return next;
}

export function syncSchedules(proposal:SystemProposal){
  proposal.schedule=proposal.schedule.filter(block=>proposal.actions.some(action=>action.clientId===block.actionClientId));
  for(const block of proposal.schedule){
    const action=proposal.actions.find(item=>item.clientId===block.actionClientId);
    if(!action)continue;
    if(action.deferred){block.days=[];block.startTime=null;block.endTime=null;block.conflictStatus="needs_confirmation";block.conflictReason="This action is deferred from the starting system.";continue;}
    block.days=[...action.preferredDays];
    if(action.preferredTime===null&&action.kind!=="workout"){block.startTime=null;block.endTime=null;if(block.conflictStatus==="clear")block.conflictStatus="needs_confirmation";}
  }
  return proposal;
}

function repairHealth(proposal:SystemProposal,answers:OnboardingAnswers){
  const healthGoals=proposal.goals.filter(goal=>goal.domain==="health"&&!goal.deferred);
  if(!healthGoals.length)return;
  const complete=Boolean(answers.health.included&&!answers.health.deferred&&answers.health.experience&&answers.health.trainingDaysPerWeek&&answers.health.workoutDurationMinutes);
  if(complete)return;
  const healthGoalIds=new Set(healthGoals.map(goal=>goal.clientId));
  proposal.actions=proposal.actions.filter(action=>!(healthGoalIds.has(action.linkedGoalClientId)&&action.kind==="workout"));
  for(const goal of healthGoals){
    if(!proposal.actions.some(action=>action.linkedGoalClientId===goal.clientId&&!action.deferred)){
      proposal.actions.push({clientId:`action-${goal.clientId}-confirm-training`,linkedGoalClientId:goal.clientId,domain:"health",kind:"task",title:"Confirm a realistic training schedule",frequency:"once",targetPerWeek:null,preferredDays:[],preferredTime:null,durationMinutes:5,trigger:null,minimumVersion:"Choose the number of training days you can actually protect this week.",recoveryRule:"If you cannot confirm a repeatable window yet, keep the goal active without inventing a workout schedule.",evidenceType:"task_completed",startingDifficulty:"minimum",firstDueDate:null,rationale:"Training frequency or duration is missing, so Project You+ will not invent a workout commitment.",deferred:false});
    }
  }
  proposal.healthPlan=null;
  upsertMissing(proposal,{key:"health_training_availability",domain:"health",label:"Confirm training frequency, duration, and experience before a recurring workout schedule is activated.",blocksActivation:false,resolution:"follow_up"});
}

function repairFinance(proposal:SystemProposal,answers:OnboardingAnswers){
  const moneyGoals=proposal.goals.filter(goal=>goal.domain==="money"&&!goal.deferred);
  const moneyGoalIds=new Set(moneyGoals.map(goal=>goal.clientId));

  // Monthly outcome checks belong to review cadence, not to a fake weekly task.
  proposal.actions=proposal.actions.filter(action=>!(moneyGoalIds.has(action.linkedGoalClientId)&&action.clientId.endsWith("-month")));

  for(const goal of moneyGoals){
    const dateKey=`finance_target_date_${goal.clientId}`;
    const currentKey=`finance_current_amount_${goal.clientId}`;
    removeMissing(proposal,dateKey);
    removeMissing(proposal,currentKey);

    const contributionId=`action-${goal.clientId}-save`;
    const existingIndex=proposal.actions.findIndex(action=>action.clientId===contributionId);
    const calc=goal.targetValue!=null?calculateSavingsPace(goal.targetValue,goal.currentValue,goal.targetDate,new Date()):null;

    if(goal.targetValue!=null&&!goal.targetDate){
      upsertMissing(proposal,{key:dateKey,domain:"money",label:"Choose a savings timeline to calculate a required contribution, or compare the editable 6, 12, and 18 month scenarios.",blocksActivation:false,resolution:"editable_target"});
    }
    if(goal.targetValue!=null&&goal.targetDate&&goal.currentValue==null){
      upsertMissing(proposal,{key:currentKey,domain:"money",label:"Confirm how much is already saved before Project You+ calculates the remaining monthly contribution.",blocksActivation:false,resolution:"editable_target"});
    }

    if(calc?.monthly!=null&&calc.weekly!=null){
      const contribution:SystemAction={clientId:contributionId,linkedGoalClientId:goal.clientId,domain:"money",kind:"recurring_action",title:`Contribute about $${formatMoney(calc.weekly)} per week toward the savings goal`,frequency:"weekly",targetPerWeek:1,preferredDays:[answers.coaching.weeklyReviewDay??0],preferredTime:null,durationMinutes:5,trigger:"Review the contribution during the weekly finance checkpoint.",minimumVersion:"Record what you can contribute this week; do not hide a shortfall.",recoveryRule:"Missing one contribution does not erase progress. Review the gap at the next Weekly Review and adjust only with your approval.",evidenceType:"manual_checkin",startingDifficulty:"standard",firstDueDate:null,rationale:`Deterministic pace: ${calc.calculation}. No transfer is initiated automatically.`,deferred:false};
      if(existingIndex>=0)proposal.actions[existingIndex]=contribution;else proposal.actions.push(contribution);
    }else if(existingIndex>=0){
      proposal.actions.splice(existingIndex,1);
    }

    const savingsMetric=goal.successMetrics.find(metric=>metric.dataSource==="finance"&&/savings/i.test(metric.name));
    if(savingsMetric){savingsMetric.baseline=goal.currentValue;savingsMetric.targetValue=goal.targetValue;savingsMetric.targetLabel=goal.targetValue!=null?`Reach $${formatMoney(goal.targetValue)}`:null;savingsMetric.needsConfirmation=goal.targetValue==null;}
    for(const milestone of goal.milestones)if(milestone.order===Math.max(...goal.milestones.map(item=>item.order)))milestone.targetDate=goal.targetDate;
  }

  const primary=moneyGoals.sort((a,b)=>a.priority-b.priority)[0];
  if(!primary){proposal.financialFocus=null;return;}
  const calc=primary.targetValue!=null?calculateSavingsPace(primary.targetValue,primary.currentValue,primary.targetDate,new Date()):null;
  const spendingAction=proposal.actions.find(action=>action.linkedGoalClientId===primary.clientId&&action.kind==="review");
  proposal.financialFocus={
    title:primary.title,
    action:spendingAction?.title??"Review the last 30 days of discretionary spending and choose a realistic weekly target.",
    goalType:answers.finance.primaryGoal??"savings",
    rationale:calc?.monthly!=null?`Contribution pace is calculated from the confirmed target, current amount, and target date: ${calc.calculation}.`:"Project You+ will not invent a deadline, current balance, or spending limit. Confirm the missing finance inputs before a contribution pace is calculated.",
    targetAmount:primary.targetValue,
    currentAmount:primary.currentValue,
    monthlyTarget:calc?.monthly??null,
    weeklyEquivalent:calc?.weekly??null,
    calculation:calc?.calculation??null,
  };
}

function repairReviewCadence(proposal:SystemProposal){
  proposal.weeklyReview.goalCheckpoints=proposal.goals.filter(goal=>!goal.deferred).map(goal=>({linkedGoalClientId:goal.clientId,frequency:goal.domain==="money"?"monthly":"weekly",label:goal.domain==="money"?"Monthly financial progress checkpoint":"Weekly goal progress checkpoint"}));
}

function repairUnconfirmedTimes(proposal:SystemProposal,answers:OnboardingAnswers){
  const wakeIsFixed=answers.life.wakeSleep.mode==="fixed"&&Boolean(answers.life.wakeSleep.wakeTime&&answers.life.wakeSleep.sleepTime);
  for(const action of proposal.actions){
    if(action.kind==="workout")continue;
    // The onboarding contract does not ask users to approve exact habit times.
    // Keep non-workout actions flexible unless an exact time came from Weekly Review itself.
    if(action.kind!=="review"&&action.preferredTime&&(action.domain==="discipline"||!wakeIsFixed))action.preferredTime=null;
  }
  for(const block of proposal.schedule){
    const action=proposal.actions.find(item=>item.clientId===block.actionClientId);
    if(!action)continue;
    if(action.kind!=="workout"&&action.preferredTime===null){block.startTime=null;block.endTime=null;block.flexibility="flexible";if(block.conflictStatus==="clear")block.conflictStatus="needs_confirmation";block.conflictReason=block.conflictReason??"No exact time was assumed from incomplete timing context.";}
  }
}

function refreshCompatibility(proposal:SystemProposal,answers:OnboardingAnswers){
  proposal.habits=proposal.actions.filter(a=>!a.deferred&&a.kind==="habit").map(a=>({clientId:a.clientId,title:a.title,frequency:a.frequency==="daily"?"daily":a.frequency==="weekly"?"weekly":"n_per_week",goalClientId:a.linkedGoalClientId,rationale:a.rationale,minimumVersion:a.minimumVersion}));
  proposal.priorities=proposal.actions.filter(a=>!a.deferred&&(a.kind==="task"||a.kind==="recurring_action"||a.kind==="review")).slice(0,3).map((a,index)=>({clientId:a.clientId,title:a.title,goalClientId:a.linkedGoalClientId,dueWindow:index===0?"today":"this_week",rationale:a.rationale}));
  const workout=proposal.actions.find(a=>!a.deferred&&a.kind==="workout");
  const healthGoal=proposal.goals.find(g=>!g.deferred&&g.domain==="health");
  if(workout&&healthGoal&&answers.health.experience&&answers.health.trainingDaysPerWeek&&answers.health.workoutDurationMinutes){
    const schedule=proposal.schedule.find(s=>s.actionClientId===workout.clientId);
    proposal.healthPlan={title:"Starting health system",goal:healthGoal.desiredOutcome,daysPerWeek:workout.targetPerWeek??workout.preferredDays.length,sessionMinutes:workout.durationMinutes,experience:answers.health.experience as "beginner"|"intermediate"|"advanced"|"returning",schedule:workout.preferredDays.map((day,index)=>({key:`session-${index+1}`,day:["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][day],dayIndex:day,title:"Training session",focus:answers.health.objective??"general health",duration:workout.durationMinutes,time:schedule?.startTime??null})),rationale:workout.rationale};
  }else proposal.healthPlan=null;
  const active=proposal.actions.filter(a=>!a.deferred);
  proposal.workload.weeklyMinutes=active.reduce((sum,a)=>sum+occurrences(a)*a.durationMinutes,0);
  proposal.workload.weeklyActionCount=active.filter(a=>a.frequency!=="daily"&&a.frequency!=="weekdays").length;
  proposal.workload.dailyHabitCount=active.filter(a=>a.kind==="habit"&&(a.frequency==="daily"||a.frequency==="weekdays")).length;
  proposal.workload.scheduledSessionCount=proposal.schedule.filter(s=>s.startTime&&s.days.length).reduce((sum,s)=>sum+s.days.length,0);
  proposal.workload.activeGoalCount=proposal.goals.filter(g=>!g.deferred).length;
  proposal.activationWarnings=proposal.activationWarnings.filter(value=>!value.toLowerCase().includes("schedule conflict"));
  if(proposal.schedule.some(block=>block.conflictStatus==="conflict"))proposal.activationWarnings.push("Resolve schedule conflicts before activation.");
  if(!proposal.actions.find(action=>action.clientId===proposal.today.firstMeaningfulActionClientId&&!action.deferred))proposal.today.firstMeaningfulActionClientId=proposal.actions.find(action=>!action.deferred)?.clientId??"";
  proposal.today.priorityActionClientIds=proposal.today.priorityActionClientIds.filter(id=>proposal.actions.some(action=>action.clientId===id&&!action.deferred)).slice(0,3);
  if(!proposal.today.priorityActionClientIds.length&&proposal.today.firstMeaningfulActionClientId)proposal.today.priorityActionClientIds=[proposal.today.firstMeaningfulActionClientId];
  proposal.today.habitActionClientIds=proposal.today.habitActionClientIds.filter(id=>proposal.actions.some(action=>action.clientId===id&&!action.deferred&&action.kind==="habit")).slice(0,3);
  proposal.schedule=proposal.schedule.filter(block=>proposal.actions.some(action=>action.clientId===block.actionClientId));
  proposal.metadata.missingInformation=dedupeMissing(proposal.metadata.missingInformation);
  proposal.metadata.confidence=proposal.metadata.missingInformation.some(row=>row.blocksActivation)?"low":proposal.metadata.missingInformation.length?"medium":"high";
}

function calculateSavingsPace(target:number,current:number|null,targetDate:string|null,now:Date){
  if(!Number.isFinite(target)||target<=0||!targetDate||current==null||!Number.isFinite(current)||current<0)return null;
  const targetMoment=new Date(`${targetDate}T12:00:00Z`);if(Number.isNaN(targetMoment.getTime()))return null;
  const start=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()));if(targetMoment<=start)return null;
  const months=Math.max(1,Math.ceil((targetMoment.getTime()-start.getTime())/86400000/30.4375));
  const remaining=Math.max(0,target-current),monthly=roundMoney(remaining/months),weekly=roundMoney(monthly*12/52);
  return {remaining,months,monthly,weekly,calculation:`$${formatMoney(remaining)} remaining ÷ ${months} month${months===1?"":"s"} = $${formatMoney(monthly)}/month`};
}

function occurrences(action:SystemAction){return action.frequency==="daily"?7:action.frequency==="weekdays"?5:action.frequency==="weekly"?1:action.frequency==="n_per_week"?(action.targetPerWeek??1):1;}
function roundMoney(value:number){return Math.round((value+Number.EPSILON)*100)/100;}
function formatMoney(value:number){return roundMoney(value).toLocaleString("en-US",{maximumFractionDigits:2});}
function removeMissing(proposal:SystemProposal,key:string){proposal.metadata.missingInformation=proposal.metadata.missingInformation.filter(item=>item.key!==key);}
function dedupeMissing(items:SystemProposal["metadata"]["missingInformation"]){return Array.from(new Map(items.map(item=>[item.key,item])).values());}
function upsertMissing(proposal:SystemProposal,item:SystemProposal["metadata"]["missingInformation"][number]){
  const index=proposal.metadata.missingInformation.findIndex(row=>row.key===item.key);if(index>=0)proposal.metadata.missingInformation[index]=item;else proposal.metadata.missingInformation.push(item);
  proposal.metadata.confidence=proposal.metadata.missingInformation.some(row=>row.blocksActivation)?"low":"medium";
}
