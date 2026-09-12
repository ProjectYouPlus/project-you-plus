"use server";

import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { buildUserContext, type UserContext } from "@/lib/ai/context";
import { runStructuredSpecialistTask } from "@/lib/ai/orchestrator";
import { createClient } from "@/lib/supabase/server";
import { sanitizeAnswers, validateStage, type OnboardingAnswers, type OnboardingStage } from "@/lib/onboarding/schema";
import { buildDeterministicSystem, contextVersionForSystem, makeSystemLighter, replaceSystemAction } from "@/lib/onboarding/system-builder";
import { revalidateSystemSchedule } from "@/lib/onboarding/system-conflicts";
import { repairSystemProposal } from "@/lib/onboarding/system-repair";
import { isSystemProposal, validateSystemProposal, type SystemProposal } from "@/lib/onboarding/system-schema";

const FUNNEL_EVENTS=new Set([
  "system_generation_started","system_generation_completed","system_generation_failed","proposal_viewed","goal_edited","action_edited",
  "plan_made_lighter","goal_deferred","proposal_approved","activation_started","activation_completed","activation_failed",
  "first_today_action_viewed","first_today_action_completed",
]);

export async function generateAutoBuiltSystem(sessionId:string){
  const supabase=await createClient();const user=await requireUser(supabase);
  const {data:session,error}=await supabase.from("onboarding_sessions").select("*").eq("id",sessionId).eq("user_id",user.id).single();
  if(error||!session)return fail("Could not load your onboarding session.");
  if(session.status==="completed"&&isSystemProposal(session.generated_plan))return {ok:true as const,proposal:session.generated_plan as SystemProposal,generationState:session.generation_state,completed:true as const};
  if(session.status==="generating"&&session.last_generation_at&&Date.now()-new Date(session.last_generation_at).getTime()<10_000)return fail("Your Project You+ system is already being built.");
  const answers=sanitizeAnswers(session.answers);const stageIssue=validateAllRequiredStages(answers);if(stageIssue)return fail(stageIssue);
  const startedAt=new Date().toISOString();const workingModules={goals:"working",habits:"working",priorities:"working",health:answers.health.included&&!answers.health.deferred?"working":"skipped",finance:answers.finance.deferred?"skipped":"working",weeklyReview:"working",workload:"working",schedule:"working"};
  await supabase.from("onboarding_sessions").update({status:"generating",current_stage:"generating",generation_state:{overall:"working",modules:workingModules},generation_attempts:Number(session.generation_attempts??0)+1,last_generation_at:startedAt,error_code:null,error_message:null,activation_state:{overall:"idle",steps:{}},updated_at:startedAt}).eq("id",sessionId).eq("user_id",user.id);
  await recordAutoBuildEventInternal(supabase,user.id,"system_generation_started",{stage:"generating"});
  const {data:runId}=await supabase.rpc("begin_onboarding_ai_operation",{p_title:"Auto-build first Project You+ system"});
  try{
    const baseContext=await buildUserContext();const snapshot=augmentContextWithOnboarding(baseContext,answers,sessionId);
    const specialistResults=await runGenerationSpecialists(snapshot,answers);
    let proposal=buildDeterministicSystem({proposalId:randomUUID(),userId:user.id,onboardingSessionId:sessionId,answers,context:snapshot,specialistNotes:specialistResults.notes});
    if(specialistResults.makeLighter)proposal=makeSystemLighter(proposal,answers);
    proposal=normalizeProposal(revalidateSystemSchedule(repairSystemProposal(proposal,answers),answers,snapshot));
    const validated=validateSystemProposal(proposal,answers);if(!validated.ok)throw new Error(`proposal_validation:${validated.issues.join(",")}`);
    proposal=validated.value;
    const modules={goals:"ready",habits:"ready",priorities:"ready",health:proposal.goals.some(g=>g.domain==="health"&&!g.deferred)?"ready":answers.health.deferred?"skipped":"not_included",finance:proposal.goals.some(g=>g.domain==="money"&&!g.deferred)?"ready":answers.finance.deferred?"skipped":"not_included",weeklyReview:"ready",workload:"ready",schedule:"ready"};
    const save={status:"awaiting_confirmation",current_stage:"review",generated_plan:proposal,original_generated_plan:proposal,generation_state:{overall:"ready",modules},proposal_version:Number(session.proposal_version??0)+1,proposal_status:"draft",source_context_version:proposal.metadata.sourceContextVersion,generator_version:proposal.metadata.generatorVersion,proposal_confidence:proposal.metadata.confidence,missing_information:proposal.metadata.missingInformation,validation_results:{ok:true,warnings:validated.warnings},error_code:null,error_message:null,last_saved_at:new Date().toISOString(),updated_at:new Date().toISOString()};
    const {error:saveError}=await supabase.from("onboarding_sessions").update(save).eq("id",sessionId).eq("user_id",user.id);if(saveError)throw new Error("proposal_save_failed");
    await finishAiRun(supabase,runId,"passed",{surface:"onboarding_auto_build",specialistsCompleted:specialistResults.completed,usedDeterministicBuilder:true,proposalVersion:Number(session.proposal_version??0)+1,goalCount:proposal.goals.filter(g=>!g.deferred).length,actionCount:proposal.actions.filter(a=>!a.deferred).length,missingInformationCount:proposal.metadata.missingInformation.length});
    await recordAutoBuildEventInternal(supabase,user.id,"system_generation_completed",{stage:"review",completion_status:"validated",goal_count:proposal.goals.filter(g=>!g.deferred).length,action_count:proposal.actions.filter(a=>!a.deferred).length});
    return {ok:true as const,proposal,generationState:{overall:"ready",modules},usedFallback:specialistResults.completed===0};
  }catch(error){
    const category=errorCategory(error);const message="Project You+ could not finish a valid starting system. Your answers are safe; retry when ready.";
    await supabase.from("onboarding_sessions").update({status:"failed",generation_state:{overall:"failed",modules:workingModules},proposal_status:"failed",error_code:category,error_message:message,updated_at:new Date().toISOString()}).eq("id",sessionId).eq("user_id",user.id);
    await finishAiRun(supabase,runId,"failed",{surface:"onboarding_auto_build",errorCategory:category});
    await recordAutoBuildEventInternal(supabase,user.id,"system_generation_failed",{stage:"generating",error_category:category});
    return fail(message);
  }
}

