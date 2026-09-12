"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { logHabitToday } from "@/lib/actions/habits";
import { recordHabitMinimumVersion } from "@/lib/actions/system-habits";
import type { Habit } from "@/lib/types";

export function SystemHabitCard({habit,goalTitle}:{habit:Habit;goalTitle?:string}){
  const router=useRouter();
  const [pending,startTransition]=useTransition();
  const [minimum,setMinimum]=useState(false);
  const [error,setError]=useState<string|null>(null);
  return <div className="py-glass-soft p-4">
    <div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-accent-soft text-[11px] font-bold text-accent-text">{habit.streakDays}d</span><div className="min-w-0 flex-1"><div className="text-[14px] font-semibold text-text-1">{habit.title}</div><div className="mt-1 text-[10.5px] leading-relaxed text-text-3">{goalTitle?`Supports ${goalTitle}.`:"Supports your active system."}{habit.durationMinutes?` · ${habit.durationMinutes} min`:""}</div></div></div>
    {minimum&&habit.minimumVersion&&<div className="mt-3 rounded-xl border border-accent/20 bg-accent/[.055] p-3 text-[10.5px] leading-relaxed text-text-2"><span className="font-semibold text-accent-text">Minimum version:</span> {habit.minimumVersion}</div>}
    {error&&<div role="alert" className="mt-2 text-[10px] text-red-200">{error}</div>}
    <div className="mt-3 flex gap-2">
      <button type="button" disabled={pending} onClick={()=>startTransition(async()=>{setError(null);await logHabitToday(habit.id);router.refresh();})} className="min-h-10 flex-1 rounded-xl bg-accent text-[10.5px] font-semibold text-white disabled:opacity-50">{pending?"Saving…":"Complete"}</button>
      {habit.minimumVersion&&<button type="button" disabled={pending} onClick={()=>startTransition(async()=>{setError(null);const result=await recordHabitMinimumVersion(habit.id);if(!result.ok){setError(result.error);return;}setMinimum(true);})} className="min-h-10 rounded-xl border border-white/[.08] px-3 text-[10.5px] font-semibold text-text-2 disabled:opacity-50">Minimum version</button>}
    </div>
  </div>;
}
