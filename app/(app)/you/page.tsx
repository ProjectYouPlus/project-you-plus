import Link from "next/link";
import { NavIcon } from "@/components/layout/nav-icon";
import { getProfile } from "@/lib/data/profile";
import { getGoals } from "@/lib/data/goals";
import { getTasks } from "@/lib/data/tasks";
import { getHabits } from "@/lib/data/habits";
import { createClient } from "@/lib/supabase/server";

export default async function YouPage() {
  const [profile, goals, tasks, habits, counts] = await Promise.all([getProfile(), getGoals(), getTasks(), getHabits(), getCounts()]);
  const name = (profile.fullName ?? "You").split(" ")[0];
  const activeGoals = goals.filter((goal) => goal.status === "active");
  const linkedTasks = tasks.filter((task) => task.goalId).length;
  const linkedHabits = habits.filter((habit) => habit.goalId).length;
  const setupChecks = [activeGoals.length > 0, habits.length > 0, counts.workSchedules > 0, counts.calendar > 0, counts.integrations > 0];
  const setupPct = Math.round((setupChecks.filter(Boolean).length / setupChecks.length) * 100);

  return <main className="py-mobile-shell md:py-shell-narrow">
    <header className="mb-7 flex items-center justify-between gap-4"><div><h1 className="py-title">{name}</h1><p className="py-subtitle">Your direction, routines, schedule, and personal settings.</p></div><Link href="/profile" className="py-glass flex h-11 w-11 items-center justify-center rounded-full text-[13px] font-bold text-text-1">{name.slice(0,2).toUpperCase()}</Link></header>

    <section className="py-glass-hero p-5"><div className="flex items-end justify-between gap-5"><div><div className="text-[39px] font-semibold tracking-[-.05em] text-white">{setupPct}%</div><div className="mt-1 text-[12px] font-medium text-white">Life context ready</div></div><div className="max-w-[210px] text-right text-[11px] leading-relaxed text-[#BDB7C9]">{setupPct===100?"Your core setup is connected. Keep it current and Coach gets sharper.":"Add the missing pieces below so Project You+ understands the constraints around your goals."}</div></div><div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/[.07]"><div className="h-full rounded-full bg-accent-2 transition-all" style={{width:`${setupPct}%`}}/></div></section>

    <section className="mt-7"><div className="mb-3"><h2 className="m-0 text-[20px] font-semibold tracking-[-.025em] text-text-1">Direction</h2><p className="m-0 mt-1 text-[11px] text-text-3">What you want, and the system supporting it.</p></div><div className="py-glass-soft divide-y divide-white/[.06] px-4"><Row href="/goals" icon="goals" title="Goals" value={`${activeGoals.length} active`} sub={activeGoals.length?activeGoals.slice(0,2).map((goal)=>goal.title).join(" · "):"Create the outcomes Project You+ should optimize for"}/><Row href="/tasks" icon="tasks" title="Tasks" value={`${linkedTasks}/${tasks.length} linked`} sub="Actions are prioritized better when they advance a goal"/><Row href="/habits" icon="habits" title="Habits" value={`${linkedHabits}/${habits.length} linked`} sub="Build repeatable behaviors behind your outcomes"/></div></section>

    <section className="mt-7"><div className="mb-3"><h2 className="m-0 text-[20px] font-semibold tracking-[-.025em] text-text-1">Your real life</h2><p className="m-0 mt-1 text-[11px] text-text-3">Time, accountability, and reminders around the plan.</p></div><div className="py-glass-soft divide-y divide-white/[.06] px-4"><Row href="/work-schedule" icon="schedule" title="Work schedule" value={counts.workSchedules?`${counts.workSchedules} block${counts.workSchedules===1?"":"s"}`:"Set up"} sub="Recurring hours Coach should protect"/><Row href="/calendar" icon="calendar" title="Calendar" value={counts.calendar?`${counts.calendar} upcoming`:"Connect"} sub="Google Calendar and Project You+ commitments"/><Row href="/reminders" icon="alerts" title="Alerts" value={counts.reminders?`${counts.reminders} active`:"Set up"} sub="Task and habit reminders, with push delivery next"/><Row href="/accountability" icon="accountability" title="Accountability" value={counts.friends?`${counts.friends} friend${counts.friends===1?"":"s"}`:"Start"} sub="Streaks, friends, and consistency challenges"/></div></section>

    {profile.blueprint?.priorities?.length ? <section className="py-glass-soft mt-7 p-4"><h2 className="m-0 text-[15px] font-semibold text-text-1">Your priorities</h2><div className="mt-3 flex flex-wrap gap-2">{profile.blueprint.priorities.map((priority)=><span key={priority} className="py-glass-pill text-text-1">{priority}</span>)}</div><Link href="/profile" className="mt-4 inline-block text-[11.5px] font-semibold text-accent-text">Edit Blueprint</Link></section> : null}

    <section className="mt-7 py-glass-soft divide-y divide-white/[.06] px-4"><Row href="/review" icon="review" title="Weekly Review" sub="See where consistency improved or slipped"/><Row href="/progress" icon="progress" title="Progress" sub="Your real history across goals and execution"/><Row href="/integrations" icon="integrations" title="Connections" value={counts.integrations?`${counts.integrations} active`:"Set up"} sub="Calendar, finance, and future health connections"/><Row href="/settings" icon="settings" title="Settings" sub="Preferences, privacy, and account"/></section>
  </main>;
}

async function getCounts(){
  const supabase=await createClient();
  const[{count:calendar},{count:workSchedules},{count:reminders},{count:integrations},{data:connections}]=await Promise.all([
    supabase.from("calendar_events").select("id",{count:"exact",head:true}).gte("end_at",new Date().toISOString()),
    supabase.from("work_schedules").select("id",{count:"exact",head:true}).eq("active",true),
    supabase.from("reminders").select("id",{count:"exact",head:true}).eq("enabled",true),
    supabase.from("integrations").select("id",{count:"exact",head:true}).eq("status","connected"),
    supabase.from("accountability_connections").select("id").eq("status","accepted"),
  ]);
  return {calendar:calendar??0,workSchedules:workSchedules??0,reminders:reminders??0,integrations:integrations??0,friends:(connections??[]).length};
}

function Row({href,icon,title,sub,value}:{href:string;icon:string;title:string;sub:string;value?:string}){return <Link href={href} className="py-list-row py-pressable"><span className="py-icon-tile"><NavIcon name={icon} className="h-[18px] w-[18px]"/></span><span className="min-w-0 flex-1"><span className="block text-[13.5px] font-semibold text-text-1">{title}</span><span className="mt-0.5 block truncate text-[10.8px] text-text-3">{sub}</span></span>{value&&<span className="shrink-0 text-[10.5px] font-semibold text-accent-text">{value}</span>}<span className="text-[18px] text-text-3">›</span></Link>}
