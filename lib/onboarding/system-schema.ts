import type { DirectionDomain, OnboardingAnswers } from "@/lib/onboarding/schema";

export const SYSTEM_GENERATOR_VERSION = "2026-09-auto-build-v3";

export type SystemProposalStatus = "generating"|"draft"|"awaiting_confirmation"|"approved"|"activating"|"active"|"failed"|"superseded";
export type ProposalConfidence = "low"|"medium"|"high";
export type ConflictStatus = "clear"|"needs_confirmation"|"conflict";
export type ActionFrequency = "once"|"daily"|"weekdays"|"weekly"|"n_per_week";
export type EvidenceType = "task_completed"|"habit_logged"|"workout_logged"|"metric_recorded"|"financial_review_completed"|"weekly_review_completed"|"manual_checkin";

export type MissingInformationIndicator = { key:string; domain:DirectionDomain|"system"; label:string; blocksActivation:boolean; resolution:"follow_up"|"editable_target"|"defer" };
export type SystemSuccessMetric = { id:string; name:string; unit:string; direction:"increase"|"decrease"|"maintain"|"complete"; type:"outcome"|"leading"; entryFrequency:"daily"|"weekly"|"monthly"|"event"; dataSource:"manual"|"task"|"habit"|"workout"|"health_metric"|"finance"|"weekly_review"; baseline:number|null; targetValue:number|null; targetLabel:string|null; needsConfirmation:boolean };
export type SystemMilestone = { id:string; title:string; targetValue:number|null; unit:string|null; targetDate:string|null; order:number };
export type SystemGoal = { clientId:string; sourceGoalClientId:string; sourceOnboardingGoal:string; domain:DirectionDomain; title:string; desiredOutcome:string; measurableTarget:string|null; targetValue:number|null; targetUnit:string|null; targetDate:string|null; currentValue:number|null; priority:number; successMetrics:SystemSuccessMetric[]; milestones:SystemMilestone[]; rationale:string; frictionResponse:string; deferred:boolean };
export type SystemAction = { clientId:string; linkedGoalClientId:string; domain:DirectionDomain; kind:"habit"|"recurring_action"|"task"|"workout"|"review"; title:string; frequency:ActionFrequency; targetPerWeek:number|null; preferredDays:number[]; preferredTime:string|null; durationMinutes:number; trigger:string|null; minimumVersion:string|null; recoveryRule:string|null; evidenceType:EvidenceType; startingDifficulty:"minimum"|"easy"|"standard"; firstDueDate:string|null; rationale:string; deferred:boolean };
export type SystemScheduleBlock = { clientId:string; actionClientId:string; linkedGoalClientId:string; recurrence:"once"|"weekly"; date:string|null; days:number[]; startTime:string|null; endTime:string|null; timezone:string; flexibility:"fixed"|"flexible"; conflictStatus:ConflictStatus; conflictReason:string|null };
export type SystemMetricDefinition = SystemSuccessMetric & { linkedGoalClientId:string };
export type SystemReview = { day:number; time:string; reminderIntent:boolean; rationale:string; goalCheckpointFrequency:"weekly"|"monthly"; healthCheckIn:boolean; financeCheckIn:boolean; questions:string[] };
export type TodayInitialization = { firstMeaningfulActionClientId:string; priorityActionClientIds:string[]; habitActionClientIds:string[]; coachOpeningMessage:string };
export type SystemWorkload = { weeklyMinutes:number; dailyHabitCount:number; weeklyActionCount:number; scheduledSessionCount:number; activeGoalCount:number; phased:boolean; phaseLabel:string; bufferPreserved:boolean; reductions:string[] };
export type SystemProposalMetadata = { proposalId:string; userId:string; onboardingSessionId:string; sourceContextVersion:string; generatorVersion:string; createdAt:string; status:SystemProposalStatus; confidence:ProposalConfidence; missingInformation:MissingInformationIndicator[]; validationVersion:string };

