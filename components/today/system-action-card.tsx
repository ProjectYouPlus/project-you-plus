"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { completeSystemTask, explainBlockedSystemTask, recordSystemMinimumVersion, rescheduleSystemTask, skipSystemTask } from "@/lib/actions/today-system";
import { recordAutoBuildEvent } from "@/lib/actions/onboarding-system";
import type { Task } from "@/lib/types";
import { emitFeedback } from "@/lib/celebrations/client";

export function SystemActionCard({task,goalTitle,index,hero=false}:{task:Task;goalTitle?:string;index?:number;hero?:boolean}){
  const router=useRouter();const [pending,startTransition]=useTransition();const [mode,setMode]=useState<"none"|"reschedule"|"blocked">("none");const [date,setDate]=useState(isoLocalTomorrow());const [reason,setReason]=useState("");const [minimum,setMinimum]=useState<string|null>(null);const [error,setError]=useState<string|null>(null);
  useEffect(()=>{if(hero&&task.actionKind)void recordAutoBuildEvent("first_today_action_viewed",{stage:"today"});},[hero,task.actionKind]);
  function run(work:()=>Promise<{ok:boolean;error?:string}>,feedback=false){setError(null);startTransition(async()=>{const result=await work();if(!result.ok){setError(result.error??"Could not update this action.");return;}if(feedback)emitFeedback("task");setMode("none");router.refresh();});}
  const body=<>
    <div className="flex items-start gap-3"><span className={`${hero?"h-10 w-10":"h-8 w-8"} flex shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[.035] text-[11px] font-bold text-text-2`}>{hero?"→":`0${(index??0)+1}`}</span><span className="min-w-0 flex-1"><span className={`block font-semibold text-text-1 ${hero?"text-[19px] leading-tight":"text-[14.5px]"}`}>{task.title}</span><span className="mt-1 block text-[11px] leading-relaxed text-text-3">{goalTitle?`Moves ${goalTitle} forward.`:"A concrete action from your active system."}{task.durationMinutes?` · ${task.durationMinutes} min`:""}</span></span></div>
    {minimum&&<div className="mt-3 rounded-xl border border-accent/20 bg-accent/[.055] p-3 text-[10.5px] leading-relaxed text-text-2"><span className="font-semibold text-accent-text">Minimum version:</span> {minimum}</div>}
    {error&&<div role="alert" className="mt-3 text-[10.5px] text-red-200">{error}</div>}
    <div className="mt-4 flex flex-wrap gap-2"><button type="button" disabled={pending} onClick={()=>run(()=>completeSystemTask(task.id),true)} className="min-h-10 rounded-xl bg-accent px-4 text-[11px] font-semibold text-white disabled:opacity-50">Complete</button>{task.minimumVersion&&<button type="button" disabled={pending} onClick={()=>{setError(null);startTransition(async()=>{const result=await recordSystemMinimumVersion(task.id);if(!result.ok){setError(result.error);return;}setMinimum(result.minimumVersion);});}} className="min-h-10 rounded-xl border border-white/[.08] px-3 text-[10.5px] font-semibold text-text-2 disabled:opacity-50">Minimum version</button>}<button type="button" disabled={pending} onClick={()=>run(()=>skipSystemTask(task.id))} className="min-h-10 rounded-xl border border-white/[.08] px-3 text-[10.5px] font-semibold text-text-2 disabled:opacity-50">Skip today</button><button type="button" disabled={pending} onClick={()=>setMode(mode==="reschedule"?"none":"reschedule")} className="min-h-10 rounded-xl border border-white/[.08] px-3 text-[10.5px] font-semibold text-text-2 disabled:opacity-50">Reschedule</button><button type="button" disabled={pending} onClick={()=>setMode(mode==="blocked"?"none":"blocked")} className="min-h-10 rounded-xl border border-white/[.08] px-3 text-[10.5px] font-semibold text-text-3 disabled:opacity-50">Blocked</button></div>
    {mode==="reschedule"&&<div className="mt-3 flex gap-2"><input type="datetime-local" value={date} min={isoLocalNow()} onChange={e=>setDate(e.target.value)} className="py-input !h-10 min-w-0 flex-1 !text-[10.5px]"/><button type="button" disabled={pending||!date} onClick={()=>run(()=>rescheduleSystemTask(task.id,new Date(date).toISOString()))} className="min-h-10 rounded-xl border border-accent/30 px-3 text-[10.5px] font-semibold text-accent-text disabled:opacity-50">Save</button></div>}
    {mode==="blocked"&&<div className="mt-3"><textarea value={reason} onChange={e=>setReason(e.target.value)} maxLength={500} rows={2} placeholder="What made this hard to complete?" className="py-textarea !text-[10.5px]"/><button type="button" disabled={pending||!reason.trim()} onClick={()=>run(()=>explainBlockedSystemTask(task.id,reason))} className="mt-2 min-h-10 w-full rounded-xl border border-accent/30 text-[10.5px] font-semibold text-accent-text disabled:opacity-50">Save for Weekly Review</button></div>}
  </>;
  return hero?<div>{body}</div>:<div className="py-4">{body}</div>;
}

function isoLocalNow(){const d=new Date();d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().slice(0,16);}
function isoLocalTomorrow(){const d=new Date(Date.now()+24*60*60*1000);d.setHours(9,0,0,0);d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().slice(0,16);}
