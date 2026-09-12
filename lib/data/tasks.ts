import { isDemoMode } from "@/lib/demo-mode";
import { mockTasks } from "@/lib/mock-data";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import type { Task } from "@/lib/types";

function metaFor(row:{due_at:string|null;completed_at:string|null}):string|undefined{if(row.completed_at)return"Completed";if(row.due_at)return`Due ${new Date(row.due_at).toLocaleString([],{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"})}`;return undefined;}
function mapTask(row:any):Task{return{id:row.id,goalId:row.goal_id,title:row.title,tier:row.tier??"optional",dueAt:row.due_at,completedAt:row.completed_at,meta:metaFor(row),domain:row.domain??null,actionKind:row.action_kind??null,preferredDays:Array.isArray(row.preferred_days)?row.preferred_days.map(Number):[],preferredTime:row.preferred_time?String(row.preferred_time).slice(0,5):null,durationMinutes:row.duration_minutes==null?null:Number(row.duration_minutes),minimumVersion:row.minimum_version??null,recoveryRule:row.recovery_rule??null,evidenceType:row.evidence_type??null};}

export async function getTasks():Promise<Task[]>{
  if(isDemoMode){const cookieStore=await cookies();let additions:Task[]=[];try{additions=JSON.parse(cookieStore.get("py_demo_tasks")?.value??"[]") as Task[];}catch{}return[...additions,...mockTasks];}
  const supabase=await createClient();const {data,error}=await supabase.from("tasks").select("*").order("due_at",{ascending:true,nullsFirst:false});if(error)throw new Error(`Could not load tasks: ${error.message}`);return(data??[]).map(mapTask);
}
export async function getTasksByGoal(goalId:string):Promise<Task[]>{if(isDemoMode){const all=await getTasks();return all.filter(task=>task.goalId===goalId);}const supabase=await createClient();const {data,error}=await supabase.from("tasks").select("*").eq("goal_id",goalId);if(error||!data)return[];return data.map(mapTask);}
