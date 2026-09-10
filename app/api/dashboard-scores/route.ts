import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(){
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)return NextResponse.json({error:"Unauthorized"},{status:401});
 const now=new Date();const today=localDate(now);const week=new Date(now);week.setDate(now.getDate()-6);week.setHours(0,0,0,0);const month=new Date(now.getFullYear(),now.getMonth(),1);
 const [planRes,planLogsRes,nutritionRes,suppRes,suppLogsRes,accountsRes,transactionsRes,budgetsRes]=await Promise.all([
  supabase.from("workout_plans").select("id,schedule").eq("active",true).order("created_at",{ascending:false}).limit(1).maybeSingle(),
  supabase.from("workout_plan_logs").select("plan_id,session_key,completed_on").gte("completed_on",localDate(week)).lte("completed_on",today),
  supabase.from("nutrition_logs").select("logged_at").gte("logged_at",week.toISOString()),
  supabase.from("supplements").select("id,frequency").eq("active",true),
  supabase.from("supplement_logs").select("supplement_id,logged_on").gte("logged_on",localDate(week)).lte("logged_on",today),
  supabase.from("finance_accounts").select("balance,account_type"),
  supabase.from("transactions").select("amount,occurred_at").gte("occurred_at",month.toISOString()),
  supabase.from("budgets").select("monthly_limit")
 ]);
 const schedule=Array.isArray(planRes.data?.schedule)?planRes.data!.schedule as Array<{key:string;dayIndex:number}>:[];const logs=new Set((planLogsRes.data??[]).filter(x=>x.plan_id===planRes.data?.id).map(x=>`${x.completed_on}:${x.session_key}`));
 const monday=new Date(now);monday.setDate(now.getDate()-((now.getDay()+6)%7));monday.setHours(12,0,0,0);let workoutExpected=0,workoutDone=0;for(const s of schedule){const d=new Date(monday);d.setDate(monday.getDate()+((s.dayIndex+6)%7));if(d<=now){workoutExpected++;if(logs.has(`${localDate(d)}:${s.key}`))workoutDone++}}const training=workoutExpected?Math.round(workoutDone/workoutExpected*100):schedule.length?100:0;
 const nutritionDays=new Set((nutritionRes.data??[]).map(x=>localDate(new Date(x.logged_at))));let dietDone=0;for(let i=0;i<7;i++){const d=new Date(now);d.setDate(now.getDate()-i);if(nutritionDays.has(localDate(d)))dietDone++}const diet=Math.round(dietDone/7*100);
 const supps=suppRes.data??[];const suppLogs=suppLogsRes.data??[];let suppExpected=0,suppDone=0;for(let i=0;i<7;i++){const d=new Date(now);d.setDate(now.getDate()-i);for(const s of supps){if(isDue(s.frequency,d.getDay())){suppExpected++;if(suppLogs.some(l=>l.supplement_id===s.id&&l.logged_on===localDate(d)))suppDone++}}}const protocol=suppExpected?Math.round(suppDone/suppExpected*100):100;const consistency=Math.round((training+diet+protocol)/3);const healthScore=Math.round(training*.35+diet*.30+protocol*.20+consistency*.15);
 const accounts=accountsRes.data??[];const tx=transactionsRes.data??[];const budgets=budgetsRes.data??[];const hasFinance=accounts.length>0||tx.length>0||budgets.length>0;let financeScore:number|null=null;if(hasFinance){const income=tx.filter(x=>Number(x.amount)>0).reduce((s,x)=>s+Number(x.amount),0);const spend=Math.abs(tx.filter(x=>Number(x.amount)<0).reduce((s,x)=>s+Number(x.amount),0));const budget=budgets.reduce((s,x)=>s+Number(x.monthly_limit||0),0);const savings=income>0?Math.max(0,Math.min(100,Math.round((income-spend)/income*100+50))):50;const budgetScore=budget>0?Math.max(0,Math.min(100,Math.round(100-spend/budget*100))):50;const debt=Math.abs(accounts.filter(x=>["credit","loan","liability"].includes(String(x.account_type))).reduce((s,x)=>s+Math.min(0,Number(x.balance||0)),0));const cash=accounts.filter(x=>!["credit","loan","liability"].includes(String(x.account_type))).reduce((s,x)=>s+Math.max(0,Number(x.balance||0)),0);const position=cash+debt>=0?80:35;financeScore=Math.round(savings*.4+budgetScore*.35+position*.25)}
 return NextResponse.json({healthScore,financeScore,health:{training,diet,protocol,consistency}});
}
function isDue(frequency:string,day:number){if(frequency==="daily")return true;if(frequency==="weekdays")return day>=1&&day<=5;if(frequency.startsWith("weekly_"))return frequency===`weekly_${["sunday","monday","tuesday","wednesday","thursday","friday","saturday"][day]}`;if(frequency==="weekly")return day===1;return false}
function localDate(d:Date){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`}
