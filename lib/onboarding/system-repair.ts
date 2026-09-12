import type { OnboardingAnswers } from "@/lib/onboarding/schema";
import type { SystemProposal } from "@/lib/onboarding/system-schema";

/**
 * Deterministic safety repair after specialist/model analysis and before schema validation.
 * It removes inferred numeric/timing commitments that the confirmed context cannot support.
 */
export function repairSystemProposal(proposal:SystemProposal,answers:OnboardingAnswers):SystemProposal{
  const next=structuredClone(proposal);
  repairHealth(next,answers);
  repairUnconfirmedTimes(next,answers);
  syncSchedules(next);
  refreshCompatibility(next,answers);
  return next;
}

export function syncSchedules(proposal:SystemProposal){
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
  proposal.workload.weeklyActionCount=proposal.actions.filter(a=>!a.deferred&&a.frequency!=="daily"&&a.frequency!=="weekdays").length;
  proposal.workload.dailyHabitCount=proposal.actions.filter(a=>!a.deferred&&a.kind==="habit"&&(a.frequency==="daily"||a.frequency==="weekdays")).length;
  proposal.workload.scheduledSessionCount=proposal.schedule.filter(s=>s.startTime&&s.days.length).reduce((sum,s)=>sum+s.days.length,0);
  proposal.workload.activeGoalCount=proposal.goals.filter(g=>!g.deferred).length;
  proposal.activationWarnings=proposal.activationWarnings.filter(value=>!value.toLowerCase().includes("schedule conflict"));
  if(proposal.schedule.some(block=>block.conflictStatus==="conflict"))proposal.activationWarnings.push("Resolve schedule conflicts before activation.");
  if(!proposal.actions.find(action=>action.clientId===proposal.today.firstMeaningfulActionClientId&&!action.deferred))proposal.today.firstMeaningfulActionClientId=proposal.actions.find(action=>!action.deferred)?.clientId??"";
  proposal.today.priorityActionClientIds=proposal.today.priorityActionClientIds.filter(id=>proposal.actions.some(action=>action.clientId===id&&!action.deferred)).slice(0,3);
  if(!proposal.today.priorityActionClientIds.length&&proposal.today.firstMeaningfulActionClientId)proposal.today.priorityActionClientIds=[proposal.today.firstMeaningfulActionClientId];
}

function upsertMissing(proposal:SystemProposal,item:SystemProposal["metadata"]["missingInformation"][number]){
  const index=proposal.metadata.missingInformation.findIndex(row=>row.key===item.key);if(index>=0)proposal.metadata.missingInformation[index]=item;else proposal.metadata.missingInformation.push(item);
  proposal.metadata.confidence=proposal.metadata.missingInformation.some(row=>row.blocksActivation)?"low":"medium";
}
