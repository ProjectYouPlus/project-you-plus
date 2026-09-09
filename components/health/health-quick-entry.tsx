"use client";

import { useRef, useState, useTransition } from "react";
import { addHealthMetric } from "@/lib/actions/health";

export function HealthQuickEntry(){
  const formRef=useRef<HTMLFormElement>(null); const [message,setMessage]=useState<string|null>(null); const [isPending,startTransition]=useTransition();
  function submit(formData:FormData){setMessage(null);startTransition(()=>{void (async()=>{const result=await addHealthMetric(formData);if(result?.error)setMessage(result.error);else{setMessage("Saved");formRef.current?.reset();}})()})}
  return <form ref={formRef} action={submit} className="py-glass-soft p-4"><div className="py-eyebrow text-accent-text">Quick entry</div><h2 className="m-0 mt-1 text-[18px] font-semibold text-text-1">Add a real health signal</h2><div className="mt-4 grid grid-cols-[1fr_.72fr] gap-2.5"><select name="metricType" className="py-input min-h-[46px] py-2.5 text-[13px]" defaultValue="steps"><option value="steps">Steps</option><option value="sleep_minutes">Sleep minutes</option><option value="water_cups">Water cups</option><option value="weight_kg">Weight (kg)</option><option value="resting_hr">Resting HR</option></select><input name="value" type="number" step="any" min="0" required placeholder="Value" className="py-input min-h-[46px] py-2.5 text-[13px]" /></div>{message&&<div className={`mt-2 text-[11px] ${message==="Saved"?"text-positive":"text-danger"}`}>{message}</div>}<button disabled={isPending} className="py-liquid-button mt-3 w-full disabled:opacity-50">{isPending?"Saving…":"Save health signal"}</button></form>
}
