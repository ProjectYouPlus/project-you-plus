"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { callProjectYouAI } from "@/lib/ai/provider";
import {
  buildFallbackGoalDrafts,
  buildFallbackProposal,
  COACH_STYLES,
  DIRECTION_DOMAINS,
  EMPTY_ANSWERS,
  FINANCE_GOALS,
  ONBOARDING_VERSION,
  sanitizeAnswers,
  validateProposal,
  validateStage,
  type GoalDraft,
  type OnboardingAnswers,
  type OnboardingProposal,
  type OnboardingStage,
} from "@/lib/onboarding/schema";

export type OnboardingSessionView = {
  id:string;
  mode:"initial"|"personalize";
  status:"not_started"|"in_progress"|"generating"|"awaiting_confirmation"|"completed"|"failed";
  currentStage:OnboardingStage;
  lastCompletedStage:string|null;
  answers:OnboardingAnswers;
  generatedPlan:OnboardingProposal|null;
  generationState:{overall:string;modules:Record<string,string>};
  proposalVersion:number;
  proposalStatus:string;
  errorMessage:string|null;
  startedAt:string;
  lastSavedAt:string;
};

const SAFE_EVENTS = new Set([
  "onboarding_started","stage_viewed","stage_completed","stage_abandoned","session_resumed",
  "plan_generation_started","plan_generation_succeeded","plan_generation_failed","plan_confirmed",
  "onboarding_completed","first_dashboard_viewed","first_action_completed",
]);

export async function getOrCreateOnboardingSession(mode:"initial"|"personalize"="initial"):Promise<OnboardingSessionView> {
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)throw new Error("Sign in to continue.");

  await supabase.from("profiles").upsert({id:user.id,full_name:String(user.user_metadata?.full_name??"").trim()||null},{onConflict:"id",ignoreDuplicates:true});

  const {data:active,error}=await supabase.from("onboarding_sessions").select("*")
    .eq("user_id",user.id).eq("onboarding_version",ONBOARDING_VERSION)
    .in("status",["not_started","in_progress","generating","awaiting_confirmation","failed"])
    .order("updated_at",{ascending:false}).limit(1).maybeSingle();
  if(error)throw new Error("Could not load onboarding progress.");

  if(active){
    if(active.status==="generating"&&active.last_generation_at&&Date.now()-new Date(active.last_generation_at).getTime()>180_000){
      await supabase.from("onboarding_sessions").update({status:"failed",error_code:"generation_interrupted",error_message:"Generation was interrupted. Your answers are safe; retry when ready.",updated_at:new Date().toISOString()}).eq("id",active.id);
      active.status="failed";active.error_message="Generation was interrupted. Your answers are safe; retry when ready.";
    }
    return mapSession(active);
  }

  const prefill=mode==="personalize"?await buildPrefill(supabase,user.id):EMPTY_ANSWERS;
  const {data:created,error:createError}=await supabase.from("onboarding_sessions").insert({
    user_id:user.id,onboarding_version:ONBOARDING_VERSION,mode,status:"not_started",current_stage:"intro",answers:prefill,
  }).select("*").single();
  if(createError||!created)throw new Error("Could not start onboarding.");
  return mapSession(created);
}

export async function saveOnboardingProgress(input:{sessionId:string;stage:OnboardingStage;answers:unknown;lastCompletedStage?:OnboardingStage|null}) {
  const supabase=await createClient();const user=await requireUser(supabase);const answers=sanitizeAnswers(input.answers);
  const {data:session,error:readError}=await supabase.from("onboarding_sessions").select("id,user_id,status,answers,proposal_status").eq("id",input.sessionId).eq("user_id",user.id).single();
  if(readError||!session)return {ok:false as const,error:"Could not load your onboarding session."};
  if(session.status==="completed")return {ok:true as const,completed:true as const};
  const changed=JSON.stringify(sanitizeAnswers(session.answers))!==JSON.stringify(answers);
  const patch:Record<string,unknown>={answers,current_stage:input.stage,status:"in_progress",last_saved_at:new Date().toISOString(),updated_at:new Date().toISOString(),error_code:null,error_message:null};
  if(input.lastCompletedStage)patch.last_completed_stage=input.lastCompletedStage;
  if(changed&&["draft","edited"].includes(String(session.proposal_status))){patch.generated_plan=null;patch.proposal_status="stale";patch.generation_state={overall:"idle",modules:{}};}
  const {error}=await supabase.from("onboarding_sessions").update(patch).eq("id",input.sessionId).eq("user_id",user.id);
  if(error)return {ok:false as const,error:"Could not save this answer. Please try again."};
  return {ok:true as const};
}

