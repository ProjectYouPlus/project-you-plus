"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { mockSchedule, mockWeekSchedule } from "@/lib/mock-data";

export default function CalendarPage() {
  const [view, setView] = useState<"day" | "week">("day");
  const dayEvents = [...mockSchedule].sort((a, b) => a.startAt.localeCompare(b.startAt));
  const weekEvents = [...mockWeekSchedule].sort((a, b) => a.startAt.localeCompare(b.startAt));
  const byDay = weekEvents.reduce<Record<string, typeof weekEvents>>((acc, e) => {
    const key = new Date(e.startAt).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
    (acc[key] ??= []).push(e); return acc;
  }, {});

  return (
    <main className="py-shell">
      <header className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><div className="py-eyebrow mb-2">Time</div><h1 className="py-title">Calendar</h1><p className="py-subtitle">Protect your focus by seeing commitments and priorities in one place.</p></div>
        <div className="flex w-fit gap-1 rounded-xl border border-border bg-surface p-1">
          {(["day","week"] as const).map((v)=><button key={v} onClick={()=>setView(v)} className={cn("rounded-lg px-4 py-2 text-[12.5px] font-semibold capitalize transition",view===v?"bg-accent text-white":"text-text-2")}>{v}</button>)}
        </div>
      </header>

      <section className="py-accent-card mb-5 p-5 sm:p-6">
        <div className="py-section-label text-accent-text">Project You+ Insight</div>
        <p className="mb-0 mt-2 text-[14px] leading-6 text-text-1">Your strongest focus window is the open block before 1 PM. Protect it for the client proposal before smaller meetings fragment the afternoon.</p>
      </section>

      <section className="py-card overflow-hidden">
        <div className="border-b border-border px-5 py-4 sm:px-6"><div className="py-section-label">{view === "day" ? "Today" : "This week"}</div><h2 className="py-section-title">Your commitments</h2></div>
        <div className="px-5 py-2 sm:px-6">
          {view === "day" ? dayEvents.map((e,i)=><div key={e.id} className="grid grid-cols-[74px_16px_1fr] gap-3 border-b border-border py-4 last:border-b-0"><div className="text-[12px] font-medium text-text-3">{new Date(e.startAt).toLocaleTimeString([], { hour:"numeric",minute:"2-digit" })}</div><div className="flex justify-center"><span className={`mt-1.5 h-2.5 w-2.5 rounded-full ${e.isCurrent?'bg-accent shadow-[0_0_18px_rgba(139,92,246,.85)]':'bg-[var(--border-strong)]'}`} /></div><div><div className="text-[14px] font-semibold text-text-1">{e.title}</div>{e.location&&<div className="mt-1 text-[12.5px] text-text-3">{e.location}</div>}</div></div>) : Object.entries(byDay).map(([day,events])=><div key={day} className="border-b border-border py-5 last:border-b-0"><div className="mb-3 text-[12px] font-semibold uppercase tracking-[.12em] text-accent-text">{day}</div><div className="space-y-3">{events.map(e=><div key={e.id} className="flex gap-3"><div className="w-[68px] shrink-0 text-[12px] text-text-3">{new Date(e.startAt).toLocaleTimeString([], {hour:"numeric",minute:"2-digit"})}</div><div className="text-[13.5px] font-medium text-text-1">{e.title}</div></div>)}</div></div>)}
        </div>
      </section>
      <p className="mt-3 text-[11px] text-text-3">Internal calendar is active. Google, Apple and Outlook connections arrive in the integrations phase.</p>
    </main>
  );
}
