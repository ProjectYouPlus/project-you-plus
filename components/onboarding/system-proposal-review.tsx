"use client";

import { useEffect, useMemo, useState } from "react";
import {
  approveAndActivateAutoBuiltSystem,
  deferAutoBuiltGoal,
  makeAutoBuiltSystemLighter,
  recordAutoBuildEvent,
  replaceAutoBuiltAction,
  restoreOriginalAutoBuiltSystem,
  saveAutoBuiltProposal,
} from "@/lib/actions/onboarding-system";
import type { SystemAction, SystemGoal, SystemProposal } from "@/lib/onboarding/system-schema";
import { dayName } from "@/lib/onboarding/schema";

const DAYS=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const ACTIVATION_ROWS=[
  ["goals","Activating goals"],["habits","Creating habits"],["schedule","Scheduling actions"],["metrics","Setting progress measures"],["weeklyReview","Configuring Weekly Review"],["today","Preparing Today"],
] as const;

type ActivationResult={steps?:Record<string,string>;summary?:{activeGoals:number;openActions:number;weeklyReviewDay:number;weeklyReviewTime:string}};

export function SystemProposalReview({sessionId,proposal,onProposal,onActivated}:{sessionId:string;proposal:SystemProposal;onProposal:(proposal:SystemProposal)=>void;onActivated:(result:ActivationResult)=>void}){
  const [expanded,setExpanded]=useState<string|null>(()=>proposal.goals.find(goal=>!goal.deferred)?.clientId??null);
  const [editing,setEditing]=useState(false);const [busy,setBusy]=useState<string|null>(null);const [error,setError]=useState<string|null>(null);const [activationSteps,setActivationSteps]=useState<Record<string,string>>({});
  useEffect(()=>{void recordAutoBuildEvent("proposal_viewed",{stage:"review"});},[]);
  const activeGoals=useMemo(()=>proposal.goals.filter(goal=>!goal.deferred),[proposal]);
  const scheduled=proposal.workload.scheduledSessionCount;const weekly=humanMinutes(proposal.workload.weeklyMinutes);

  function patchGoal(goalId:string,mutator:(goal:SystemGoal)=>void){const next=structuredClone(proposal);const goal=next.goals.find(item=>item.clientId===goalId);if(!goal)return;mutator(goal);onProposal(next);setError(null);}
  function patchAction(actionId:string,mutator:(action:SystemAction)=>void){const next=structuredClone(proposal);const action=next.actions.find(item=>item.clientId===actionId);if(!action)return;mutator(action);const block=next.schedule.find(item=>item.actionClientId===actionId);if(block){block.days=[...action.preferredDays];block.startTime=action.preferredTime;block.endTime=action.preferredTime?addMinutes(action.preferredTime,action.durationMinutes):null;block.conflictStatus="needs_confirmation";block.conflictReason="Rechecking this edited schedule on save.";}onProposal(next);setError(null);}
  async function save(kind:"goal_edited"|"action_edited"="action_edited"){setBusy("save");setError(null);const result=await saveAutoBuiltProposal({sessionId,proposal,event:kind});setBusy(null);if(!result.ok){setError(result.error);return false;}onProposal(result.proposal);return true;}
  async function lighter(){setBusy("lighter");setError(null);const result=await makeAutoBuiltSystemLighter(sessionId);setBusy(null);if(!result.ok){setError(result.error);return;}onProposal(result.proposal);}
  async function replace(actionId:string){setBusy(actionId);setError(null);const result=await replaceAutoBuiltAction({sessionId,actionId});setBusy(null);if(!result.ok){setError(result.error);return;}onProposal(result.proposal);}
  async function defer(goalId:string){setBusy(goalId);setError(null);const result=await deferAutoBuiltGoal({sessionId,goalId});setBusy(null);if(!result.ok){setError(result.error);return;}onProposal(result.proposal);setExpanded(result.proposal.goals.find(goal=>!goal.deferred)?.clientId??null);}
  async function restore(){setBusy("restore");setError(null);const result=await restoreOriginalAutoBuiltSystem(sessionId);setBusy(null);if(!result.ok){setError(result.error);return;}onProposal(result.proposal);}
  async function approve(){setBusy("activation");setError(null);setActivationSteps(Object.fromEntries(ACTIVATION_ROWS.map(([key])=>[key,"working"])));const result=await approveAndActivateAutoBuiltSystem({sessionId,proposal});if(!result.ok){setBusy(null);setActivationSteps({});setError(result.error);return;}setActivationSteps(result.steps??{});setBusy(null);onActivated({steps:result.steps,summary:result.summary});}

  if(busy==="activation")return <ActivationProgress steps={activationSteps}/>;
  return <div className="pb-7">
    <div className="py-eyebrow text-accent-text">Review before activation</div>
    <h1 className="m-0 mt-2 text-[31px] font-bold leading-[1.06] tracking-[-.045em] text-white">Your first Project You+ system</h1>
    <p className="mb-0 mt-3 text-[12.5px] leading-relaxed text-text-2">Built around your goals, responsibilities, available time, and the challenges you identified.</p>

    <section className="py-glass-soft mt-6 grid grid-cols-2 gap-px overflow-hidden p-0 sm:grid-cols-5">
      <Stat value={String(activeGoals.length)} label="Goals"/><Stat value={weekly} label="Weekly time"/><Stat value={String(scheduled)} label="Scheduled"/><Stat value={String(proposal.workload.dailyHabitCount)} label="Daily habits"/><Stat value={`${dayName(proposal.weeklyReview.day)} ${shortTime(proposal.weeklyReview.time)}`} label="Weekly Review" wide/>
    </section>

    <div className="mt-4 rounded-2xl border border-accent/20 bg-accent/[.055] p-4"><div className="text-[11px] font-semibold text-accent-text">How this responds to your friction</div><p className="mb-0 mt-1.5 text-[11px] leading-relaxed text-text-2">{proposal.frictionSummary}</p></div>

    {proposal.metadata.missingInformation.length>0&&<div className="mt-3 rounded-2xl border border-amber-300/15 bg-amber-300/[.045] p-4"><div className="text-[11px] font-semibold text-amber-100">Targets that still need confirmation</div><div className="mt-2 space-y-1.5">{proposal.metadata.missingInformation.map(item=><div key={item.key} className="text-[10.5px] leading-relaxed text-text-2">{item.label}</div>)}</div></div>}

    <div className="mt-5 space-y-3">{proposal.goals.map(goal=><GoalCard key={goal.clientId} goal={goal} proposal={proposal} expanded={expanded===goal.clientId} editing={editing} busy={busy} onToggle={()=>setExpanded(expanded===goal.clientId?null:goal.clientId)} onPatchGoal={mutator=>patchGoal(goal.clientId,mutator)} onPatchAction={(actionId,mutator)=>patchAction(actionId,mutator)} onReplace={replace} onDefer={()=>defer(goal.clientId)}/>)}</div>

    {proposal.workload.reductions.length>0&&<section className="py-glass-soft mt-4 p-4"><div className="text-[12px] font-semibold text-text-1">Starting phase</div><div className="mt-1 text-[11px] text-accent-text">{proposal.workload.phaseLabel}</div><ul className="mb-0 mt-2 space-y-1 pl-4 text-[10.5px] leading-relaxed text-text-3">{proposal.workload.reductions.map((item,index)=><li key={`${item}-${index}`}>{item}</li>)}</ul></section>}

    <div className="mt-5 grid grid-cols-2 gap-2"><button type="button" disabled={Boolean(busy)} onClick={lighter} className="min-h-[48px] rounded-2xl border border-white/[.09] bg-white/[.025] px-3 text-[11.5px] font-semibold text-text-1 disabled:opacity-50">{busy==="lighter"?"Reducing…":"Make this plan lighter"}</button><button type="button" disabled={Boolean(busy)} onClick={restore} className="min-h-[48px] rounded-2xl border border-white/[.09] px-3 text-[11.5px] font-semibold text-text-2 disabled:opacity-50">Restore recommendation</button></div>

    <div className="mt-5 rounded-2xl border border-white/[.06] bg-white/[.025] p-4 text-[10.5px] leading-relaxed text-text-3">Nothing becomes active until you approve it. Changing a goal, action, day, time, or frequency is revalidated on the server against your current Project You+ context.</div>
    {error&&<div role="alert" className="mt-4 rounded-2xl border border-red-400/20 bg-red-500/10 p-3 text-[11px] leading-relaxed text-red-200">{error}</div>}

    <div className="sticky bottom-0 z-20 -mx-5 mt-6 border-t border-white/[.06] bg-bg/95 px-5 pb-[calc(14px+env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl sm:-mx-7 sm:px-7"><div className="mx-auto flex max-w-[486px] gap-2"><button type="button" disabled={Boolean(busy)} onClick={async()=>{if(editing){const ok=await save("goal_edited");if(ok)setEditing(false);}else setEditing(true);}} className="min-h-[50px] flex-1 rounded-2xl border border-white/[.09] text-[12px] font-semibold text-text-1 disabled:opacity-50">{editing?(busy==="save"?"Saving…":"Done adjusting"):"Adjust my plan"}</button><button type="button" disabled={Boolean(busy)||proposal.activationWarnings.some(w=>w.toLowerCase().includes("resolve schedule"))} onClick={approve} className="py-liquid-button min-h-[50px] flex-[1.5] disabled:opacity-50">Approve and build my system</button></div></div>
  </div>;
}

