"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { toggleTaskComplete } from "@/lib/actions/tasks";
import { logHabitToday } from "@/lib/actions/habits";
import { completeWorkoutPlanSession } from "@/lib/actions/fitness";
import { logSupplementToday } from "@/lib/actions/supplements";
import { NavIcon } from "@/components/layout/nav-icon";

export type DashboardTask = { id: string; title: string; tier: string; done: boolean; goalTitle?: string | null; dueAt?: string | null; recommended?: boolean };
export type DashboardHabit = { id: string; title: string; done: boolean; streakDays: number; goalTitle?: string | null; optional?: boolean };
export type DashboardWorkout = { planId: string; sessionKey: string; title: string; focus?: string | null; duration: number; done: boolean };
export type DashboardSupplement = { id: string; name: string; dosage?: string | null; timing: string; done: boolean };
export type DashboardEvent = { id: string; title: string; startAt: string; endAt: string; source?: string | null; location?: string | null };
export type DashboardNutrition = { calories: number; protein: number; carbs: number; fat: number; meals: number };
export type DashboardDay = {
  date: string;
  performance: number | null;
  tasks: DashboardTask[];
  habits: DashboardHabit[];
  workout: DashboardWorkout | null;
  supplements: DashboardSupplement[];
  events: DashboardEvent[];
  nutrition: DashboardNutrition | null;
  workBlocks: Array<{ label: string; start: string; end: string }>;
};

export type TrajectoryProps = {
  firstName: string;
  today: string;
  currentScore: number;
  projectedScore: number;
  calibration: number;
  streak: number;
  bestStreak: number;
  weeklyWins: number;
  remainingCount: number;
  days: DashboardDay[];
  connectedCalendars: string[];
  friendCount: number;
  activeChallenges: number;
  activeAlerts: number;
  insight: string;
};

const CIRC = 439.823;

