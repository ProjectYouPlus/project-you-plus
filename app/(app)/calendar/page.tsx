import Link from "next/link";
import { refreshGoogleCalendar } from "@/lib/actions/integrations";
import { isGoogleCalendarConfigured } from "@/lib/integrations/google-calendar";
import { createClient } from "@/lib/supabase/server";

const DAYS=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

export default async function CalendarPage(){
  const supabase=await createClient();
  const now=new Date();const end=new Date(now);end.setDate(end.getDate()+7);
  const [{data:events},{data:schedules},{data:googleIntegration}]=await Promise.all([
    supabase.from("calendar_events").select("id,title,start_at,end_at,location,source").gte("end_at",now.toISOString()).lt("start_at",end.toISOString()).order("start_at"),
    supabase.from("work_schedules").select("id,label,days_of_week,start_time,end_time").eq("active",true).order("created_at"),
    supabase.from("integrations").select("status,metadata").eq("provider","google_calendar").maybeSingle(),
  ]);
  const rows=events??[];const googleConnected=googleIntegration?.status==="connected";
  return <main className="py-mobile-shell md:py-shell-narrow">
    <header className="mb-7"><h1 className="py-title">Calendar</h1><p className="py-subtitle">Your real commitments and recurring work time, so Project You+ plans around reality.</p></header>

    <section className="py-glass-soft p-4"><div className="flex items-center gap-3"><span className={`h-2.5 w-2.5 shrink-0 rounded-full ${googleConnected?"bg-positive":"bg-text-3"}`}/><div className="min-w-0 flex-1"><div className="text-[13.5px] font-semibold text-text-1">Google Calendar</div><div className="mt-0.5 text-[10.8px] text-text-3">{googleConnected?"Primary calendar connected with read-only access":isGoogleCalendarConfigured()?"Ready to connect":"Developer credentials still required"}</div></div>{googleConnected?<form action={refreshGoogleCalendar}><button className="text-[11px] font-semibold text-accent-text">Refresh</button></form>:isGoogleCalendarConfigured()?<Link href="/api/integrations/google-calendar/start" className="text-[11px] font-semibold text-accent-text">Connect</Link>:<Link href="/integrations" className="text-[11px] font-semibold text-text-3">Setup</Link>}</div></section>

    <section className="mt-7"><div className="mb-3 flex items-end justify-between gap-3"><div><h2 className="m-0 text-[20px] font-semibold tracking-[-.025em] text-text-1">Next 7 days</h2><p className="m-0 mt-1 text-[11px] text-text-3">{rows.length?`${rows.length} commitment${rows.length===1?"":"s"}`:"No calendar events yet"}</p></div></div>{rows.length?<div className="py-glass-soft px-4">{rows.map((event)=><div key={event.id} className="flex gap-3 border-t border-white/[.06] py-4 first:border-0"><div className="w-[62px] shrink-0 text-[10.5px] font-medium text-text-3">{new Date(event.start_at).toLocaleDateString(undefined,{weekday:"short"})}<br/>{new Date(event.start_at).toLocaleTimeString([],{hour:"numeric",minute:"2-digit"})}</div><span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${event.source==="google"?"bg-accent-2":"bg-text-2"}`}/><div className="min-w-0 flex-1"><div className="truncate text-[13.5px] font-semibold text-text-1">{event.title}</div><div className="mt-0.5 text-[10.8px] text-text-3">{event.location||sourceLabel(event.source)}</div></div><span className="text-[9.5px] font-semibold text-text-3">{sourceLabel(event.source)}</span></div>)}</div>:<div className="py-glass-soft p-4 text-[12px] leading-relaxed text-text-3">Connect Google Calendar or use your recurring work schedule below. No sample meetings will be inserted.</div>}</section>

    <section className="mt-7"><div className="mb-3 flex items-end justify-between"><div><h2 className="m-0 text-[20px] font-semibold tracking-[-.025em] text-text-1">Recurring work time</h2><p className="m-0 mt-1 text-[11px] text-text-3">Protected context for planning—not duplicate calendar events.</p></div><Link href="/work-schedule" className="text-[11.5px] font-semibold text-accent-text">Edit</Link></div>{(schedules??[]).length?<div className="py-glass-soft divide-y divide-white/[.06] px-4">{(schedules??[]).map((row)=><div key={row.id} className="flex items-center gap-3 py-3.5"><div className="min-w-0 flex-1"><div className="text-[13px] font-semibold text-text-1">{row.label}</div><div className="mt-0.5 text-[10.5px] text-text-3">{(row.days_of_week??[]).map((day:number)=>DAYS[day]).join(" · ")}</div></div><div className="text-[10.8px] font-medium text-text-2">{time(row.start_time)}–{time(row.end_time)}</div></div>)}</div>:<Link href="/work-schedule" className="py-glass-soft py-pressable flex items-center justify-between p-4"><span><span className="block text-[13px] font-semibold text-text-1">Add your work schedule</span><span className="mt-0.5 block text-[10.8px] text-text-3">Tell Coach which recurring hours are unavailable.</span></span><span className="text-[11px] font-semibold text-accent-text">Add</span></Link>}</section>
  </main>
}
function sourceLabel(source:string|null){return source==="google"?"Google":source==="internal"?"Project You+":source||"Calendar"}
function time(value:string){return new Date(`2000-01-01T${value}`).toLocaleTimeString([],{hour:"numeric",minute:"2-digit"})}
