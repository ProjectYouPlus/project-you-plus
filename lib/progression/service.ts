import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { UserContext } from "@/lib/ai/context";
import { ONE_PERCENT_BRAND_ASSET,type ProgressionAchievement,type ProgressionStage,type ProgressionState } from "@/lib/types/progression";

type Unlock={key:string;title:string;category:ProgressionAchievement["category"];threshold?:number;metadata?:Record<string,unknown>};
const COMPLETIONS=new Set(["task.completed","habit.completed","workout.completed"]);

export async function evaluateProgression(context:UserContext):Promise<ProgressionState>{
 const client=await createClient();const {data:{user}}=await client.auth.getUser();if(!user)throw new Error("Not signed in.");const admin=createAdminClient();const now=new Date(),today=isoDate(now);
 const score=context.score.score.score,coverage=context.score.coveragePct,breakdown=context.score.score.breakdown;
 await admin.from("score_snapshots").upsert({user_id:user.id,score,coverage_pct:coverage,breakdown,captured_on:today},{onConflict:"user_id,captured_on"});
 const {data:previousScore}=await admin.from("score_snapshots").select("score,captured_on").eq("user_id",user.id).neq("captured_on",today).order("captured_on",{ascending:false}).limit(1).maybeSingle();
 if(!previousScore||Number(previousScore.score)!==score)await admin.from("behavior_events").upsert({user_id:user.id,event_type:"score.changed",occurred_at:now.toISOString(),source_table:"score_snapshots",source_id:today,dedupe_key:`score.changed:snapshot:${today}:${score}`,payload:{score,previous_score:previousScore?Number(previousScore.score):null,coverage_pct:coverage}},{onConflict:"user_id,dedupe_key",ignoreDuplicates:true});
 const priorMonthStart=new Date(now.getFullYear(),now.getMonth()-1,1),currentMonthStart=new Date(now.getFullYear(),now.getMonth(),1),historyStart=new Date(now);historyStart.setDate(historyStart.getDate()-60);
 const [snapshotsRes,eventsRes,profileRes,goalsRes,reviewsRes,plansRes,logsRes,budgetsRes,txRes,existingRes]=await Promise.all([
  admin.from("score_snapshots").select("score,coverage_pct,breakdown,captured_on").eq("user_id",user.id).order("captured_on",{ascending:false}).limit(60),
  admin.from("behavior_events").select("id,event_type,occurred_at,source_table,source_id").eq("user_id",user.id).gte("occurred_at",historyStart.toISOString()).order("occurred_at"),
  admin.from("profiles").select("created_at").eq("id",user.id).maybeSingle(),admin.from("goals").select("id,progress,status").eq("user_id",user.id),
  admin.from("weekly_reviews").select("id,week_start").eq("user_id",user.id).limit(1),admin.from("workout_plans").select("id,schedule").eq("user_id",user.id).eq("active",true).limit(1).maybeSingle(),
  admin.from("workout_plan_logs").select("plan_id,session_key,completed_on").eq("status","completed").eq("user_id",user.id).gte("completed_on",isoDate(daysAgo(now,14))),
  admin.from("budgets").select("monthly_limit,period_start").eq("user_id",user.id).eq("period_start",isoDate(priorMonthStart)),
  admin.from("transactions").select("amount,occurred_at").eq("user_id",user.id).gte("occurred_at",priorMonthStart.toISOString()).lt("occurred_at",currentMonthStart.toISOString()),
  admin.from("user_achievements").select("achievement_key").eq("user_id",user.id)
 ]);
 const snapshots=snapshotsRes.data??[],events=eventsRes.data??[],existing=new Set((existingRes.data??[]).map(row=>row.achievement_key)),unlocks:Unlock[]=[];
 const highest=Math.max(score,...snapshots.map(row=>Number(row.score)));for(let threshold=5;threshold<=Math.min(95,Math.floor(highest/5)*5);threshold+=5)unlocks.push({key:`score_${threshold}`,title:threshold%10===0?`${threshold} Point Milestone`:`${threshold} Point Recognition`,category:threshold%10===0?"milestone":"score",threshold,metadata:{score:threshold}});
 const activeDays=[...new Set(events.filter(event=>COMPLETIONS.has(event.event_type)).map(event=>String(event.occurred_at).slice(0,10)))].sort();
 if(activeDays.length)unlocks.push({key:"first_completed_day",title:"First Completed Day",category:"behavior"});
 if(activeDays.length>=7)unlocks.push({key:"first_completed_week",title:"First Completed Week",category:"behavior"});
 if(hasSevenDayRun(activeDays))unlocks.push({key:"seven_day_consistency",title:"7-Day Consistency",category:"behavior"});
 if((goalsRes.data??[]).some(goal=>goal.status==="completed"||Number(goal.progress)>=100))unlocks.push({key:"first_completed_goal",title:"First Completed Goal",category:"behavior"});
 if((reviewsRes.data??[]).length)unlocks.push({key:"first_weekly_review",title:"First Weekly Review",category:"behavior"});
 if(profileRes.data?.created_at&&now.getTime()-new Date(profileRes.data.created_at).getTime()>=30*86400000)unlocks.push({key:"first_month",title:"First Month",category:"behavior"});
 if(fullWorkoutWeek(plansRes.data,logsRes.data??[],now))unlocks.push({key:"full_scheduled_workout_week",title:"Full Scheduled Workout Week",category:"behavior"});
 const budget=(budgetsRes.data??[]).reduce((sum,row)=>sum+Number(row.monthly_limit||0),0),spend=Math.abs((txRes.data??[]).filter(row=>Number(row.amount)<0).reduce((sum,row)=>sum+Number(row.amount),0));if(budget>0&&(txRes.data??[]).length&&spend<=budget)unlocks.push({key:`budget_month_on_target_${isoDate(priorMonthStart).slice(0,7)}`,title:"Budget Month On Target",category:"behavior",metadata:{month:isoDate(priorMonthStart).slice(0,7),budget,spend}});
 const recent=snapshots.filter(row=>new Date(`${row.captured_on}T12:00:00`)>=daysAgo(now,14)),highDays=recent.filter(row=>Number(row.score)>=90&&Number(row.coverage_pct)>=75).length,domainCount=Object.values(breakdown).filter(value=>Number(value)>=80).length;
 const eligible=score>=99&&coverage>=75&&snapshots.length>=14&&highDays>=7&&domainCount>=4;if(eligible)unlocks.push({key:"one_percent",title:"1%",category:"elite",threshold:99,metadata:{calibrationDays:snapshots.length,sustainedHighDays:highDays,contributingDomains:domainCount}});
 for(const unlock of unlocks)if(!existing.has(unlock.key))await unlockAchievement(admin,user.id,unlock);
 const stage=eligible?"1%":stageFor(score),previous=(await admin.from("user_progression").select("one_percent_unlocked,one_percent_unlocked_at").eq("user_id",user.id).maybeSingle()).data;
 const onePercentUnlocked=Boolean(previous?.one_percent_unlocked)||eligible,onePercentAt=previous?.one_percent_unlocked_at??(eligible?now.toISOString():null),currentStage:ProgressionStage=onePercentUnlocked?"1%":stage;
 await admin.from("user_progression").upsert({user_id:user.id,current_level:currentStage,highest_score:highest,current_score:score,coverage_pct:coverage,sustained_high_days:highDays,one_percent_unlocked:onePercentUnlocked,one_percent_unlocked_at:onePercentAt,updated_at:now.toISOString()},{onConflict:"user_id"});
 const {data:rows}=await admin.from("user_achievements").select("id,achievement_key,title,category,threshold,metadata,unlocked_at").eq("user_id",user.id).order("unlocked_at",{ascending:false});
 return{stage:currentStage,currentScore:score,highestScore:highest,coveragePct:coverage,sustainedHighDays:highDays,onePercentUnlocked,onePercentUnlockedAt:onePercentAt,calibrationDays:snapshots.length,contributingDomains:domainCount,numericLevel:null,numericProgressionAvailable:false,achievements:(rows??[]).map(row=>({id:row.id,key:row.achievement_key,title:row.title,category:row.category as ProgressionAchievement["category"],threshold:row.threshold==null?null:Number(row.threshold),unlockedAt:row.unlocked_at,metadata:row.metadata??{}})),brandAsset:onePercentUnlocked?ONE_PERCENT_BRAND_ASSET:null};
}