export function TrajectoryCommandCenter(props: TrajectoryProps) {
  const [selectedDate, setSelectedDate] = useState(props.today);
  const [monthOffset, setMonthOffset] = useState(0);
  const selected = props.days.find((day) => day.date === selectedDate) ?? props.days.find((day) => day.date === props.today) ?? props.days[0];
  const monthAnchor = useMemo(() => {
    const date = new Date(`${props.today}T12:00:00`);
    return new Date(date.getFullYear(), date.getMonth() + monthOffset, 1, 12, 0, 0);
  }, [props.today, monthOffset]);
  const monthDays = useMemo(() => buildMonthGrid(monthAnchor, props.days), [monthAnchor, props.days]);
  const currentColor = trajectoryColor(props.currentScore);
  const projectedColor = trajectoryColor(props.projectedScore);
  const currentDash = (props.currentScore / 100) * CIRC;
  const projectedDash = (props.projectedScore / 100) * CIRC;
  const gain = Math.max(0, props.projectedScore - props.currentScore);

  return <main className="py-mobile-shell md:py-shell-narrow">
    <header className="py-animate-in mb-5 flex items-center justify-between gap-4">
      <div><div className="text-[11px] font-medium text-text-3">{longDate(props.today)}</div><h1 className="m-0 mt-1 text-[30px] font-bold tracking-[-.045em] text-text-1">{daypart()}, {props.firstName}</h1></div>
      <Link href="/you" className="py-glass flex h-11 w-11 items-center justify-center rounded-full text-[12px] font-bold text-text-1">{props.firstName.slice(0,2).toUpperCase()}</Link>
    </header>

    <section className="py-trajectory-card py-animate-in">
      <div className="flex items-center justify-between gap-3"><div><div className="text-[11px] font-semibold tracking-[.01em] text-white/70">You+ Trajectory</div><div className="mt-1 text-[13px] font-medium text-white">{trajectoryHeadline(props.currentScore, props.calibration)}</div></div><span className="py-glass-pill text-white/75">{props.calibration}% calibrated</span></div>
      <div className="mt-5 grid grid-cols-[178px_1fr] items-center gap-4 sm:grid-cols-[200px_1fr]">
        <div className="relative mx-auto h-[176px] w-[176px] sm:h-[196px] sm:w-[196px]">
          <svg viewBox="0 0 176 176" className="h-full w-full -rotate-90 overflow-visible" aria-label={`You+ Trajectory ${props.currentScore}, projected ${props.projectedScore}`}>
            <defs><filter id="trajectoryGlow"><feGaussianBlur stdDeviation="4" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
            <circle cx="88" cy="88" r="70" fill="none" stroke="rgba(255,255,255,.07)" strokeWidth="13" />
            <circle cx="88" cy="88" r="70" fill="none" stroke={projectedColor} strokeOpacity=".32" strokeWidth="13" strokeLinecap="round" strokeDasharray={`${projectedDash} ${CIRC}`} />
            <circle cx="88" cy="88" r="70" fill="none" stroke={currentColor} strokeWidth="13" strokeLinecap="round" strokeDasharray={`${currentDash} ${CIRC}`} filter="url(#trajectoryGlow)" className="transition-all duration-700" />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center"><div className="text-[47px] font-bold tracking-[-.07em] text-white">{props.currentScore || "—"}</div><div className="-mt-1 text-[9px] font-semibold uppercase tracking-[.17em] text-white/45">now</div></div>
          {props.projectedScore > props.currentScore && <div className="absolute right-[-4px] top-[17px] rounded-full border border-white/10 bg-black/40 px-2 py-1 text-[9px] font-bold text-white/85 backdrop-blur-xl">{props.projectedScore} potential</div>}
        </div>
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[.14em] text-[#CDBAFF]">Today can move you</div>
          <div className="mt-1.5 flex items-baseline gap-2"><span className="text-[31px] font-bold tracking-[-.055em] text-white">{props.currentScore}</span><span className="text-[15px] text-white/35">→</span><span className="text-[31px] font-bold tracking-[-.055em]" style={{color:projectedColor}}>{props.projectedScore}</span></div>
          <p className="m-0 mt-2 text-[11.5px] leading-relaxed text-white/58">{props.remainingCount ? `Close ${props.remainingCount} remaining commitment${props.remainingCount===1?"":"s"} and today projects ${gain ? `+${gain} points` : "to your strongest finish"}.` : "Today’s planned commitments are closed. Protect the rest of the day."}</p>
          <div className="mt-4 flex flex-wrap gap-2"><span className="py-glass-pill text-white/70">{props.streak} day momentum</span><span className="py-glass-pill text-white/70">{props.weeklyWins} wins / 7d</span></div>
        </div>
      </div>
      <div className="mt-5 border-t border-white/[.07] pt-4"><div className="flex items-start gap-2.5"><span className="mt-[2px] h-2 w-2 shrink-0 rounded-full bg-[#A970FF] shadow-[0_0_14px_rgba(169,112,255,.7)]"/><p className="m-0 text-[11.5px] leading-relaxed text-white/62">{props.insight}</p></div></div>
    </section>

    <section className="py-animate-in mt-6">
      <div className="mb-3 flex items-end justify-between gap-3"><div><div className="text-[11px] font-medium text-text-3">Performance calendar</div><h2 className="m-0 mt-1 text-[22px] font-semibold tracking-[-.035em] text-text-1">Your month, at a glance</h2></div><div className="flex items-center gap-1"><button onClick={()=>setMonthOffset((v)=>Math.max(-1,v-1))} disabled={monthOffset<=-1} className="py-calendar-nav">‹</button><button onClick={()=>{setMonthOffset(0);setSelectedDate(props.today)}} className="px-2 text-[11px] font-semibold text-accent-text">Today</button><button onClick={()=>setMonthOffset((v)=>Math.min(1,v+1))} disabled={monthOffset>=1} className="py-calendar-nav">›</button></div></div>
      <div className="py-glass-soft overflow-hidden p-3.5 sm:p-4">
        <div className="mb-3 flex items-center justify-between gap-3"><div className="text-[15px] font-semibold text-text-1">{monthAnchor.toLocaleDateString(undefined,{month:"long",year:"numeric"})}</div><div className="flex items-center gap-2 text-[9px] text-text-3"><span>light</span><span className="h-2 w-12 rounded-full bg-gradient-to-r from-[#E9D5FF]/15 via-[#8B5CF6]/45 to-[#4C1D95]"/><span>locked in</span></div></div>
        <div className="grid grid-cols-7 gap-1.5">{["S","M","T","W","T","F","S"].map((label,index)=><div key={`${label}-${index}`} className="pb-1 text-center text-[9px] font-semibold text-text-3">{label}</div>)}{monthDays.map((cell)=>{
          const inMonth=cell.month===monthAnchor.getMonth(); const isToday=cell.date===props.today; const active=cell.date===selectedDate; const score=cell.day?.performance;
          return <button key={cell.date} onClick={()=>{if(cell.day)setSelectedDate(cell.date)}} disabled={!cell.day} className={`py-calendar-day ${toneClass(score,cell.date,props.today)} ${active?"py-calendar-day-active":""} ${!inMonth?"opacity-35":""}`}>
            <span className={`text-[11px] font-semibold ${isToday?"text-white":"text-text-2"}`}>{cell.dayNumber}</span>
            <span className="mt-1 flex h-1.5 items-center justify-center gap-[2px]">{cell.day && <><i className={cell.day.tasks.length?"py-day-dot bg-[#A970FF]":"py-day-dot bg-transparent"}/><i className={cell.day.habits.length?"py-day-dot bg-[#60A5FA]":"py-day-dot bg-transparent"}/><i className={cell.day.workout?"py-day-dot bg-[#36D98B]":"py-day-dot bg-transparent"}/><i className={cell.day.events.length?"py-day-dot bg-[#FFB84D]":"py-day-dot bg-transparent"}/></>}</span>
            {score!=null&&cell.date<=props.today?<span className="mt-1 text-[8px] font-bold text-white/55">{score}</span>:<span className="mt-1 h-[10px]"/>}
          </button>})}</div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[9px] text-text-3"><Legend color="#A970FF" label="tasks"/><Legend color="#60A5FA" label="habits"/><Legend color="#36D98B" label="training"/><Legend color="#FFB84D" label="schedule"/></div>
      </div>
    </section>

    {selected && <DayDetail day={selected} today={props.today} />}

    <section className="py-animate-in mt-6 grid grid-cols-3 gap-2.5">
      <Link href="/accountability" className="py-glass-soft py-pressable p-3.5"><NavIcon name="progress" className="h-4 w-4 text-accent-text"/><div className="mt-3 text-[18px] font-bold text-text-1">{props.friendCount}</div><div className="mt-0.5 text-[9.5px] text-text-3">accountability friends</div>{props.activeChallenges>0&&<div className="mt-2 text-[9px] font-semibold text-positive">{props.activeChallenges} challenge{props.activeChallenges===1?"":"s"} live</div>}</Link>
      <Link href="/reminders" className="py-glass-soft py-pressable p-3.5"><NavIcon name="calendar" className="h-4 w-4 text-accent-text"/><div className="mt-3 text-[18px] font-bold text-text-1">{props.activeAlerts}</div><div className="mt-0.5 text-[9.5px] text-text-3">active alerts</div><div className="mt-2 text-[9px] font-semibold text-accent-text">Protect your routine</div></Link>
      <Link href="/integrations" className="py-glass-soft py-pressable p-3.5"><NavIcon name="integrations" className="h-4 w-4 text-accent-text"/><div className="mt-3 text-[18px] font-bold text-text-1">{props.connectedCalendars.length}</div><div className="mt-0.5 text-[9.5px] text-text-3">calendar source{props.connectedCalendars.length===1?"":"s"}</div><div className="mt-2 truncate text-[9px] font-semibold text-accent-text">{props.connectedCalendars.length?props.connectedCalendars.join(" + "):"Connect calendar"}</div></Link>
    </section>

    <Link href="/coach" className="py-glass-soft py-pressable mt-4 flex items-center gap-3 p-4"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[15px] border border-accent/20 bg-accent-soft text-[11px] font-bold text-accent-text">AI</span><span className="min-w-0 flex-1"><span className="block text-[13.5px] font-semibold text-text-1">Ask Project You+ anything</span><span className="mt-0.5 block text-[10.5px] leading-relaxed text-text-3">Plan around your calendar, adjust training, choose a meal, or reason through your money.</span></span><span className="text-[19px] text-text-3">›</span></Link>
  </main>;
}

function DayDetail({day,today}:{day:DashboardDay;today:string}) {
  const isToday=day.date===today;
  const date=new Date(`${day.date}T12:00:00`);
  const completionItems = day.tasks.length + day.habits.filter((item)=>!item.optional).length + (day.workout?1:0) + day.supplements.length;
  const doneItems = day.tasks.filter((x)=>x.done).length + day.habits.filter((x)=>!x.optional&&x.done).length + (day.workout?.done?1:0) + day.supplements.filter((x)=>x.done).length;
  return <section className="py-animate-in mt-4">
    <div className="mb-3 flex items-end justify-between gap-3"><div><div className="text-[11px] font-medium text-text-3">{date.toLocaleDateString(undefined,{weekday:"long",month:"short",day:"numeric"})}</div><h2 className="m-0 mt-1 text-[21px] font-semibold tracking-[-.03em] text-text-1">{isToday?"Close the day":"Daily record"}</h2></div>{completionItems>0&&<span className="text-[11px] font-semibold text-accent-text">{doneItems}/{completionItems} complete</span>}</div>
    <div className="py-glass-soft overflow-hidden px-4">
      {day.events.length>0&&<GroupLabel label="Schedule" />}
      {day.events.map((event)=><EventRow key={event.id} event={event}/>) }
      {day.workBlocks.map((block,index)=><div key={`${block.label}-${index}`} className="py-command-row"><span className="py-source-dot bg-[#64748B]"/><div className="min-w-0 flex-1"><div className="text-[10px] font-semibold uppercase tracking-[.11em] text-text-3">Work schedule · {timeLabel(block.start)}–{timeLabel(block.end)}</div><div className="mt-0.5 truncate text-[13.5px] font-semibold text-text-1">{block.label}</div></div></div>)}
      {day.workout&&<><GroupLabel label="Training"/><WorkoutRow workout={day.workout} enabled={isToday}/></>}
      {day.tasks.length>0&&<><GroupLabel label="Tasks"/>{day.tasks.map((task)=><TaskRow key={task.id} task={task} enabled={isToday}/>)}</>}
      {day.habits.length>0&&<><GroupLabel label="Habits"/>{day.habits.map((habit)=><HabitRow key={habit.id} habit={habit} enabled={isToday}/>)}</>}
      {day.supplements.length>0&&<><GroupLabel label="Supplements"/>{day.supplements.map((item)=><SupplementRow key={item.id} supplement={item} enabled={isToday}/>)}</>}
      {day.nutrition&&<><GroupLabel label="Nutrition AI"/><div className="py-command-row"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-soft text-[10px] font-bold text-accent-text">N</span><div className="min-w-0 flex-1"><div className="text-[13.5px] font-semibold text-text-1">{day.nutrition.calories} kcal · {Math.round(day.nutrition.protein)}g protein</div><div className="mt-0.5 text-[10.5px] text-text-3">{day.nutrition.meals} meal{day.nutrition.meals===1?"":"s"} · C {Math.round(day.nutrition.carbs)}g · F {Math.round(day.nutrition.fat)}g</div></div>{isToday&&<Link href="/health/scan-meal" className="text-[10.5px] font-semibold text-accent-text">Add</Link>}</div></>}
      {!day.events.length&&!day.workBlocks.length&&!day.workout&&!day.tasks.length&&!day.habits.length&&!day.supplements.length&&!day.nutrition&&<div className="py-5 text-[12px] text-text-3">No tracked commitments or schedule for this day.</div>}
    </div>
  </section>;
}

function GroupLabel({label}:{label:string}) { return <div className="border-t border-white/[.055] pb-1 pt-3 first:border-0"><span className="text-[9px] font-semibold uppercase tracking-[.14em] text-text-3">{label}</span></div>; }
function EventRow({event}:{event:DashboardEvent}) { const source=(event.source||"Project You+").replaceAll("_"," "); return <div className="py-command-row"><span className={`py-source-dot ${source.toLowerCase().includes("google")?"bg-[#60A5FA]":source.toLowerCase().includes("apple")?"bg-white":"bg-[#FFB84D]"}`}/><div className="w-[58px] shrink-0 text-[10px] font-medium text-text-3">{new Date(event.startAt).toLocaleTimeString([],{hour:"numeric",minute:"2-digit"})}</div><div className="min-w-0 flex-1"><div className="truncate text-[13.5px] font-semibold text-text-1">{event.title}</div><div className="mt-0.5 truncate text-[10px] capitalize text-text-3">{source}{event.location?` · ${event.location}`:""}</div></div></div>; }
function WorkoutRow({workout,enabled}:{workout:DashboardWorkout;enabled:boolean}) { const action=completeWorkoutPlanSession.bind(null,workout.planId,workout.sessionKey,workout.duration); return <div className="py-command-row">{enabled?<form action={action}><Check done={workout.done} label="workout"/></form>:<Check done={workout.done} label="workout" disabled/>}<Link href="/fitness" className="min-w-0 flex-1"><div className="text-[10px] font-semibold uppercase tracking-[.11em] text-positive">{workout.duration} min · training</div><div className={`mt-0.5 truncate text-[13.5px] font-semibold ${workout.done?"text-text-3 line-through":"text-text-1"}`}>{workout.title}</div><div className="mt-0.5 truncate text-[10.5px] text-text-3">{workout.focus||"Planned workout"}</div></Link><span className="text-[18px] text-text-3">›</span></div>; }
function TaskRow({task,enabled}:{task:DashboardTask;enabled:boolean}) { const action=toggleTaskComplete.bind(null,task.id,true); return <div className="py-command-row">{enabled?<form action={action}><Check done={task.done} label="task"/></form>:<Check done={task.done} label="task" disabled/>}<Link href="/tasks" className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="text-[9.5px] font-semibold uppercase tracking-[.1em] text-[#C8AEFF]">{task.tier} task</span>{task.recommended&&<span className="rounded-full bg-accent-soft px-1.5 py-0.5 text-[8px] font-bold text-accent-text">PRIORITY</span>}</div><div className={`mt-0.5 truncate text-[13.5px] font-semibold ${task.done?"text-text-3 line-through":"text-text-1"}`}>{task.title}</div><div className="mt-0.5 truncate text-[10.5px] text-text-3">{task.goalTitle?`Advances ${task.goalTitle}`:task.dueAt?`Due ${new Date(task.dueAt).toLocaleTimeString([],{hour:"numeric",minute:"2-digit"})}`:"Unlinked action"}</div></Link></div>; }
function HabitRow({habit,enabled}:{habit:DashboardHabit;enabled:boolean}) { const action=logHabitToday.bind(null,habit.id); return <div className="py-command-row">{enabled&&!habit.optional?<form action={action}><Check done={habit.done} label="habit"/></form>:<Check done={habit.done} label="habit" disabled/>}<Link href="/habits" className="min-w-0 flex-1"><div className="text-[9.5px] font-semibold uppercase tracking-[.1em] text-[#60A5FA]">{habit.optional?"flexible habit":`${habit.streakDays} day streak`}</div><div className={`mt-0.5 truncate text-[13.5px] font-semibold ${habit.done?"text-text-3 line-through":"text-text-1"}`}>{habit.title}</div><div className="mt-0.5 truncate text-[10.5px] text-text-3">{habit.goalTitle?`Supports ${habit.goalTitle}`:habit.optional?"Complete when it fits this week":"Daily consistency"}</div></Link></div>; }
function SupplementRow({supplement,enabled}:{supplement:DashboardSupplement;enabled:boolean}) { const action=logSupplementToday.bind(null,supplement.id); return <div className="py-command-row">{enabled?<form action={action}><Check done={supplement.done} label="supplement"/></form>:<Check done={supplement.done} label="supplement" disabled/>}<Link href="/supplements" className="min-w-0 flex-1"><div className="text-[9.5px] font-semibold uppercase tracking-[.1em] text-[#F0ABFC]">{supplement.timing}</div><div className={`mt-0.5 truncate text-[13.5px] font-semibold ${supplement.done?"text-text-3 line-through":"text-text-1"}`}>{supplement.name}</div><div className="mt-0.5 text-[10.5px] text-text-3">{supplement.dosage||"Dose not specified"}</div></Link></div>; }
function Check({done,label,disabled=false}:{done:boolean;label:string;disabled?:boolean}) { return <button type="submit" disabled={done||disabled} aria-label={done?`${label} complete`:`Mark ${label} complete`} className={`py-check ${done?"py-check-done":""}`}>{done?"✓":""}</button>; }
function Legend({color,label}:{color:string;label:string}) { return <span className="flex items-center gap-1.5"><i className="h-1.5 w-1.5 rounded-full" style={{backgroundColor:color}}/>{label}</span>; }

function buildMonthGrid(anchor:Date, days:DashboardDay[]) { const map=new Map(days.map((day)=>[day.date,day])); const first=new Date(anchor.getFullYear(),anchor.getMonth(),1,12); const start=new Date(first); start.setDate(1-first.getDay()); return Array.from({length:42},(_,index)=>{const date=new Date(start);date.setDate(start.getDate()+index);const key=localDate(date);return{date:key,dayNumber:date.getDate(),month:date.getMonth(),day:map.get(key)}}); }
function toneClass(score:number|null,date:string,today:string) { if(date>today)return "py-calendar-future"; if(score==null)return "py-calendar-empty"; if(score>=90)return "py-calendar-elite"; if(score>=75)return "py-calendar-strong"; if(score>=50)return "py-calendar-building"; return "py-calendar-light"; }
function trajectoryColor(score:number) { if(score>=90)return "#5B21B6"; if(score>=75)return "#7C3AED"; if(score>=55)return "#A970FF"; if(score>=35)return "#C4B5FD"; return "#E9D5FF"; }
function trajectoryHeadline(score:number,calibration:number) { if(calibration<40)return "Your system is learning you."; if(score>=90)return "You’re operating at a rare level today."; if(score>=75)return "Strong alignment. Keep closing the loop."; if(score>=55)return "Momentum is available today."; return "Today can change the direction quickly."; }
function longDate(value:string) { return new Date(`${value}T12:00:00`).toLocaleDateString(undefined,{weekday:"long",month:"long",day:"numeric"}); }
function daypart() { const hour=new Date().getHours(); return hour<12?"Good morning":hour<18?"Good afternoon":"Good evening"; }
function localDate(date:Date) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`; }
function timeLabel(value:string) { const [h,m]=value.split(":").map(Number); return new Date(2000,0,1,h,m).toLocaleTimeString([],{hour:"numeric",minute:"2-digit"}); }
