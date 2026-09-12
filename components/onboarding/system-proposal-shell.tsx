"use client";

import Link from "next/link";
import { useState } from "react";
import { ProjectYouLogo } from "@/components/brand/project-you-logo";
import { SystemProposalHardeningControls } from "@/components/onboarding/system-proposal-hardening-controls";
import { SystemProposalReview } from "@/components/onboarding/system-proposal-review";
import type { AutoBuildSession } from "@/lib/data/onboarding-system";
import type { SystemProposal } from "@/lib/onboarding/system-schema";
import { dayName } from "@/lib/onboarding/schema";

type Summary={activeGoals:number;openActions:number;weeklyReviewDay:number;weeklyReviewTime:string};

export function SystemProposalShell({session}:{session:AutoBuildSession}){
  const [proposal,setProposal]=useState<SystemProposal>(session.proposal);
  const [ready,setReady]=useState(session.status==="completed"&&session.proposalStatus==="active");
  const [summary,setSummary]=useState<Summary|null>(null);
  return <main className="min-h-[100dvh] bg-bg text-text-1"><div className="mx-auto min-h-[100dvh] w-full max-w-[520px] px-5 pt-[max(20px,env(safe-area-inset-top))] sm:px-7">
    <header className="mb-6 flex items-center justify-center"><ProjectYouLogo className="text-[15px] font-semibold" markClassName="h-8 w-8"/></header>
    {ready?<SystemReady proposal={proposal} summary={summary}/>:<><SystemProposalHardeningControls sessionId={session.id} proposal={proposal} existingMatches={session.existingMatches} onProposal={setProposal}/><SystemProposalReview sessionId={session.id} proposal={proposal} onProposal={setProposal} onActivated={result=>{setSummary(result.summary??null);setReady(true);}}/></>}
  </div></main>;
}

function SystemReady({proposal,summary}:{proposal:SystemProposal;summary:Summary|null}){
  const activeGoals=proposal.goals.filter(goal=>!goal.deferred);const primary=activeGoals.sort((a,b)=>a.priority-b.priority)[0];const first=proposal.actions.find(action=>action.clientId===proposal.today.firstMeaningfulActionClientId&&!action.deferred)??proposal.actions.find(action=>!action.deferred);
  const scheduled=proposal.workload.scheduledSessionCount;const reviewDay=summary?.weeklyReviewDay??proposal.weeklyReview.day;const reviewTime=summary?.weeklyReviewTime??proposal.weeklyReview.time;
  return <div className="py-animate-in pb-10 pt-[3vh] text-center"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] border border-accent/25 bg-accent/10"><span className="text-[22px] font-bold text-accent-text">✓</span></div><div className="py-eyebrow mt-7 text-accent-text">Activation complete</div><h1 className="m-0 mt-2 text-[34px] font-bold tracking-[-.045em] text-white">Your system is ready.</h1><p className="mx-auto mb-0 mt-3 max-w-[390px] text-[12.5px] leading-relaxed text-text-2">Project You+ has created the approved system in your live goals, actions, schedule, progress measures, and Weekly Review.</p>
    <section className="py-glass-soft mt-7 overflow-hidden text-left">
      <ReadyRow label="Primary focus" value={primary?.title??"Your first active goal"}/>
      <ReadyRow label="Today’s first action" value={first?.title??"Open Today to begin"}/>
      <ReadyRow label="Active goals" value={String(summary?.activeGoals??activeGoals.length)}/>
      <ReadyRow label="This week’s scheduled commitments" value={String(scheduled)}/>
      <ReadyRow label="Weekly Review" value={`${dayName(reviewDay)} · ${formatTime(reviewTime)}`}/>
      <ReadyRow label="Calibration" value="Foundation — calibration in progress" last/>
    </section>
    <div className="mt-7 space-y-2.5"><Link href="/today" className="py-liquid-button flex min-h-[52px] w-full items-center justify-center">Start with Today</Link><Link href="/plan" className="flex min-h-[50px] w-full items-center justify-center rounded-2xl border border-white/[.08] text-[12px] font-semibold text-text-1">View full plan</Link></div>
    <p className="mx-auto mb-0 mt-5 max-w-[400px] text-[10.5px] leading-relaxed text-text-3">No score points or behavior achievements were awarded for accepting the plan. Project You+ will calibrate from completed actions and real evidence.</p>
  </div>;
}
function ReadyRow({label,value,last=false}:{label:string;value:string;last?:boolean}){return <div className={`flex items-start justify-between gap-4 px-4 py-4 ${last?"":"border-b border-white/[.06]"}`}><span className="text-[10px] font-semibold uppercase tracking-[.09em] text-text-3">{label}</span><span className="max-w-[60%] text-right text-[12px] font-semibold leading-snug text-text-1">{value}</span></div>}
function formatTime(value:string){const [h,m]=value.slice(0,5).split(":").map(Number);const hour=h%12||12;return `${hour}:${String(m).padStart(2,"0")} ${h>=12?"PM":"AM"}`;}
