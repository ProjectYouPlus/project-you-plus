"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { refreshProgressionAfterMutation } from "@/lib/progression/service";

export async function completeSystemTask(taskId:string){
  const auth=await getOwnedTask(taskId);if(!auth.ok)return auth;
  const {supabase,user,task}=auth;if(task.completed_at)return {ok:true as const};
  const completedAt=new Date().toISOString();const {error}=await supabase.from("tasks").update({completed_at:completedAt}).eq("id",taskId).eq("user_id",user.id);if(error)return fail("Could not complete that action.");
  await appendEvidence(supabase,user.id,"action.completed",taskId,{domain:task.domain??null,action_kind:task.action_kind??"task"});
  await refreshProgressionAfterMutation();refreshTodaySurfaces();return {ok:true as const};
}

export async function skipSystemTask(taskId:string){
  const auth=await getOwnedTask(taskId);if(!auth.ok)return auth;const {supabase,user,task}=auth;
  const nextDue=nextLocalDay(task.due_at);const {error}=await supabase.from("tasks").update({due_at:nextDue}).eq("id",taskId).eq("user_id",user.id);if(error)return fail("Could not skip that action safely.");
  await appendEvidence(supabase,user.id,"action.skipped",taskId,{domain:task.domain??null,action_kind:task.action_kind??"task",rescheduled:true});refreshTodaySurfaces();return {ok:true as const,dueAt:nextDue};
}

export async function rescheduleSystemTask(taskId:string,dueAt:string){
  const parsed=new Date(dueAt);if(!dueAt||Number.isNaN(parsed.getTime())||parsed.getTime()<Date.now()-60_000)return fail("Choose a valid future time.");
  const auth=await getOwnedTask(taskId);if(!auth.ok)return auth;const {supabase,user,task}=auth;const {error}=await supabase.from("tasks").update({due_at:parsed.toISOString()}).eq("id",taskId).eq("user_id",user.id);if(error)return fail("Could not reschedule that action.");
  await appendEvidence(supabase,user.id,"action.rescheduled",taskId,{domain:task.domain??null,action_kind:task.action_kind??"task",had_previous_due:Boolean(task.due_at)});refreshTodaySurfaces();return {ok:true as const,dueAt:parsed.toISOString()};
}

export async function explainBlockedSystemTask(taskId:string,reason:string){
  const clean=reason.trim().slice(0,500);if(!clean)return fail("Add a short reason so your Coach can learn from the block.");
  const auth=await getOwnedTask(taskId);if(!auth.ok)return auth;const {supabase,user,task}=auth;
  await appendEvidence(supabase,user.id,"action.blocked",taskId,{domain:task.domain??null,action_kind:task.action_kind??"task",reason:clean});
  revalidatePath("/coach");revalidatePath("/review");return {ok:true as const};
}

export async function recordSystemMinimumVersion(taskId:string){
  const auth=await getOwnedTask(taskId);if(!auth.ok)return auth;const {supabase,user,task}=auth;if(!task.minimum_version)return fail("This action does not have a minimum version yet.");
  await appendEvidence(supabase,user.id,"minimum_version.used",taskId,{domain:task.domain??null,action_kind:task.action_kind??"task"});revalidatePath("/coach");revalidatePath("/review");return {ok:true as const,minimumVersion:String(task.minimum_version)};
}

async function getOwnedTask(taskId:string){
  if(!taskId)return fail("Action not found.");const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)return fail("Sign in to continue.");
  const {data:task,error}=await supabase.from("tasks").select("id,user_id,due_at,completed_at,domain,action_kind,minimum_version").eq("id",taskId).eq("user_id",user.id).maybeSingle();if(error||!task)return fail("Action not found.");return {ok:true as const,supabase,user,task};
}
async function appendEvidence(supabase:any,userId:string,eventType:string,taskId:string,payload:Record<string,unknown>){await supabase.rpc("append_behavior_event",{p_user_id:userId,p_event_type:eventType,p_dedupe_key:`${eventType}:${taskId}:${crypto.randomUUID()}`,p_source_table:"tasks",p_source_id:taskId,p_occurred_at:new Date().toISOString(),p_payload:payload});}
function nextLocalDay(current:string|null){const base=current&&new Date(current).getTime()>Date.now()?new Date(current):new Date();base.setDate(base.getDate()+1);if(!current){base.setHours(20,0,0,0);}return base.toISOString();}
function refreshTodaySurfaces(){revalidatePath("/today");revalidatePath("/plan");revalidatePath("/coach");revalidatePath("/review");revalidatePath("/progress");revalidatePath("/tasks");}
function fail(error:string){return {ok:false as const,error};}
