"use client";

import { useEffect, useMemo } from "react";
import { usePathname } from "next/navigation";
import { recordOnboardingEvent } from "@/lib/actions/onboarding";
import type { OnboardingBlueprint } from "@/lib/types";

export function OnboardingFirstValueBanner({onboarding}:{onboarding:OnboardingBlueprint|null|undefined}){
  const pathname=usePathname();
  const active=useMemo(()=>{
    if(pathname!=="/today"||!onboarding?.activatedAt)return false;
    const age=Date.now()-new Date(onboarding.activatedAt).getTime();
    return Number.isFinite(age)&&age>=0&&age<7*86_400_000;
  },[pathname,onboarding?.activatedAt]);

  useEffect(()=>{
    if(!active||typeof window==="undefined")return;
    const key=`py:first-dashboard:${onboarding?.version??"v2"}`;
    if(sessionStorage.getItem(key))return;
    sessionStorage.setItem(key,"1");
    void recordOnboardingEvent("first_dashboard_viewed",{stage:"today",completion_status:"viewed"});
  },[active,onboarding?.version]);

  if(!active)return null;
  const primary=humanize(onboarding?.primaryDomain??"starting priorities");
  const review=onboarding?.weeklyReview;
  return <div className="px-4 pt-4 sm:px-6 md:px-8 md:pt-6"><section className="py-glass-soft mx-auto max-w-[980px] p-4 sm:p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><div className="py-eyebrow text-accent-text">Coach · starting week</div><h2 className="m-0 mt-1.5 text-[17px] font-semibold tracking-[-.02em] text-text-1">Your system is active. Start with {primary.toLowerCase()}.</h2><p className="mb-0 mt-1.5 max-w-[620px] text-[11px] leading-relaxed text-text-3">Foundation — calibration in progress. Project You+ will get more accurate from completed actions, consistency, and your Weekly Review.</p></div>{review?.day!==undefined&&review?.time?<div className="shrink-0 rounded-xl border border-white/[.06] bg-white/[.025] px-3 py-2 text-right"><div className="text-[9px] uppercase tracking-[.08em] text-text-3">Next review rhythm</div><div className="mt-1 text-[11px] font-semibold text-text-1">{dayName(review.day)} · {formatTime(review.time)}</div></div>:null}</div></section></div>;
}

function humanize(value:string){return value.split("_").map(part=>part?part[0].toUpperCase()+part.slice(1):part).join(" ");}
function dayName(value:number){return ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][value]??"Weekly";}
function formatTime(value:string){const [h,m]=value.split(":").map(Number);if(!Number.isFinite(h)||!Number.isFinite(m))return value;const d=new Date();d.setHours(h,m,0,0);return d.toLocaleTimeString([], {hour:"numeric",minute:"2-digit"});}
