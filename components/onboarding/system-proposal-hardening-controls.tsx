"use client";

import { useMemo, useState } from "react";
import { recordAutoBuildEvent, saveAutoBuiltProposal } from "@/lib/actions/onboarding-system";
import { proposalStillMatchesExisting, type ExistingSystemMatch } from "@/lib/onboarding/system-existing";
import type { SystemGoal, SystemProposal } from "@/lib/onboarding/system-schema";

export function SystemProposalHardeningControls({sessionId,proposal,existingMatches,onProposal}:{sessionId:string;proposal:SystemProposal;existingMatches:ExistingSystemMatch[];onProposal:(proposal:SystemProposal)=>void}){
  const activeGoals=proposal.goals.filter(goal=>!goal.deferred);
  const visibleMatches=existingMatches.filter(match=>proposalStillMatchesExisting(proposal,match));
  const financeGoals=activeGoals.filter(goal=>goal.domain==="money"&&goal.targetValue!=null);
  const [busy,setBusy]=useState<string|null>(null);
  const [error,setError]=useState<string|null>(null);

  async function removeGoal(goalId:string){
    if(activeGoals.length<=1){setError("Keep at least one goal in your starting system.");return;}
    setBusy(`remove:${goalId}`);setError(null);
    const next=structuredClone(proposal);
    next.goals=next.goals.filter(goal=>goal.clientId!==goalId);
    const removedActions=new Set(next.actions.filter(action=>action.linkedGoalClientId===goalId).map(action=>action.clientId));
    next.actions=next.actions.filter(action=>action.linkedGoalClientId!==goalId);
    next.schedule=next.schedule.filter(block=>block.linkedGoalClientId!==goalId&&!removedActions.has(block.actionClientId));
    next.metrics=next.metrics.filter(metric=>metric.linkedGoalClientId!==goalId);
    next.weeklyReview.goalCheckpoints=(next.weeklyReview.goalCheckpoints??[]).filter(checkpoint=>checkpoint.linkedGoalClientId!==goalId);
    next.today.priorityActionClientIds=next.today.priorityActionClientIds.filter(id=>!removedActions.has(id));
    next.today.habitActionClientIds=next.today.habitActionClientIds.filter(id=>!removedActions.has(id));
    if(removedActions.has(next.today.firstMeaningfulActionClientId))next.today.firstMeaningfulActionClientId=next.actions.find(action=>!action.deferred)?.clientId??"";
    const result=await saveAutoBuiltProposal({sessionId,proposal:next});
    setBusy(null);
    if(!result.ok){setError(result.error);return;}
    onProposal(result.proposal);
    void recordAutoBuildEvent("goal_edited",{stage:"review",change_type:"remove"});
  }

  return <>
    {visibleMatches.length>0&&<section className="mb-4 rounded-2xl border border-emerald-300/15 bg-emerald-300/[.045] p-4">
      <div className="text-[11px] font-semibold text-emerald-100">Existing Project You+ items found</div>
      <p className="mb-0 mt-1.5 text-[10.5px] leading-relaxed text-text-2">Approval will connect these recommendations to your existing records instead of creating duplicates. Rename the proposed item while adjusting the plan only if you intentionally want a separate record.</p>
      <div className="mt-3 space-y-1.5">{visibleMatches.map(match=><div key={`${match.kind}:${match.proposalClientId}`} className="flex items-center justify-between gap-3 rounded-xl border border-white/[.05] bg-black/10 px-3 py-2"><span className="truncate text-[10.5px] font-medium text-text-1">{match.existingTitle}</span><span className="shrink-0 text-[8.5px] font-semibold uppercase tracking-[.08em] text-emerald-200">Connect existing {match.kind}</span></div>)}</div>
    </section>}

    {activeGoals.length>1&&<section className="mb-4 rounded-2xl border border-white/[.065] bg-white/[.022] p-4">
      <div className="text-[11px] font-semibold text-text-1">Starting-goal controls</div>
      <p className="mb-0 mt-1 text-[10px] leading-relaxed text-text-3">Remove a goal entirely from this proposal, or use its goal card below to defer it from the starting week. Restore recommendation can bring removed items back.</p>
      <div className="mt-3 space-y-2">{activeGoals.map(goal=><div key={goal.clientId} className="flex items-center gap-3"><span className="min-w-0 flex-1 truncate text-[10.5px] text-text-2">{goal.title}</span><button type="button" disabled={Boolean(busy)} onClick={()=>removeGoal(goal.clientId)} className="min-h-9 shrink-0 rounded-lg border border-white/[.07] px-3 text-[9.5px] font-semibold text-text-3 disabled:opacity-50">{busy===`remove:${goal.clientId}`?"Removing…":"Remove"}</button></div>)}</div>
    </section>}

    {financeGoals.map(goal=><FinanceTargetEditor key={goal.clientId} goal={goal} sessionId={sessionId} proposal={proposal} busy={busy} setBusy={setBusy} onProposal={onProposal} onError={setError}/>) }
    {error&&<div role="alert" className="mb-4 rounded-2xl border border-red-400/20 bg-red-500/10 p-3 text-[10.5px] leading-relaxed text-red-200">{error}</div>}
  </>;
}