function GoalCard({goal,proposal,expanded,editing,busy,onToggle,onPatchGoal,onPatchAction,onReplace,onDefer}:{goal:SystemGoal;proposal:SystemProposal;expanded:boolean;editing:boolean;busy:string|null;onToggle:()=>void;onPatchGoal:(fn:(goal:SystemGoal)=>void)=>void;onPatchAction:(actionId:string,fn:(action:SystemAction)=>void)=>void;onReplace:(actionId:string)=>void;onDefer:()=>void}){
  const actions=proposal.actions.filter(action=>action.linkedGoalClientId===goal.clientId&&!action.deferred);const weekly=actions.reduce((sum,action)=>sum+action.durationMinutes*occurrences(action),0);const minimum=actions.find(action=>action.minimumVersion)?.minimumVersion;
  return <section className={`overflow-hidden rounded-[22px] border transition ${goal.deferred?"border-white/[.05] bg-white/[.015] opacity-55":"border-white/[.075] bg-white/[.028]"}`}>
    <button type="button" onClick={onToggle} className="flex min-h-[82px] w-full items-center gap-4 p-4 text-left"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-accent/10 text-[11px] font-bold text-accent-text">{String(goal.priority).padStart(2,"0")}</span><span className="min-w-0 flex-1"><span className="block text-[9.5px] font-semibold uppercase tracking-[.12em] text-text-3">{goal.domain}{goal.deferred?" · deferred":""}</span><span className="mt-1 block text-[15px] font-semibold leading-tight text-white">{goal.title}</span></span><span className="text-[20px] text-text-3">{expanded?"−":"+"}</span></button>
    {expanded&&<div className="border-t border-white/[.06] px-4 pb-5 pt-4">
      {editing?<><Label>Goal</Label><input value={goal.title} onChange={e=>onPatchGoal(g=>{g.title=e.target.value.slice(0,180);})} className="py-input"/><Label className="mt-3">Desired outcome</Label><textarea value={goal.desiredOutcome} onChange={e=>onPatchGoal(g=>{g.desiredOutcome=e.target.value.slice(0,500);})} rows={3} className="py-textarea"/></>:<><div className="text-[11px] font-semibold text-text-1">Why this structure</div><p className="mb-0 mt-1.5 text-[10.5px] leading-relaxed text-text-3">{goal.rationale}</p></>}
      <Detail title="Success measurement"><div className="space-y-2">{goal.successMetrics.map(metric=><div key={metric.id} className="flex items-start justify-between gap-4 text-[10.5px]"><span className="text-text-2">{metric.name}</span><span className="text-right text-text-3">{metric.targetLabel??(metric.needsConfirmation?"Needs confirmation":metric.entryFrequency)}</span></div>)}</div></Detail>
      {goal.milestones.length>0&&<Detail title="Milestones"><div className="space-y-1.5">{goal.milestones.map(m=><div key={m.id} className="text-[10.5px] text-text-2">{m.title}{m.targetValue!=null?` · ${formatValue(m.targetValue,m.unit)}`:""}</div>)}</div></Detail>}
      <Detail title="Scheduled actions"><div className="space-y-3">{actions.map(action=><ActionEditor key={action.clientId} action={action} editing={editing} busy={busy===action.clientId} onPatch={fn=>onPatchAction(action.clientId,fn)} onReplace={()=>onReplace(action.clientId)}/>)}</div></Detail>
      <div className="mt-4 grid grid-cols-2 gap-2"><Mini label="Review cadence" value={goal.domain==="money"?"Weekly + monthly":"Weekly Review"}/><Mini label="Expected weekly time" value={humanMinutes(weekly)}/></div>
      {minimum&&<div className="mt-3 rounded-xl border border-white/[.055] bg-white/[.02] p-3"><div className="text-[9px] font-semibold uppercase tracking-[.1em] text-text-3">Minimum version</div><div className="mt-1 text-[10.5px] leading-relaxed text-text-2">{minimum}</div></div>}
      {!goal.deferred&&proposal.goals.filter(g=>!g.deferred).length>1&&<button type="button" disabled={Boolean(busy)} onClick={onDefer} className="mt-4 min-h-11 w-full rounded-xl border border-white/[.07] text-[10.5px] font-semibold text-text-3 disabled:opacity-50">Defer this goal from the starting week</button>}
    </div>}
  </section>;
}

