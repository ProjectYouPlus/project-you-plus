import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { HealthQuickEntry } from "@/components/health/health-quick-entry";
import { NavIcon } from "@/components/layout/nav-icon";

const LABELS: Record<string,{label:string;unit:string}>={steps:{label:"Steps",unit:""},sleep_minutes:{label:"Sleep",unit:"min"},water_cups:{label:"Water",unit:"cups"},weight_kg:{label:"Weight",unit:"kg"},resting_hr:{label:"Resting HR",unit:"bpm"},recovery_pct:{label:"Recovery",unit:"%"}};

export default async function HealthPage(){
  const supabase=await createClient();
  const start=new Date();start.setHours(0,0,0,0);const end=new Date(start);end.setDate(end.getDate()+1);
  const [{data:metrics},{data:nutrition},{data:plan},{data:supplements},{data:supplementLogs}]=await Promise.all([
    supabase.from("health_metrics").select("metric_type,value,recorded_at,source").order("recorded_at",{ascending:false}).limit(80),
    supabase.from("nutrition_logs").select("id,meal_name,calories,protein_g,carbs_g,fat_g,logged_at,source").gte("logged_at",start.toISOString()).lt("logged_at",end.toISOString()).order("logged_at"),
    supabase.from("workout_plans").select("id,title,days_per_week,schedule").eq("active",true).order("created_at",{ascending:false}).limit(1).maybeSingle(),
    supabase.from("supplements").select("id,name").eq("active",true),
    supabase.from("supplement_logs").select("supplement_id,logged_on").eq("logged_on",localDate(new Date())),
  ]);
  const latest=new Map<string,{value:number;recorded_at:string;source:string}>();for(const row of metrics??[]){if(!latest.has(row.metric_type))latest.set(row.metric_type,{value:Number(row.value),recorded_at:row.recorded_at,source:row.source})}
  const meals=nutrition??[];const nutritionTotal=meals.reduce((sum,row)=>({calories:sum.calories+Number(row.calories||0),protein:sum.protein+Number(row.protein_g||0),carbs:sum.carbs+Number(row.carbs_g||0),fat:sum.fat+Number(row.fat_g||0)}),{calories:0,protein:0,carbs:0,fat:0});
  const todaySession=Array.isArray(plan?.schedule)?(plan.schedule as Array<{dayIndex:number;title:string;duration:number}>).find((item)=>item.dayIndex===new Date().getDay()):null;
  const supplementsDone=new Set((supplementLogs??[]).map((row)=>row.supplement_id));

  return <main className="py-mobile-shell md:py-shell-narrow">
    <header className="mb-7"><h1 className="py-title">Health</h1><p className="py-subtitle">Nutrition, training, supplements, and body signals in one connected health layer.</p></header>

    <Link href="/health/scan-meal" className="py-glass-hero py-pressable block p-5 sm:p-6"><div className="flex items-start justify-between gap-4"><div><h2 className="m-0 text-[25px] font-semibold tracking-[-.035em] text-white">Nutrition AI</h2><p className="m-0 mt-2 max-w-[350px] text-[12.5px] leading-relaxed text-[#C9C5D4]">Photograph food, review the estimate, and let Coach reason from what you have actually eaten.</p></div><span className="flex h-11 w-11 items-center justify-center rounded-[16px] border border-white/10 bg-white/[.06] text-[20px] text-white">◎</span></div>{meals.length?<div className="mt-5 flex items-end justify-between gap-4"><div><div className="text-[34px] font-bold tracking-[-.045em] text-white">{Math.round(nutritionTotal.calories)} <span className="text-[13px] font-medium text-[#AAA4B7]">kcal today</span></div><div className="mt-1 text-[11px] text-[#AAA4B7]">{meals.length} meal{meals.length===1?"":"s"} logged</div></div><div className="text-right text-[11px] leading-5 text-[#C9C5D4]">P {round(nutritionTotal.protein)}g<br/>C {round(nutritionTotal.carbs)}g · F {round(nutritionTotal.fat)}g</div></div>:<div className="mt-5 text-[12px] font-semibold text-white">Log your first meal →</div>}</Link>

    <section className="mt-4 grid grid-cols-2 gap-3"><Link href="/fitness" className="py-glass-soft py-pressable p-4"><span className="py-icon-tile text-accent-text"><NavIcon name="fitness" className="h-5 w-5"/></span><div className="mt-4 text-[15px] font-semibold text-text-1">Training</div><div className="mt-1 text-[11px] leading-relaxed text-text-3">{todaySession?`${todaySession.title} · ${todaySession.duration} min today`:plan?`${plan.days_per_week} day plan active`:"Build an AI-assisted plan"}</div></Link><Link href="/supplements" className="py-glass-soft py-pressable p-4"><span className="py-icon-tile text-accent-text"><NavIcon name="supplements" className="h-5 w-5"/></span><div className="mt-4 text-[15px] font-semibold text-text-1">Supplements</div><div className="mt-1 text-[11px] leading-relaxed text-text-3">{(supplements??[]).length?`${supplementsDone.size}/${(supplements??[]).length} logged today`:"Add your existing routine"}</div></Link></section>

    <section className="mt-7"><div className="mb-3 flex items-end justify-between"><div><h2 className="m-0 text-[20px] font-semibold tracking-[-.025em] text-text-1">Body signals</h2><p className="m-0 mt-1 text-[11px] text-text-3">Only real entries appear here.</p></div><Link href="/integrations" className="text-[11.5px] font-semibold text-accent-text">Connections</Link></div>{latest.size?<div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{[...latest.entries()].slice(0,6).map(([key,item])=>{const meta=LABELS[key]??{label:key.replaceAll("_"," "),unit:""};return <div key={key} className="py-glass-soft p-4"><div className="text-[10px] text-text-3">{meta.label}</div><div className="mt-2 text-[24px] font-semibold tracking-[-.035em] text-text-1">{formatValue(key,item.value)}{meta.unit&&<span className="ml-1 text-[10px] font-medium text-text-3">{meta.unit}</span>}</div></div>})}</div>:<div className="py-glass-soft p-4 text-[12px] leading-relaxed text-text-3">No body signals yet. Add only the metrics you actually want Project You+ to use.</div>}</section>

    <div className="mt-4"><HealthQuickEntry/></div>

    {meals.length>0&&<section className="mt-7"><h2 className="m-0 mb-3 text-[20px] font-semibold tracking-[-.025em] text-text-1">Today’s meals</h2><div className="py-glass-soft divide-y divide-white/[.06] px-4">{meals.map((meal)=><div key={meal.id} className="flex items-center gap-3 py-3.5"><div className="min-w-0 flex-1"><div className="truncate text-[13px] font-semibold text-text-1">{meal.meal_name||"Meal"}</div><div className="mt-0.5 text-[10.5px] text-text-3">{meal.source==="nutrition_ai"?"Nutrition AI":"Manual"} · P {round(Number(meal.protein_g))}g</div></div><div className="text-[12px] font-semibold text-text-2">{meal.calories} kcal</div></div>)}</div></section>}
  </main>
}

function formatValue(key:string,value:number){if(key==="sleep_minutes")return `${Math.floor(value/60)}h ${Math.round(value%60)}`;return Number.isInteger(value)?String(value):value.toFixed(1)}
function round(value:number){return Math.round(value*10)/10}
function localDate(date:Date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`}