function FinanceTargetEditor({goal,sessionId,proposal,busy,setBusy,onProposal,onError}:{goal:SystemGoal;sessionId:string;proposal:SystemProposal;busy:string|null;setBusy:(value:string|null)=>void;onProposal:(proposal:SystemProposal)=>void;onError:(value:string|null)=>void}){
  const [target,setTarget]=useState(goal.targetValue==null?"":String(goal.targetValue));
  const [current,setCurrent]=useState(goal.currentValue==null?"":String(goal.currentValue));
  const [date,setDate]=useState(goal.targetDate??"");
  const scenarios=useMemo(()=>scenarioOptions(numberOrNull(target),numberOrNull(current)),[target,current]);

  async function apply(){
    const targetValue=numberOrNull(target),currentValue=numberOrNull(current);
    if(targetValue==null||targetValue<=0){onError("Enter a valid savings target before applying finance details.");return;}
    if(currentValue!=null&&currentValue<0){onError("Current saved amount cannot be negative.");return;}
    setBusy(`finance:${goal.clientId}`);onError(null);
    const next=structuredClone(proposal),draft=next.goals.find(item=>item.clientId===goal.clientId);if(!draft){setBusy(null);return;}
    draft.targetValue=targetValue;draft.targetUnit="USD";draft.measurableTarget=`$${formatMoney(targetValue)}`;draft.currentValue=currentValue;draft.targetDate=date||null;
    const result=await saveAutoBuiltProposal({sessionId,proposal:next});
    setBusy(null);
    if(!result.ok){onError(result.error);return;}
    onProposal(result.proposal);
    void recordAutoBuildEvent("goal_edited",{stage:"review",change_type:"finance_targets"});
  }

  return <section className="mb-4 rounded-2xl border border-amber-300/15 bg-amber-300/[.035] p-4">
    <div className="text-[11px] font-semibold text-amber-100">Confirm savings pace · {goal.title}</div>
    <p className="mb-0 mt-1.5 text-[10px] leading-relaxed text-text-3">These values are optional for activation, but Project You+ will not calculate a monthly contribution until the target, current amount, and timeline are confirmed.</p>
    <div className="mt-3 grid grid-cols-2 gap-2"><Field label="Savings target"><input type="number" min="0.01" step="0.01" value={target} onChange={event=>setTarget(event.target.value)} className="py-input !h-10 !text-[10px]"/></Field><Field label="Already saved"><input type="number" min="0" step="0.01" value={current} onChange={event=>setCurrent(event.target.value)} placeholder="Needs confirmation" className="py-input !h-10 !text-[10px]"/></Field></div>
    <div className="mt-2"><Field label="Target date"><input type="date" value={date} onChange={event=>setDate(event.target.value)} className="py-input !h-10 !text-[10px]"/></Field></div>
    {!date&&scenarios.length>0&&<div className="mt-3"><div className="text-[8.5px] font-semibold uppercase tracking-[.09em] text-text-3">Editable timeline scenarios</div><div className="mt-2 grid grid-cols-3 gap-1.5">{scenarios.map(option=><button type="button" key={option.months} onClick={()=>setDate(dateAfterMonths(option.months))} className="rounded-xl border border-white/[.06] bg-black/10 px-2 py-2.5 text-left"><span className="block text-[10px] font-semibold text-text-1">{option.months} mo</span><span className="mt-0.5 block text-[8.5px] leading-tight text-text-3">${formatMoney(option.monthly)}/mo</span></button>)}</div></div>}
    <button type="button" disabled={Boolean(busy)} onClick={apply} className="mt-3 min-h-10 w-full rounded-xl border border-amber-200/15 bg-amber-200/[.05] text-[10.5px] font-semibold text-amber-100 disabled:opacity-50">{busy===`finance:${goal.clientId}`?"Recalculating…":"Apply finance details"}</button>
    {proposal.financialFocus?.calculation&&proposal.financialFocus.title===goal.title&&<div className="mt-3 rounded-xl border border-white/[.05] bg-black/10 p-3 text-[10px] leading-relaxed text-text-2">{proposal.financialFocus.calculation} · about ${formatMoney(proposal.financialFocus.weeklyEquivalent??0)}/week. This is a planning target only; Project You+ does not move money automatically.</div>}
  </section>;
}

function Field({label,children}:{label:string;children:React.ReactNode}){return <label className="block"><span className="mb-1.5 block text-[8.5px] font-semibold uppercase tracking-[.08em] text-text-3">{label}</span>{children}</label>}
function numberOrNull(value:string){if(!value.trim())return null;const parsed=Number(value);return Number.isFinite(parsed)?parsed:null;}
function scenarioOptions(target:number|null,current:number|null){if(target==null||current==null||target<=current)return[];const remaining=target-current;return[6,12,18].map(months=>({months,monthly:roundMoney(remaining/months),weekly:roundMoney(remaining/months*12/52)}));}
function dateAfterMonths(months:number){const now=new Date(),date=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()+months,now.getUTCDate()));return date.toISOString().slice(0,10);}
function roundMoney(value:number){return Math.round((value+Number.EPSILON)*100)/100;}
function formatMoney(value:number){return roundMoney(value).toLocaleString("en-US",{maximumFractionDigits:2});}