function ActionEditor({action,editing,busy,onPatch,onReplace}:{action:SystemAction;editing:boolean;busy:boolean;onPatch:(fn:(action:SystemAction)=>void)=>void;onReplace:()=>void}){return <div className="rounded-xl border border-white/[.055] bg-black/10 p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="text-[11.5px] font-semibold text-text-1">{action.title}</div><div className="mt-1 text-[9.5px] text-text-3">{frequencyLabel(action)} · {action.durationMinutes} min</div></div>{editing&&<button type="button" disabled={busy} onClick={onReplace} className="min-h-9 shrink-0 rounded-lg border border-white/[.07] px-2.5 text-[9.5px] font-semibold text-text-3 disabled:opacity-50">{busy?"Replacing…":"Replace"}</button>}</div>{action.minimumVersion&&<div className="mt-2 text-[10px] leading-relaxed text-text-3">Minimum: {action.minimumVersion}</div>}{editing&&<div className="mt-3 space-y-3"><div className="grid grid-cols-7 gap-1">{DAYS.map((day,index)=><button type="button" key={day} onClick={()=>onPatch(a=>{a.preferredDays=a.preferredDays.includes(index)?a.preferredDays.filter(d=>d!==index):[...a.preferredDays,index].sort();})} className={`min-h-9 rounded-lg border text-[8.5px] font-semibold ${action.preferredDays.includes(index)?"border-accent/50 bg-accent/12 text-white":"border-white/[.055] text-text-3"}`}>{day}</button>)}</div><div className="grid grid-cols-2 gap-2"><select value={action.frequency} onChange={e=>onPatch(a=>{a.frequency=e.target.value as SystemAction["frequency"];a.targetPerWeek=a.frequency==="daily"?7:a.frequency==="weekdays"?5:a.frequency==="weekly"?1:a.targetPerWeek;})} className="py-input !h-10 !text-[10px]"><option value="once">Once</option><option value="daily">Daily</option><option value="weekdays">Weekdays</option><option value="weekly">Weekly</option><option value="n_per_week">Times / week</option></select><input type="time" value={action.preferredTime??""} onChange={e=>onPatch(a=>{a.preferredTime=e.target.value||null;})} className="py-input !h-10 !text-[10px]"/></div>{action.frequency==="n_per_week"&&<input type="number" min={1} max={7} value={action.targetPerWeek??1} onChange={e=>onPatch(a=>{a.targetPerWeek=Math.max(1,Math.min(7,Number(e.target.value)||1));a.preferredDays=a.preferredDays.slice(0,a.targetPerWeek);})} className="py-input !h-10 !text-[10px]"/>}</div>}</div>}

function ActivationProgress({steps}:{steps:Record<string,string>}){return <div className="pt-[5vh]"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-accent/25 bg-accent/10"><span className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent"/></div><h1 className="m-0 mt-7 text-center text-[30px] font-bold tracking-[-.04em] text-white">Creating your Project You+ system</h1><p className="mx-auto mb-0 mt-3 max-w-[390px] text-center text-[12px] leading-relaxed text-text-2">Each status below reflects real activation work. Nothing is marked complete before the server confirms it.</p><div className="py-glass-soft mt-8 divide-y divide-white/[.06] px-4">{ACTIVATION_ROWS.map(([key,label])=><div key={key} className="flex min-h-[58px] items-center gap-3"><Status status={steps[key]??"pending"}/><span className="flex-1 text-[12.5px] font-medium text-text-1">{label}</span><span className="text-[10px] capitalize text-text-3">{statusText(steps[key]??"pending")}</span></div>)}</div></div>}
function Status({status}:{status:string}){const done=status==="completed",deferred=status==="deferred";return <span className={`flex h-6 w-6 items-center justify-center rounded-full border text-[10px] ${done?"border-emerald-400/30 bg-emerald-400/10 text-emerald-300":deferred?"border-white/[.07] bg-white/[.03] text-text-3":"border-accent/25 bg-accent/10 text-accent-text"}`}>{done?"✓":deferred?"–":"·"}</span>}
function Detail({title,children}:{title:string;children:React.ReactNode}){return <div className="mt-4 border-t border-white/[.05] pt-3"><div className="mb-2 text-[9px] font-semibold uppercase tracking-[.1em] text-text-3">{title}</div>{children}</div>}
function Mini({label,value}:{label:string;value:string}){return <div className="rounded-xl border border-white/[.055] bg-white/[.018] p-3"><div className="text-[8.5px] font-semibold uppercase tracking-[.1em] text-text-3">{label}</div><div className="mt-1 text-[10.5px] font-semibold text-text-1">{value}</div></div>}
function Label({children,className=""}:{children:React.ReactNode;className?:string}){return <label className={`mb-2 block text-[9px] font-semibold uppercase tracking-[.1em] text-text-3 ${className}`}>{children}</label>}
function Stat({value,label,wide=false}:{value:string;label:string;wide?:boolean}){return <div className={`min-h-[74px] border-white/[.055] p-3 ${wide?"col-span-2 sm:col-span-1":""}`}><div className="text-[14px] font-bold text-white">{value}</div><div className="mt-1 text-[8.5px] font-semibold uppercase tracking-[.08em] text-text-3">{label}</div></div>}
function occurrences(action:SystemAction){return action.frequency==="daily"?7:action.frequency==="weekdays"?5:action.frequency==="weekly"?1:action.frequency==="n_per_week"?(action.targetPerWeek??1):1;}
function frequencyLabel(action:SystemAction){if(action.frequency==="n_per_week")return `${action.targetPerWeek??1}× / week`;if(action.frequency==="weekdays")return"Weekdays";if(action.frequency==="daily")return"Daily";if(action.frequency==="weekly")return"Weekly";return"One time";}
function humanMinutes(minutes:number){if(minutes<60)return`${minutes} min`;const hours=Math.floor(minutes/60),rest=minutes%60;return rest?`${hours}h ${rest}m`:`${hours}h`;}
function shortTime(value:string){const [h,m]=value.split(":").map(Number);const suffix=h>=12?"PM":"AM";const hour=h%12||12;return `${hour}:${String(m).padStart(2,"0")} ${suffix}`;}
function addMinutes(value:string,delta:number){const [h,m]=value.split(":").map(Number);const total=((h*60+m+delta)%1440+1440)%1440;return `${String(Math.floor(total/60)).padStart(2,"0")}:${String(total%60).padStart(2,"0")}`;}
function formatValue(value:number,unit:string|null){if(unit==="USD")return`$${value.toLocaleString()}`;return`${value.toLocaleString()}${unit?` ${unit}`:""}`;}
function statusText(value:string){if(value==="completed")return"Completed";if(value==="deferred")return"Deferred";if(value==="working")return"Working";return"Pending";}