/** Rich production proposal plus compatibility fields consumed by the current onboarding surface. */
export type SystemProposal = {
  metadata:SystemProposalMetadata; goals:SystemGoal[]; actions:SystemAction[]; schedule:SystemScheduleBlock[]; metrics:SystemMetricDefinition[];
  weeklyReview:SystemReview; today:TodayInitialization; workload:SystemWorkload; frictionSummary:string; activationWarnings:string[];
  generationVersion:string; generatedAt:string; status:"draft";
  habits:Array<{clientId:string;title:string;frequency:"daily"|"weekly"|"n_per_week";goalClientId?:string|null;rationale:string;minimumVersion?:string|null}>;
  priorities:Array<{clientId:string;title:string;goalClientId?:string|null;dueWindow:"today"|"this_week";rationale:string}>;
  healthPlan:null|{title:string;goal:string;daysPerWeek:number;sessionMinutes:number;experience:string;schedule:Array<{key:string;day:string;dayIndex:number;title:string;focus?:string;duration:number;time?:string|null}>;rationale:string};
  financialFocus:null|{title:string;action:string;goalType:string;rationale:string;targetAmount?:number|null;currentAmount?:number|null;monthlyTarget?:number|null;weeklyEquivalent?:number|null;calculation?:string|null};
};

export type ValidationResult = {ok:true;value:SystemProposal;warnings:string[]}|{ok:false;error:string;issues:string[]};

export function isSystemProposal(value:unknown):value is SystemProposal { const root=value as Partial<SystemProposal>|null; return Boolean(root&&typeof root==="object"&&root.metadata&&Array.isArray(root.goals)&&Array.isArray(root.actions)&&Array.isArray(root.metrics)&&root.weeklyReview&&root.today&&root.workload); }

