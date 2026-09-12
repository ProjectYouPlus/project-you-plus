import { cache } from "react";
import { isDemoMode } from "@/lib/demo-mode";
import { mockProfile } from "@/lib/mock-data";
import { createClient } from "@/lib/supabase/server";
import type { ActiveSystemContext, Profile } from "@/lib/types";
import { redirect } from "next/navigation";

export const getProfile = cache(async (): Promise<Profile> => {
  if (isDemoMode) return mockProfile;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data, error } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (error && error.code !== "PGRST116") throw new Error("Could not load your profile. Please try again.");
  if (!data) return { id: user.id, fullName: null, timezone: "UTC", onboardingCompleted: false, onboardingStatus:"not_started", onboardingVersion:null, onboardingCompletedAt:null, blueprint: null };

  let blueprint=(data.blueprint??null) as Profile["blueprint"];
  if(data.onboarding_completed){
    const [metricsRes,milestonesRes,reviewRes]=await Promise.all([
      supabase.from("goal_metrics").select("id,goal_id,name,unit,direction,metric_type,entry_frequency,data_source,baseline,target_value,target_label,needs_confirmation").eq("active",true).order("created_at"),
      supabase.from("goal_milestones").select("id,goal_id,title,target_value,unit,target_date,sort_order,status").order("sort_order"),
      supabase.from("weekly_review_settings").select("day_of_week,time_of_day,reminders_enabled").eq("active",true).maybeSingle(),
    ]);
    const metrics=(metricsRes.data??[]).map((row:any)=>({id:String(row.id),goalId:String(row.goal_id),name:String(row.name),unit:String(row.unit),direction:String(row.direction),metricType:String(row.metric_type),entryFrequency:String(row.entry_frequency),dataSource:String(row.data_source),baseline:row.baseline==null?null:Number(row.baseline),targetValue:row.target_value==null?null:Number(row.target_value),targetLabel:row.target_label??null,needsConfirmation:Boolean(row.needs_confirmation)}));
    const milestones=(milestonesRes.data??[]).map((row:any)=>({id:String(row.id),goalId:String(row.goal_id),title:String(row.title),targetValue:row.target_value==null?null:Number(row.target_value),unit:row.unit??null,targetDate:row.target_date??null,sortOrder:Number(row.sort_order??1),status:String(row.status??"pending")}));
    const review=reviewRes.data?{day:Number(reviewRes.data.day_of_week),time:String(reviewRes.data.time_of_day).slice(0,5),remindersEnabled:Boolean(reviewRes.data.reminders_enabled)}:null;
    const existing=(blueprint?.activeSystem??{}) as ActiveSystemContext;
    if(existing.proposalId||metrics.length||milestones.length||review){blueprint={...(blueprint??{}),activeSystem:{...existing,contextDefinitions:{metrics,milestones,weeklyReview:review}}};}
  }

  return {
    id: data.id,
    createdAt: data.created_at,
    fullName: data.full_name,
    timezone: data.timezone,
    onboardingCompleted: data.onboarding_completed,
    onboardingStatus: data.onboarding_status ?? null,
    onboardingVersion: data.onboarding_version ?? null,
    onboardingCompletedAt: data.onboarding_completed_at ?? null,
    blueprint,
  };
});