export async function saveAutoBuiltProposal(input:{sessionId:string;proposal:unknown;event?:"goal_edited"|"action_edited"}){
  const result=await prepareEditableProposal(input.sessionId,input.proposal);if(!result.ok)return result;
  const {supabase,user,session,proposal,validated}=result;
  const {error}=await supabase.from("onboarding_sessions").update({generated_plan:proposal,proposal_status:"edited",status:"awaiting_confirmation",current_stage:"review",proposal_confidence:proposal.metadata.confidence,missing_information:proposal.metadata.missingInformation,validation_results:{ok:true,warnings:validated.warnings},last_saved_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",session.id).eq("user_id",user.id);
  if(error)return fail("Could not save your plan changes.");
  if(input.event)await recordAutoBuildEventInternal(supabase,user.id,input.event,{stage:"review"});
  return {ok:true as const,proposal};
}

export async function makeAutoBuiltSystemLighter(sessionId:string){
  const loaded=await loadEditableSystem(sessionId);if(!loaded.ok)return loaded;
  let proposal=makeSystemLighter(loaded.proposal,loaded.answers);proposal=normalizeProposal(revalidateSystemSchedule(repairSystemProposal(proposal,loaded.answers),loaded.answers,loaded.context));
  const validated=validateSystemProposal(proposal,loaded.answers);if(!validated.ok)return fail(validated.error);
  const {error}=await loaded.supabase.from("onboarding_sessions").update({generated_plan:validated.value,proposal_status:"edited",proposal_confidence:validated.value.metadata.confidence,validation_results:{ok:true,warnings:validated.warnings},last_saved_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",sessionId).eq("user_id",loaded.user.id);
  if(error)return fail("Could not make the plan lighter.");
  await recordAutoBuildEventInternal(loaded.supabase,loaded.user.id,"plan_made_lighter",{stage:"review",active_goal_count:validated.value.goals.filter(g=>!g.deferred).length,action_count:validated.value.actions.filter(a=>!a.deferred).length});
  return {ok:true as const,proposal:validated.value};
}

export async function replaceAutoBuiltAction(input:{sessionId:string;actionId:string}){
  const loaded=await loadEditableSystem(input.sessionId);if(!loaded.ok)return loaded;
  let proposal=replaceSystemAction(loaded.proposal,input.actionId,loaded.answers);proposal=normalizeProposal(revalidateSystemSchedule(repairSystemProposal(proposal,loaded.answers),loaded.answers,loaded.context));
  const validated=validateSystemProposal(proposal,loaded.answers);if(!validated.ok)return fail(validated.error);
  const {error}=await loaded.supabase.from("onboarding_sessions").update({generated_plan:validated.value,proposal_status:"edited",validation_results:{ok:true,warnings:validated.warnings},last_saved_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",input.sessionId).eq("user_id",loaded.user.id);
  if(error)return fail("Could not replace that action.");
  await recordAutoBuildEventInternal(loaded.supabase,loaded.user.id,"action_edited",{stage:"review",change_type:"replace"});
  return {ok:true as const,proposal:validated.value};
}

export async function deferAutoBuiltGoal(input:{sessionId:string;goalId:string}){
  const loaded=await loadEditableSystem(input.sessionId);if(!loaded.ok)return loaded;
  const proposal=structuredClone(loaded.proposal);const goal=proposal.goals.find(item=>item.clientId===input.goalId);if(!goal)return fail("That goal is no longer in this proposal.");
  if(proposal.goals.filter(item=>!item.deferred&&item.clientId!==input.goalId).length<1)return fail("Keep at least one active goal in your starting system.");
  goal.deferred=true;for(const action of proposal.actions)if(action.linkedGoalClientId===goal.clientId)action.deferred=true;
  proposal.schedule=proposal.schedule.filter(block=>block.linkedGoalClientId!==goal.clientId);proposal.workload.activeGoalCount=proposal.goals.filter(item=>!item.deferred).length;proposal.workload.phased=true;proposal.workload.phaseLabel="Week 1 · focused start";proposal.workload.reductions.push(`Deferred ${goal.title} from the starting week.`);recalculateWorkload(proposal);repairToday(proposal);
  const validated=validateSystemProposal(proposal,loaded.answers);if(!validated.ok)return fail(validated.error);
  const {error}=await loaded.supabase.from("onboarding_sessions").update({generated_plan:validated.value,proposal_status:"edited",validation_results:{ok:true,warnings:validated.warnings},last_saved_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",input.sessionId).eq("user_id",loaded.user.id);if(error)return fail("Could not defer that goal.");
  await recordAutoBuildEventInternal(loaded.supabase,loaded.user.id,"goal_deferred",{stage:"review",active_goal_count:proposal.workload.activeGoalCount});
  return {ok:true as const,proposal:validated.value};
}

export async function restoreOriginalAutoBuiltSystem(sessionId:string){
  const supabase=await createClient();const user=await requireUser(supabase);const {data:session,error}=await supabase.from("onboarding_sessions").select("id,user_id,answers,original_generated_plan,source_context_version").eq("id",sessionId).eq("user_id",user.id).single();if(error||!session||!isSystemProposal(session.original_generated_plan))return fail("The original recommendation is not available.");
  const answers=sanitizeAnswers(session.answers),context=await buildUserContext();if(contextVersionForSystem(answers,context)!==session.source_context_version)return staleResult(supabase,sessionId,user.id);
  let proposal=normalizeProposal(revalidateSystemSchedule(repairSystemProposal(session.original_generated_plan as SystemProposal,answers),answers,context));const validated=validateSystemProposal(proposal,answers);if(!validated.ok)return fail(validated.error);proposal=validated.value;
  const {error:saveError}=await supabase.from("onboarding_sessions").update({generated_plan:proposal,proposal_status:"draft",validation_results:{ok:true,warnings:validated.warnings},last_saved_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",sessionId).eq("user_id",user.id);if(saveError)return fail("Could not restore the original recommendation.");return {ok:true as const,proposal};
}

export async function approveAndActivateAutoBuiltSystem(input:{sessionId:string;proposal:unknown}){
  const prepared=await prepareEditableProposal(input.sessionId,input.proposal);if(!prepared.ok)return prepared;
  const {supabase,user,session,proposal,validated}=prepared;
  if(proposal.schedule.some(block=>block.conflictStatus==="conflict"))return fail("Resolve the remaining schedule conflict before activation.");
  if(proposal.metadata.missingInformation.some(item=>item.blocksActivation))return fail("One required detail still needs confirmation before activation.");
  const now=new Date().toISOString();
  const {error:approveError}=await supabase.from("onboarding_sessions").update({generated_plan:proposal,proposal_status:"approved",approved_at:now,last_confirmation_at:now,status:"awaiting_confirmation",activation_state:{overall:"approved",steps:{goals:"pending",habits:"pending",schedule:"pending",metrics:"pending",weeklyReview:"pending",today:"pending"}},validation_results:{ok:true,warnings:validated.warnings},updated_at:now,last_saved_at:now}).eq("id",session.id).eq("user_id",user.id);if(approveError)return fail("Could not approve this system. Nothing was activated.");
  await recordAutoBuildEventInternal(supabase,user.id,"proposal_approved",{stage:"review",active_goal_count:proposal.goals.filter(g=>!g.deferred).length});
  await recordAutoBuildEventInternal(supabase,user.id,"activation_started",{stage:"activation"});
  const {data,error}=await supabase.rpc("activate_onboarding_system_v3",{p_session_id:session.id});
  if(error){const category="activation_transaction";await supabase.from("onboarding_sessions").update({status:"awaiting_confirmation",proposal_status:"approved",activation_state:{overall:"failed",steps:{}},error_code:category,error_message:"Activation did not complete. Your approved proposal is safe and can be retried.",updated_at:new Date().toISOString()}).eq("id",session.id).eq("user_id",user.id);await recordAutoBuildEventInternal(supabase,user.id,"activation_failed",{stage:"activation",error_category:category});return fail("Activation did not complete. Your approved proposal is safe; retry without repeating onboarding.");}
  try{
    const [context,review]=await Promise.all([buildUserContext(),supabase.from("weekly_review_settings").select("day_of_week,time_of_day").eq("user_id",user.id).eq("active",true).maybeSingle()]);
    const activeGoals=context.goals.filter(goal=>goal.status==="active"),openTasks=context.tasks.filter(task=>!task.completedAt);if(!activeGoals.length||!openTasks.length||!review.data)throw new Error("completion_gate");
    await recordAutoBuildEventInternal(supabase,user.id,"activation_completed",{stage:"trajectory",completion_status:"completed",active_goal_count:activeGoals.length});
    revalidatePath("/today");revalidatePath("/plan");revalidatePath("/coach");revalidatePath("/you");revalidatePath("/progress");revalidatePath("/goals");revalidatePath("/habits");revalidatePath("/calendar");
    return {ok:true as const,records:data,steps:(data as any)?.steps??{},contextRefreshed:true,summary:{activeGoals:activeGoals.length,openActions:openTasks.length,weeklyReviewDay:review.data.day_of_week,weeklyReviewTime:String(review.data.time_of_day).slice(0,5)}};
  }catch{
    await recordAutoBuildEventInternal(supabase,user.id,"activation_failed",{stage:"activation",error_category:"context_refresh"});
    return fail("Your records were created, but Project You+ could not refresh the live context yet. Retry activation to recover safely; nothing will be duplicated.");
  }
}

export async function recordAutoBuildEvent(event:string,metadata:Record<string,unknown>={}){if(!FUNNEL_EVENTS.has(event))return;const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)return;await recordAutoBuildEventInternal(supabase,user.id,event,metadata);}

async function prepareEditableProposal(sessionId:string,value:unknown){
  const supabase=await createClient();const user=await requireUser(supabase);const {data:session,error}=await supabase.from("onboarding_sessions").select("id,user_id,status,answers,source_context_version").eq("id",sessionId).eq("user_id",user.id).single();if(error||!session)return fail("Could not load your onboarding session.");
  if(!isSystemProposal(value))return fail("This proposal is incomplete. Regenerate it safely.");const answers=sanitizeAnswers(session.answers),context=await buildUserContext();const currentVersion=contextVersionForSystem(answers,context);if(value.metadata.sourceContextVersion!==currentVersion||session.source_context_version!==currentVersion)return staleResult(supabase,sessionId,user.id);
  let proposal=normalizeProposal(revalidateSystemSchedule(repairSystemProposal(value,answers),answers,context));if(proposal.metadata.userId!==user.id||proposal.metadata.onboardingSessionId!==sessionId)return fail("Proposal ownership could not be verified.");
  const validated=validateSystemProposal(proposal,answers);if(!validated.ok)return fail(`${validated.error} ${validated.issues.slice(0,3).join(", ")}`);proposal=validated.value;return {ok:true as const,supabase,user,session,answers,context,proposal,validated};
}

async function loadEditableSystem(sessionId:string){const supabase=await createClient();const user=await requireUser(supabase);const {data:session,error}=await supabase.from("onboarding_sessions").select("id,user_id,answers,generated_plan,source_context_version").eq("id",sessionId).eq("user_id",user.id).single();if(error||!session||!isSystemProposal(session.generated_plan))return fail("Generate your starting system first.");const answers=sanitizeAnswers(session.answers),context=await buildUserContext();if(contextVersionForSystem(answers,context)!==session.source_context_version)return staleResult(supabase,sessionId,user.id);return {ok:true as const,supabase,user,session,answers,context,proposal:session.generated_plan as SystemProposal};}

async function runGenerationSpecialists(context:UserContext,answers:OnboardingAnswers){
  const common="Assess the confirmed onboarding draft against the shared context. Do not invent numeric targets, dates, diagnoses, commitments, or transactions. Return only the requested JSON. You are advisory; deterministic application logic owns arithmetic and scheduling.";
  const jobs=[
    runStructuredSpecialistTask({specialist:"planner",context,request:`${common} Identify workload/schedule risk and whether the starting week should be minimum or standard.`,schema:'{"risk":"low|medium|high","phase":"minimum|standard","notes":["short non-sensitive reason"]}',maxTokens:400}),
    ...(answers.health.included&&!answers.health.deferred?[runStructuredSpecialistTask({specialist:"health",context,request:`${common} Check whether the proposed health direction can be safely organized from existing context and identify missing inputs only.`,schema:'{"ready":true,"missing":["input key"],"notes":["short non-medical reason"]}',maxTokens:400})]:[]),
    ...(!answers.finance.deferred?[runStructuredSpecialistTask({specialist:"finance",context,request:`${common} Check whether financial calculations have enough confirmed inputs. Do not calculate amounts.`,schema:'{"ready":true,"missing":["input key"],"notes":["short educational reason"]}',maxTokens:400})]:[]),
    runStructuredSpecialistTask({specialist:"progress",context,request:`${common} Evaluate combined starting workload and existing commitments. Recommend a lighter first week only when evidence supports it.`,schema:'{"makeLighter":false,"reason":"short non-sensitive reason"}',maxTokens:400}),
  ];
  const settled=await Promise.allSettled(jobs);const notes:Record<string,unknown>={};let makeLighter=false,completed=0;for(const row of settled){if(row.status!=="fulfilled")continue;completed++;const parsed=parseJsonSafe(row.value.text);if(parsed&&typeof parsed==="object"){const key=`specialist_${completed}`;notes[key]=parsed;if((parsed as any).makeLighter===true)makeLighter=true;}}
  return {notes,makeLighter,completed};
}

function augmentContextWithOnboarding(context:UserContext,answers:OnboardingAnswers,sessionId:string):UserContext{
  const next=structuredClone(context) as UserContext;const draft={sessionId,selectedDomains:answers.direction.domains,primaryDomain:answers.direction.primaryDomain,friction:answers.friction,goals:answers.goals,life:answers.life,health:answers.health,finance:answers.finance,coaching:answers.coaching};
  next.profile={...next.profile,blueprint:{...(next.profile.blueprint??{}),onboarding:{...((next.profile.blueprint as any)?.onboarding??{}),draft} as any}};
  if(next.domains.profile.data)next.domains.profile.data={...next.domains.profile.data,blueprint:next.profile.blueprint};
  const inject=(domain:any,data:unknown)=>{if(domain?.data)domain.data={...domain.data,onboardingDraft:data};else if(domain)domain.data={onboardingDraft:data};};
  inject((next.domains as any).health,{health:answers.health,friction:answers.friction.categories});inject((next.domains as any).finance,{finance:answers.finance,goals:answers.goals.filter(g=>g.domain==="money"),friction:answers.friction.categories});inject((next.domains as any).progression,{goals:answers.goals,friction:answers.friction.categories,coaching:answers.coaching});inject((next.domains as any).workSchedule,{life:answers.life});return next;
}

function normalizeProposal(proposal:SystemProposal){proposal.schedule=proposal.schedule.filter(block=>proposal.actions.some(action=>action.clientId===block.actionClientId));recalculateWorkload(proposal);repairToday(proposal);return proposal;}
function recalculateWorkload(proposal:SystemProposal){const active=proposal.actions.filter(action=>!action.deferred);proposal.workload.weeklyMinutes=active.reduce((sum,action)=>{const n=action.frequency==="daily"?7:action.frequency==="weekdays"?5:action.frequency==="weekly"?1:action.frequency==="n_per_week"?(action.targetPerWeek??1):1;return sum+n*action.durationMinutes;},0);proposal.workload.dailyHabitCount=active.filter(action=>action.kind==="habit"&&(action.frequency==="daily"||action.frequency==="weekdays")).length;proposal.workload.weeklyActionCount=active.filter(action=>action.frequency!=="daily"&&action.frequency!=="weekdays").length;proposal.workload.activeGoalCount=proposal.goals.filter(goal=>!goal.deferred).length;proposal.workload.scheduledSessionCount=proposal.schedule.filter(block=>block.startTime&&block.conflictStatus==="clear").reduce((sum,block)=>sum+block.days.length,0);return proposal;}
function repairToday(proposal:SystemProposal){const active=new Set(proposal.actions.filter(action=>!action.deferred).map(action=>action.clientId));proposal.today.priorityActionClientIds=proposal.today.priorityActionClientIds.filter(id=>active.has(id)).slice(0,3);proposal.today.habitActionClientIds=proposal.today.habitActionClientIds.filter(id=>active.has(id)).slice(0,3);if(!active.has(proposal.today.firstMeaningfulActionClientId))proposal.today.firstMeaningfulActionClientId=proposal.actions.find(action=>!action.deferred)?.clientId??"";if(!proposal.today.priorityActionClientIds.length&&proposal.today.firstMeaningfulActionClientId)proposal.today.priorityActionClientIds=[proposal.today.firstMeaningfulActionClientId];return proposal;}
function validateAllRequiredStages(answers:OnboardingAnswers){for(const stage of ["direction","friction","goals","life","health","finance","coaching"] as OnboardingStage[]){const issue=validateStage(stage,answers);if(issue)return issue;}return null;}
async function staleResult(supabase:any,sessionId:string,userId:string){await supabase.from("onboarding_sessions").update({proposal_status:"stale",error_code:"context_changed",error_message:"Your life context changed after this proposal was built. Regenerate so Project You+ does not activate an outdated plan.",updated_at:new Date().toISOString()}).eq("id",sessionId).eq("user_id",userId);return fail("Your schedule or context changed after this plan was built. Regenerate the proposal before approving it.");}
async function recordAutoBuildEventInternal(supabase:any,userId:string,event:string,metadata:Record<string,unknown>){if(!FUNNEL_EVENTS.has(event))return;const h=await headers();const ua=h.get("user-agent")??"";const device=/iPhone|Android.*Mobile|Mobile/i.test(ua)?"mobile":/iPad|Tablet/i.test(ua)?"tablet":"desktop";const safe={stage:safeString(metadata.stage,40),completion_status:safeString(metadata.completion_status,40),error_category:safeString(metadata.error_category,60),change_type:safeString(metadata.change_type,40),goal_count:safeNumber(metadata.goal_count),active_goal_count:safeNumber(metadata.active_goal_count),action_count:safeNumber(metadata.action_count),device_class:device,generator_version:"2026-09-auto-build-v3"};await supabase.from("activity_events").insert({user_id:userId,event_name:event,path:event.startsWith("first_today")?"/today":"/onboarding",metadata:Object.fromEntries(Object.entries(safe).filter(([,value])=>value!==null&&value!==""))});}
async function finishAiRun(supabase:any,runId:any,status:"passed"|"failed",metadata:Record<string,unknown>){if(!runId)return;await supabase.rpc("finish_onboarding_ai_operation",{p_run_id:runId,p_status:status,p_summary:status==="passed"?"Auto-built onboarding system generated and validated.":"Auto-built onboarding system generation failed.",p_metadata:metadata});}
async function requireUser(supabase:any){const {data:{user}}=await supabase.auth.getUser();if(!user)throw new Error("Sign in to continue.");return user;}
function parseJsonSafe(text:string){try{const trimmed=text.trim();return JSON.parse(trimmed.startsWith("{")?trimmed:trimmed.slice(trimmed.indexOf("{"),trimmed.lastIndexOf("}")+1));}catch{return null;}}
function safeString(value:unknown,max:number){return typeof value==="string"?value.slice(0,max):null;}function safeNumber(value:unknown){const n=Number(value);return Number.isFinite(n)?Math.max(0,Math.round(n)):null;}
function errorCategory(error:unknown){const message=error instanceof Error?error.message:"unknown";if(/timeout/i.test(message))return"provider_timeout";if(/proposal_validation/i.test(message))return"proposal_validation";if(/save/i.test(message))return"proposal_save";return"generation_error";}
function fail(error:string){return {ok:false as const,error};}