export function validateSystemProposal(value:unknown,answers?:OnboardingAnswers):ValidationResult{
  if(!isSystemProposal(value))return {ok:false,error:"The generated system is incomplete.",issues:["proposal_shape"]};
  const proposal=structuredClone(value);const issues:string[]=[];const warnings:string[]=[];
  if(!proposal.metadata.proposalId||!proposal.metadata.userId||!proposal.metadata.onboardingSessionId)issues.push("proposal_metadata");
  if(!proposal.metadata.sourceContextVersion||proposal.metadata.generatorVersion!==SYSTEM_GENERATOR_VERSION)issues.push("context_version");
  if(proposal.goals.length<1||proposal.goals.length>3)issues.push("goal_count");
  const activeGoals=proposal.goals.filter(goal=>!goal.deferred);if(!activeGoals.length)issues.push("no_active_goal");
  const goalIds=new Set(proposal.goals.map(goal=>goal.clientId));if(goalIds.size!==proposal.goals.length)issues.push("duplicate_goal_client_id");
  for(const goal of activeGoals){
    if(!goal.title.trim()||!goal.desiredOutcome.trim())issues.push(`goal:${goal.clientId}:required`);
    const linked=proposal.actions.filter(action=>action.linkedGoalClientId===goal.clientId&&!action.deferred);if(!linked.length)issues.push(`goal:${goal.clientId}:no_action`);
    if(!goal.successMetrics.length)issues.push(`goal:${goal.clientId}:no_metric`);
    if(goal.milestones.length>4)issues.push(`goal:${goal.clientId}:milestones`);
    for(const milestone of goal.milestones){
      if(!milestone.id||!milestone.title.trim()||!Number.isInteger(milestone.order)||milestone.order<1||milestone.order>20)issues.push(`goal:${goal.clientId}:milestone_shape`);
      if(milestone.targetValue!=null&&!Number.isFinite(milestone.targetValue))issues.push(`goal:${goal.clientId}:milestone_target`);
      if(milestone.targetDate&&!/^\d{4}-\d{2}-\d{2}$/.test(milestone.targetDate))issues.push(`goal:${goal.clientId}:milestone_date`);
    }
  }
  const actionIds=new Set(proposal.actions.map(action=>action.clientId));if(actionIds.size!==proposal.actions.length)issues.push("duplicate_action_client_id");
  const dailyHabits=proposal.actions.filter(action=>!action.deferred&&action.kind==="habit"&&(action.frequency==="daily"||action.frequency==="weekdays"));if(dailyHabits.length>3)issues.push("daily_habit_limit");
  for(const action of proposal.actions){if(!goalIds.has(action.linkedGoalClientId))issues.push(`action:${action.clientId}:goal`);if(!Number.isFinite(action.durationMinutes)||action.durationMinutes<0||action.durationMinutes>240)issues.push(`action:${action.clientId}:duration`);if(action.targetPerWeek!=null&&(!Number.isInteger(action.targetPerWeek)||action.targetPerWeek<1||action.targetPerWeek>7))issues.push(`action:${action.clientId}:frequency`);if(action.preferredDays.some(day=>!Number.isInteger(day)||day<0||day>6))issues.push(`action:${action.clientId}:days`);}
  for(const block of proposal.schedule){if(!actionIds.has(block.actionClientId))issues.push(`schedule:${block.clientId}:action`);if(block.conflictStatus==="conflict")warnings.push(`schedule_conflict:${block.clientId}`);if(block.startTime&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(block.startTime))issues.push(`schedule:${block.clientId}:start`);if(block.endTime&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(block.endTime))issues.push(`schedule:${block.clientId}:end`);}
  for(const metric of proposal.metrics){if(!goalIds.has(metric.linkedGoalClientId))issues.push("metric_goal_link");if(!metric.id||!metric.name.trim()||!metric.unit.trim())issues.push(`metric:${metric.id||"unknown"}:required`);if(metric.baseline!=null&&!Number.isFinite(metric.baseline))issues.push(`metric:${metric.id}:baseline`);if(metric.targetValue!=null&&!Number.isFinite(metric.targetValue))issues.push(`metric:${metric.id}:target`);}
  if(proposal.weeklyReview.day<0||proposal.weeklyReview.day>6||!/^([01]\d|2[0-3]):[0-5]\d$/.test(proposal.weeklyReview.time))issues.push("weekly_review");
  if(!actionIds.has(proposal.today.firstMeaningfulActionClientId))issues.push("today_first_action");if(proposal.today.priorityActionClientIds.length>3)issues.push("today_priority_limit");if(proposal.today.priorityActionClientIds.some(id=>!actionIds.has(id)))issues.push("today_priority_reference");
  if(proposal.workload.activeGoalCount!==activeGoals.length)issues.push("workload_goal_count");if(proposal.workload.dailyHabitCount>3)issues.push("workload_habit_count");if(!Number.isFinite(proposal.workload.weeklyMinutes)||proposal.workload.weeklyMinutes<0||proposal.workload.weeklyMinutes>7*24*60)issues.push("workload_minutes");
  if(answers){
    if(activeGoals.length>Math.min(3,answers.goals.length))issues.push("goal_source_count");
    if(proposal.healthPlan&&answers.health.trainingDaysPerWeek!=null&&proposal.healthPlan.daysPerWeek>answers.health.trainingDaysPerWeek)issues.push("health_frequency_exceeds_availability");
    if(proposal.healthPlan&&answers.health.workoutDurationMinutes!=null&&proposal.healthPlan.sessionMinutes>answers.health.workoutDurationMinutes)issues.push("health_duration_exceeds_preference");
    for(const goal of proposal.goals){const source=answers.goals.find(item=>item.clientId===goal.sourceGoalClientId);if(!source)issues.push(`goal:${goal.clientId}:missing_source`);if(goal.targetDate&&!source?.targetDate&&goal.domain!=="money")warnings.push(`unconfirmed_date:${goal.clientId}`);}
  }
  const blockingMissing=proposal.metadata.missingInformation.filter(item=>item.blocksActivation);if(blockingMissing.length)warnings.push(...blockingMissing.map(item=>`missing:${item.key}`));
  return issues.length?{ok:false,error:"The generated system did not pass validation.",issues:Array.from(new Set(issues))}:{ok:true,value:proposal,warnings:Array.from(new Set(warnings))};
}
