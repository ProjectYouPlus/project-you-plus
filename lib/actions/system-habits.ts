"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function useHabitMinimumVersion(habitId:string){
  if(!habitId)return {ok:false as const,error:"Habit not found."};
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return {ok:false as const,error:"Sign in to continue."};
  const {data:habit,error}=await supabase.from("habits").select("id,user_id,domain,minimum_version").eq("id",habitId).eq("user_id",user.id).maybeSingle();
  if(error||!habit)return {ok:false as const,error:"Habit not found."};
  if(!habit.minimum_version)return {ok:false as const,error:"This habit does not have a minimum version yet."};
  await supabase.rpc("append_behavior_event",{
    p_user_id:user.id,
    p_event_type:"minimum_version.used",
    p_dedupe_key:`minimum_version.used:habit:${habitId}:${crypto.randomUUID()}`,
    p_source_table:"habits",
    p_source_id:habitId,
    p_occurred_at:new Date().toISOString(),
    p_payload:{domain:habit.domain??null,action_kind:"habit"},
  });
  revalidatePath("/coach");
  revalidatePath("/review");
  return {ok:true as const,minimumVersion:String(habit.minimum_version)};
}