async function unlockAchievement(admin:ReturnType<typeof createAdminClient>,userId:string,item:Unlock){const {data}=await admin.from("user_achievements").upsert({user_id:userId,achievement_key:item.key,title:item.title,category:item.category,threshold:item.threshold??null,metadata:item.metadata??{}},{onConflict:"user_id,achievement_key",ignoreDuplicates:true}).select("id,unlocked_at").maybeSingle();if(!data)return;const type=item.category==="score"||item.category==="milestone"||item.category==="elite"?"milestone.unlocked":"achievement.unlocked";await admin.from("behavior_events").upsert({user_id:userId,event_type:type,occurred_at:data.unlocked_at,source_table:"user_achievements",source_id:data.id,dedupe_key:`${type}:progression:${item.key}`,payload:{key:item.key,title:item.title,threshold:item.threshold??null}},{onConflict:"user_id,dedupe_key",ignoreDuplicates:true});}
function stageFor(score:number):ProgressionStage{return score>=80?"Elite":score>=60?"Alignment":score>=40?"Momentum":"Foundation";}
function hasSevenDayRun(days:string[]){const set=new Set(days);return days.some(value=>{const date=new Date(`${value}T12:00:00`);for(let i=1;i<7;i++){date.setDate(date.getDate()+1);if(!set.has(isoDate(date)))return false}return true});}
function fullWorkoutWeek(plan:{id:string;schedule:unknown}|null,logs:Array<{plan_id:string;session_key:string;completed_on:string}>,now:Date){if(!plan||!Array.isArray(plan.schedule))return false;const monday=daysAgo(now,(now.getDay()+6)%7+7),sunday=new Date(monday);sunday.setDate(monday.getDate()+6);const expected=(plan.schedule as Array<{key?:string;dayIndex?:number}>).filter(item=>item.key&&Number.isInteger(item.dayIndex));if(!expected.length)return false;return expected.every(item=>{const day=new Date(monday);day.setDate(monday.getDate()+((Number(item.dayIndex)+6)%7));return day<=sunday&&logs.some(log=>log.plan_id===plan.id&&log.session_key===item.key&&log.completed_on===isoDate(day))});}
function daysAgo(date:Date,count:number){const copy=new Date(date);copy.setDate(copy.getDate()-count);copy.setHours(0,0,0,0);return copy;}
function isoDate(date:Date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;}
