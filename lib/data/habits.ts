import { isDemoMode } from "@/lib/demo-mode";
import { mockHabits } from "@/lib/mock-data";
import { createClient } from "@/lib/supabase/server";
import type { Habit } from "@/lib/types";

export async function getHabits(): Promise<Habit[]> {
  if (isDemoMode) return mockHabits.map((h)=>({...h,goalId:null}));
  const supabase=await createClient();
  const {data:habits,error}=await supabase.from("habits").select("*").order("created_at");
  if(error)throw new Error(`Could not load habits: ${error.message}`);if(!habits)return[];
  const thirtyDaysAgo=new Date();thirtyDaysAgo.setDate(thirtyDaysAgo.getDate()-30);
  const {data:logs,error:logsError}=await supabase.from("habit_logs").select("habit_id,logged_at").gte("logged_at",thirtyDaysAgo.toISOString().slice(0,10));
  if(logsError)throw new Error(`Could not load habit history: ${logsError.message}`);
  return habits.map((h)=>{
    const habitLogs=(logs??[]).filter((l)=>l.habit_id===h.id);const consistencyPct=Math.round((habitLogs.length/30)*100);let streakDays=0;const loggedDates=new Set(habitLogs.map((l)=>l.logged_at));const cursor=new Date();while(loggedDates.has(cursor.toISOString().slice(0,10))){streakDays++;cursor.setDate(cursor.getDate()-1);}
    return {id:h.id,goalId:h.goal_id??null,title:h.title,targetFrequency:h.target_frequency??"daily",consistencyPct:Math.min(consistencyPct,100),streakDays,preferredDays:Array.isArray(h.preferred_days)?h.preferred_days.map(Number):[],preferredTime:h.preferred_time?String(h.preferred_time).slice(0,5):null,durationMinutes:h.duration_minutes==null?null:Number(h.duration_minutes),minimumVersion:h.minimum_version??null,recoveryRule:h.recovery_rule??null,evidenceType:h.evidence_type??null,targetPerWeek:h.target_per_week==null?null:Number(h.target_per_week),domain:h.domain??null};
  });
}

export async function isHabitLoggedToday(habitId:string):Promise<boolean>{if(isDemoMode)return false;const supabase=await createClient();const today=new Date().toISOString().slice(0,10);const {data}=await supabase.from("habit_logs").select("id").eq("habit_id",habitId).eq("logged_at",today).maybeSingle();return!!data;}
