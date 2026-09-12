import type { UserContext } from "@/lib/ai/context";
import type { OnboardingAnswers } from "@/lib/onboarding/schema";
import type { SystemProposal } from "@/lib/onboarding/system-schema";

type Busy={day:number;start:number;end:number;label:string};
const DAY=1440;

export function revalidateSystemSchedule(proposal:SystemProposal,answers:OnboardingAnswers,context:UserContext):SystemProposal{
  const next=structuredClone(proposal);const busy=buildBusy(answers,context);
  for(const block of next.schedule){
    const action=next.actions.find(item=>item.clientId===block.actionClientId);
    if(!action)continue;
    block.days=[...action.preferredDays];
    if(action.deferred){block.startTime=null;block.endTime=null;block.conflictStatus="needs_confirmation";block.conflictReason="Action deferred from the starting system.";continue;}
    if(action.preferredTime){block.startTime=action.preferredTime;block.endTime=plus(action.preferredTime,action.durationMinutes);}
    if(!block.startTime||!block.days.length){block.conflictStatus="needs_confirmation";block.conflictReason="No exact schedule block was confirmed.";continue;}
    const conflicts=block.days.flatMap(day=>overlaps(day,block.startTime!,action.durationMinutes,busy));
    block.conflictStatus=conflicts.length?"conflict":"clear";
    block.conflictReason=conflicts.length?`Conflicts with ${conflicts[0]}.`:null;
  }
  next.activationWarnings=next.activationWarnings.filter(item=>!item.toLowerCase().includes("schedule conflict"));
  if(next.schedule.some(block=>block.conflictStatus==="conflict"))next.activationWarnings.push("Resolve schedule conflicts before activation.");
  next.workload.scheduledSessionCount=next.schedule.filter(block=>block.startTime&&block.conflictStatus==="clear").reduce((sum,block)=>sum+block.days.length,0);
  return next;
}

function buildBusy(answers:OnboardingAnswers,context:UserContext){
  const rows:Busy[]=[];
  if(answers.life.work.type==="fixed")for(const day of answers.life.work.days)rows.push(...recurring(day,answers.life.work.startTime,answers.life.work.endTime,"Work"));
  for(const item of answers.life.commitments)for(const day of item.days)rows.push(...recurring(day,item.startTime,item.endTime,item.label));
  for(const work of context.workSchedule)for(const day of work.days)rows.push(...recurring(day,work.startTime,work.endTime,work.label||"Work"));
  const timezone=context.profile.timezone||"UTC";
  for(const event of context.schedule){const start=new Date(event.startAt),end=new Date(event.endAt);if(Number.isNaN(start.getTime())||Number.isNaN(end.getTime()))continue;const day=weekday(start,timezone),s=minutes(time(start,timezone)),e=minutes(time(end,timezone));if(e>s)rows.push({day,start:s,end:e,label:event.title||"Calendar event"});}
  const sleep=answers.life.wakeSleep;if(sleep.mode==="fixed"&&sleep.wakeTime&&sleep.sleepTime){const wake=minutes(sleep.wakeTime),bed=minutes(sleep.sleepTime);for(let day=0;day<7;day++){if(wake<bed){if(wake>0)rows.push({day,start:0,end:wake,label:"Sleep"});if(bed<DAY)rows.push({day,start:bed,end:DAY,label:"Sleep"});}else if(wake>bed)rows.push({day,start:bed,end:wake,label:"Sleep"});}}
  return dedupeBusy(rows);
}
function recurring(day:number,startText:string,endText:string,label:string){const start=minutes(startText),end=minutes(endText);if(start===end)return [{day,start:0,end:DAY,label}];if(end>start)return [{day,start,end,label}];return [{day,start,end:DAY,label},{day:(day+1)%7,start:0,end,label}];}
function overlaps(day:number,startText:string,duration:number,busy:Busy[]){const start=minutes(startText),end=start+duration;return busy.filter(row=>row.day===day&&start<row.end&&end>row.start).map(row=>row.label);}
function minutes(text:string){const [h,m]=text.split(":").map(Number);return Math.max(0,Math.min(DAY,(h||0)*60+(m||0)));}
function plus(text:string,delta:number){const value=(minutes(text)+delta)%DAY;return `${String(Math.floor(value/60)).padStart(2,"0")}:${String(value%60).padStart(2,"0")}`;}
function weekday(date:Date,timezone:string){const short=new Intl.DateTimeFormat("en-US",{timeZone:timezone,weekday:"short"}).format(date);return ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].indexOf(short);}
function time(date:Date,timezone:string){const parts=new Intl.DateTimeFormat("en-US",{timeZone:timezone,hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(date);return `${parts.find(part=>part.type==="hour")?.value??"00"}:${parts.find(part=>part.type==="minute")?.value??"00"}`;}
function dedupeBusy(rows:Busy[]){const seen=new Set<string>();return rows.filter(row=>{const key=`${row.day}:${row.start}:${row.end}:${row.label}`;if(seen.has(key))return false;seen.add(key);return true;});}