export async function draftOnboardingGoals(input:{sessionId:string;rawGoals:string[];answers:unknown}) {
  const supabase=await createClient();const user=await requireUser(supabase);const answers=sanitizeAnswers(input.answers);
  const rawGoals=input.rawGoals.filter(x=>typeof x==="string").map(x=>x.trim().slice(0,240)).filter(Boolean).slice(0,3);
  if(!rawGoals.length)return {ok:false as const,error:"Add at least one goal."};
  let drafts:GoalDraft[]|null=null;let usedFallback=false;
  try{
    const system=`You are the single Project You+ Coach. Turn each user-written goal into a concise, editable goal draft. Do not invent amounts, deadlines, workout frequency, commitments, diagnoses, or financial promises. Preserve the user’s intent. Return ONLY valid JSON: {"goals":[{"clientId":"goal-1","raw":"...","title":"...","domain":"health|money|career|business|discipline|relationships|stress|organization","desiredOutcome":"...","measurableTarget":null,"targetDate":null,"why":null,"priority":1,"rationale":"..."}]}. One object per input goal, max 3.`;
    const response=await callProjectYouAI({system,messages:[{role:"user",content:JSON.stringify({rawGoals,selectedDomains:answers.direction.domains,primaryDomain:answers.direction.primaryDomain,friction:answers.friction.categories})}],maxTokens:900});
    const parsed=parseJson(response.text);const rows=Array.isArray((parsed as any)?.goals)?(parsed as any).goals:[];
    drafts=rows.slice(0,rawGoals.length).map((item:any,index:number)=>sanitizeAnswers({...EMPTY_ANSWERS,direction:answers.direction,goals:[{...item,clientId:`goal-${index+1}`,raw:rawGoals[index],status:"draft",priority:index+1}]}).goals[0]).filter(Boolean) as GoalDraft[];
    if(drafts.length!==rawGoals.length)drafts=null;
  }catch{drafts=null;}
  if(!drafts){usedFallback=true;drafts=buildFallbackGoalDrafts(rawGoals,answers.direction.domains,answers.direction.primaryDomain);}
  const nextAnswers=sanitizeAnswers({...answers,goals:drafts});
  const {error}=await supabase.from("onboarding_sessions").update({answers:nextAnswers,status:"in_progress",current_stage:"goals",last_saved_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",input.sessionId).eq("user_id",user.id);
  if(error)return {ok:false as const,error:"Your goals were refined but could not be saved. Please retry."};
  return {ok:true as const,goals:drafts,usedFallback};
}

export async function generateOnboardingPlan(sessionId:string) {
  const supabase=await createClient();const user=await requireUser(supabase);
  const {data:session,error}=await supabase.from("onboarding_sessions").select("*").eq("id",sessionId).eq("user_id",user.id).single();
  if(error||!session)return {ok:false as const,error:"Could not load your onboarding session."};
  if(session.status==="completed")return {ok:true as const,proposal:session.generated_plan as OnboardingProposal|null,completed:true as const};
  if(session.last_generation_at&&Date.now()-new Date(session.last_generation_at).getTime()<10_000&&session.status==="generating")return {ok:false as const,error:"Your starting system is already being built."};
  const answers=sanitizeAnswers(session.answers);
  for(const stage of ["direction","friction","goals","life","health","finance","coaching"] as OnboardingStage[]){const issue=validateStage(stage,answers);if(issue)return {ok:false as const,error:issue};}

  const relevantModules={goals:"working",habits:"working",priorities:"working",health:answers.health.included&&!answers.health.deferred?"working":"skipped",finance:answers.finance.deferred?"skipped":"working",weeklyReview:"working"};
  const now=new Date().toISOString();
  await supabase.from("onboarding_sessions").update({status:"generating",current_stage:"generating",generation_state:{overall:"working",modules:relevantModules},generation_attempts:Number(session.generation_attempts??0)+1,last_generation_at:now,error_code:null,error_message:null,updated_at:now}).eq("id",sessionId).eq("user_id",user.id);
  await recordOnboardingEventInternal(supabase,user.id,"plan_generation_started",{stage:"generating"});
  const {data:runId}=await supabase.rpc("begin_onboarding_ai_operation",{p_title:"Build onboarding starting system"});

  let proposal:OnboardingProposal;let provider="fallback";let failureCategory:string|null=null;
  try{
    const system=`You are the single user-facing Project You+ Coach. Build a deliberately manageable first-week starting system from CONFIRMED onboarding answers. Analyze then recommend; do not activate anything. Never invent money amounts, target dates, injuries, medical facts, workout availability, or commitments the user did not provide. Health recommendations must be conservative and organizational, not diagnostic. Finance recommendations must be educational/organizational, not investment instructions or guarantees. Use one to three goals, one to three starter habits, one to three priorities. Match training exactly to stated days/week and duration. Return ONLY valid JSON with this shape: {"generationVersion":"${ONBOARDING_VERSION}","goals":[{"clientId":"...","title":"...","domain":"...","desiredOutcome":"...","measurableTarget":null,"targetDate":null,"why":null,"priority":1,"rationale":"..."}],"habits":[{"clientId":"habit-1","title":"...","frequency":"daily|weekly|n_per_week","goalClientId":"...","rationale":"..."}],"priorities":[{"clientId":"priority-1","title":"...","goalClientId":"...","dueWindow":"today|this_week","rationale":"..."}],"healthPlan":null|{"title":"...","goal":"...","daysPerWeek":3,"sessionMinutes":45,"experience":"beginner|intermediate|advanced|returning","schedule":[{"key":"session-1","day":"Monday","dayIndex":1,"title":"Training session","focus":"...","duration":45}],"rationale":"..."},"financialFocus":null|{"title":"...","action":"...","goalType":"...","rationale":"..."},"weeklyReview":{"day":0,"time":"18:00","rationale":"..."}}.`;
    const response=await callProjectYouAI({system,messages:[{role:"user",content:JSON.stringify(redactForModel(answers))}],maxTokens:1800});
    const validated=validateProposal(parseJson(response.text),answers);
    if(!validated.ok)throw new Error(validated.error);
    proposal={...validated.value,generatedAt:new Date().toISOString()};provider=response.provider;
  }catch(err){failureCategory=err instanceof Error&&/timeout/i.test(err.message)?"provider_timeout":"provider_or_schema";proposal=buildFallbackProposal(answers);}

  const validated=validateProposal(proposal,answers);if(!validated.ok){
    const safe="Project You+ could not build a valid starting system. Your answers are safe.";
    await supabase.from("onboarding_sessions").update({status:"failed",generation_state:{overall:"failed",modules:relevantModules},error_code:"proposal_validation",error_message:safe,updated_at:new Date().toISOString()}).eq("id",sessionId).eq("user_id",user.id);
    if(runId)await supabase.rpc("finish_onboarding_ai_operation",{p_run_id:runId,p_status:"failed",p_summary:"Onboarding proposal validation failed.",p_metadata:{surface:"onboarding",error_category:"proposal_validation"}});
    await recordOnboardingEventInternal(supabase,user.id,"plan_generation_failed",{stage:"generating",error_category:"proposal_validation"});
    return {ok:false as const,error:safe};
  }
  proposal=validated.value;
  const modules={goals:"ready",habits:proposal.habits.length?"ready":"ready",priorities:"ready",health:proposal.healthPlan?"ready":answers.health.deferred?"skipped":"not_included",finance:proposal.financialFocus?"ready":answers.finance.deferred?"skipped":"not_included",weeklyReview:"ready"};
  const {error:saveError}=await supabase.from("onboarding_sessions").update({status:"awaiting_confirmation",current_stage:"review",generated_plan:proposal,generation_state:{overall:"ready",modules},proposal_version:Number(session.proposal_version??0)+1,proposal_status:"draft",error_code:failureCategory,error_message:null,last_saved_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",sessionId).eq("user_id",user.id);
  if(saveError)return {ok:false as const,error:"Your starting system was built but could not be saved. Please retry."};
  if(runId)await supabase.rpc("finish_onboarding_ai_operation",{p_run_id:runId,p_status:"passed",p_summary:failureCategory?"Onboarding system generated with deterministic fallback.":"Onboarding system generated and validated.",p_metadata:{surface:"onboarding",provider,fallback:Boolean(failureCategory),proposal_version:Number(session.proposal_version??0)+1}});
  await recordOnboardingEventInternal(supabase,user.id,"plan_generation_succeeded",{stage:"generating",completion_status:failureCategory?"fallback":"ai_validated"});
  return {ok:true as const,proposal,usedFallback:Boolean(failureCategory),generationState:{overall:"ready",modules}};
}

export async function saveOnboardingProposal(input:{sessionId:string;proposal:unknown}) {
  const supabase=await createClient();const user=await requireUser(supabase);
  const {data:session,error}=await supabase.from("onboarding_sessions").select("answers,status").eq("id",input.sessionId).eq("user_id",user.id).single();
  if(error||!session)return {ok:false as const,error:"Could not load your onboarding session."};
  const answers=sanitizeAnswers(session.answers),validated=validateProposal(input.proposal,answers);if(!validated.ok)return {ok:false as const,error:validated.error};
  const {error:saveError}=await supabase.from("onboarding_sessions").update({generated_plan:validated.value,proposal_status:"edited",status:"awaiting_confirmation",current_stage:"review",last_saved_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",input.sessionId).eq("user_id",user.id);
  return saveError?{ok:false as const,error:"Could not save your changes."}:{ok:true as const,proposal:validated.value};
}

export async function activateOnboardingSystem(sessionId:string) {
  const supabase=await createClient();const user=await requireUser(supabase);
  const now=new Date().toISOString();
  await supabase.from("onboarding_sessions").update({last_confirmation_at:now,updated_at:now}).eq("id",sessionId).eq("user_id",user.id);
  const {data,error}=await supabase.rpc("activate_onboarding_system",{p_session_id:sessionId});
  if(error){await supabase.from("onboarding_sessions").update({status:"awaiting_confirmation",error_code:"activation_failed",error_message:"We could not activate your system. Nothing was duplicated; retry when ready.",updated_at:new Date().toISOString()}).eq("id",sessionId).eq("user_id",user.id);return {ok:false as const,error:"We could not activate your system. Your confirmed plan is safe; please retry."};}
  await recordOnboardingEventInternal(supabase,user.id,"plan_confirmed",{stage:"review",completion_status:"confirmed"});
  await recordOnboardingEventInternal(supabase,user.id,"onboarding_completed",{stage:"trajectory",completion_status:"completed"});
  revalidatePath("/today");revalidatePath("/plan");revalidatePath("/coach");revalidatePath("/you");revalidatePath("/progress");
  return {ok:true as const,records:data};
}

export async function recordOnboardingEvent(event:string,metadata:Record<string,unknown>={}) {
  if(!SAFE_EVENTS.has(event))return;
  const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)return;
  await recordOnboardingEventInternal(supabase,user.id,event,metadata);
}

async function recordOnboardingEventInternal(supabase:any,userId:string,event:string,metadata:Record<string,unknown>) {
  if(!SAFE_EVENTS.has(event))return;
  const h=await headers();const ua=h.get("user-agent")??"";const device=/iPhone|Android.*Mobile|Mobile/i.test(ua)?"mobile":/iPad|Tablet/i.test(ua)?"tablet":"desktop";
  const safe={onboarding_version:ONBOARDING_VERSION,stage:safeString(metadata.stage,40),duration_ms:safeNumber(metadata.duration_ms),selection_count:safeNumber(metadata.selection_count),completion_status:safeString(metadata.completion_status,40),error_category:safeString(metadata.error_category,60),device_class:device};
  await supabase.from("activity_events").insert({user_id:userId,event_name:event,path:"/onboarding",metadata:Object.fromEntries(Object.entries(safe).filter(([,v])=>v!==null&&v!==""))});
}

async function requireUser(supabase:any){const {data:{user}}=await supabase.auth.getUser();if(!user)throw new Error("Sign in to continue.");return user;}

function mapSession(row:any):OnboardingSessionView{return {id:String(row.id),mode:row.mode==="personalize"?"personalize":"initial",status:row.status,currentStage:row.current_stage as OnboardingStage,lastCompletedStage:row.last_completed_stage??null,answers:sanitizeAnswers(row.answers),generatedPlan:row.generated_plan?validateProposalLoose(row.generated_plan):null,generationState:normalizeGeneration(row.generation_state),proposalVersion:Number(row.proposal_version??0),proposalStatus:String(row.proposal_status??"none"),errorMessage:row.error_message??null,startedAt:String(row.started_at),lastSavedAt:String(row.last_saved_at)};}
function validateProposalLoose(value:unknown){const root=value as OnboardingProposal;return root&&Array.isArray(root.goals)&&root.weeklyReview?root:null;}
function normalizeGeneration(value:any){const root=value&&typeof value==="object"?value:{};return {overall:typeof root.overall==="string"?root.overall:"idle",modules:root.modules&&typeof root.modules==="object"?root.modules:{}};}

async function buildPrefill(supabase:any,userId:string):Promise<OnboardingAnswers>{
  const [{data:profile},{data:goals},{data:work},{data:plan},{data:review}]=await Promise.all([
    supabase.from("profiles").select("blueprint").eq("id",userId).maybeSingle(),
    supabase.from("goals").select("id,title,category,target,deadline,objective_90day").eq("user_id",userId).eq("status","active").order("created_at").limit(3),
    supabase.from("work_schedules").select("days_of_week,start_time,end_time").eq("user_id",userId).eq("active",true).order("created_at").limit(1).maybeSingle(),
    supabase.from("workout_plans").select("goal,days_per_week,session_minutes,experience,schedule").eq("user_id",userId).eq("active",true).order("created_at",{ascending:false}).limit(1).maybeSingle(),
    supabase.from("weekly_review_settings").select("day_of_week,time_of_day,reminders_enabled").eq("user_id",userId).maybeSingle(),
  ]);
  const legacy=profile?.blueprint??{},onboarding=legacy.onboarding??{};const priorities=(Array.isArray(onboarding.selectedDomains)?onboarding.selectedDomains:Array.isArray(legacy.priorities)?legacy.priorities:[]).map((x:any)=>String(x).toLowerCase()).filter((x:string)=>(DIRECTION_DOMAINS as readonly string[]).includes(x)).slice(0,3);
  const mappedGoals=(goals??[]).map((g:any,index:number)=>({clientId:`existing-${g.id}`,raw:g.title,title:g.title,domain:domainFromCategory(g.category,priorities[0]),desiredOutcome:g.objective_90day||g.title,measurableTarget:g.target||null,targetDate:g.deadline||null,why:null,priority:index+1,status:"draft" as const,rationale:"Existing active goal — it will be preserved unless you edit it."}));
  const styleRaw=String(onboarding?.coachingPreferences?.style??legacy?.coachingStyle?.[0]??"").toLowerCase();const style=(COACH_STYLES as readonly string[]).includes(styleRaw)?styleRaw:null;
  const healthPreferences=onboarding.healthPreferences??{};const financePreferences=onboarding.financePreferences??{};
  return sanitizeAnswers({...EMPTY_ANSWERS,direction:{domains:priorities,primaryDomain:(onboarding.primaryDomain&&priorities.includes(String(onboarding.primaryDomain).toLowerCase()))?String(onboarding.primaryDomain).toLowerCase():(priorities[0]??null)},friction:{categories:onboarding.frictionCategories??[],note:onboarding.frictionNote??""},goals:mappedGoals,life:onboarding.lifeStructure??{...EMPTY_ANSWERS.life,work:work?{type:"fixed",days:work.days_of_week,startTime:String(work.start_time).slice(0,5),endTime:String(work.end_time).slice(0,5)}:EMPTY_ANSWERS.life.work},health:Object.keys(healthPreferences).length?healthPreferences:plan?{included:true,deferred:false,objective:"general_health",experience:plan.experience,trainingDaysPerWeek:plan.days_per_week,preferredDays:Array.isArray(plan.schedule)?plan.schedule.map((x:any)=>x.dayIndex):[],workoutDurationMinutes:plan.session_minutes,setting:"flexible",nutritionObjective:"none"}:EMPTY_ANSWERS.health,finance:Object.keys(financePreferences).length?financePreferences:EMPTY_ANSWERS.finance,coaching:{...(onboarding.coachingPreferences??EMPTY_ANSWERS.coaching),style,weeklyReviewDay:review?.day_of_week??onboarding?.weeklyReview?.day??null,weeklyReviewTime:review?.time_of_day?String(review.time_of_day).slice(0,5):onboarding?.weeklyReview?.time??"18:00",reminderIntent:Boolean(review?.reminders_enabled??onboarding?.weeklyReview?.reminderIntent)}});
}

function parseJson(text:string){const trimmed=text.trim();try{return JSON.parse(trimmed);}catch{const start=trimmed.indexOf("{");const end=trimmed.lastIndexOf("}");if(start>=0&&end>start)return JSON.parse(trimmed.slice(start,end+1));throw new Error("AI returned invalid JSON");}}
function redactForModel(answers:OnboardingAnswers){return {...answers,health:{...answers.health,limitations:answers.health.limitations||undefined},finance:{...answers.finance}};}
function domainFromCategory(category:string|null,fallback:string|undefined){const c=String(category??"").toLowerCase();if(c==="finance")return"money";if((DIRECTION_DOMAINS as readonly string[]).includes(c))return c;return (DIRECTION_DOMAINS as readonly string[]).includes(String(fallback))?fallback:"discipline";}
function safeString(v:unknown,max:number){return typeof v==="string"?v.slice(0,max):null;}
function safeNumber(v:unknown){const n=Number(v);return Number.isFinite(n)?Math.max(0,Math.round(n)):null;}
