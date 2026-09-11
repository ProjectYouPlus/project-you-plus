import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(){
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)return NextResponse.json({error:"Unauthorized"},{status:401});
 const today=new Date().toISOString().slice(0,10);
 const [{data:tasks},{data:habits},{data:habitLogs},{data:goals}]=await Promise.all([
  supabase.from("tasks").select("id,title,tier,due_at,completed_at,goal_id").is("completed_at",null).order("created_at",{ascending:false}),
  supabase.from("habits").select("id,title,target_frequency,streak_days,goal_id").order("created_at"),
  supabase.from("habit_logs").select("habit_id").eq("logged_at",today),
  supabase.from("goals").select("id,title")
 ]);
 const goalMap=new Map((goals??[]).map(g=>[g.id,g.title]));const logged=new Set((habitLogs??[]).map(l=>l.habit_id));
 return NextResponse.json({
  tasks:(tasks??[]).map(t=>({id:t.id,title:t.title,tier:t.tier,done:false,dueAt:t.due_at,goalTitle:t.goal_id?goalMap.get(t.goal_id)??null:null})),
  habits:(habits??[]).map(h=>({id:h.id,title:h.title,done:logged.has(h.id),streakDays:h.streak_days??0,goalTitle:h.goal_id?goalMap.get(h.goal_id)??null:null,optional:h.target_frequency!=="daily"}))
 });
}
