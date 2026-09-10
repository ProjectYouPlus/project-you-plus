"use client";

import { useMemo, useState } from "react";
import { useTheme } from "./theme-provider";

export function ThemeToggle() {
  const { theme, setTheme, themeOptions } = useTheme();
  const [open, setOpen] = useState(false);
  const active = useMemo(() => themeOptions.find((option) => option.id === theme) ?? themeOptions[0], [theme, themeOptions]);

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((value) => !value)} aria-label="Open theme picker" className="flex min-h-[38px] items-center gap-2 rounded-full border border-border bg-surface px-3 text-text-2 transition hover:border-[var(--border-strong)] hover:text-text-1">
        <span className="flex items-center gap-1.5">{active.swatches.slice(0,3).map((swatch)=><span key={swatch} className="h-2.5 w-2.5 rounded-full border border-black/5" style={{backgroundColor:swatch}}/>)}</span>
        <span className="hidden text-[12px] font-semibold sm:inline">{active.label}</span>
        <svg viewBox="0 0 20 20" className={`h-4 w-4 transition ${open?"rotate-180":""}`} fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M5 8l5 5 5-5" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </button>
      {open&&<div className="absolute right-0 z-50 mt-2 w-[294px] rounded-[20px] border border-border bg-surface p-2 shadow-[var(--shadow-card)] backdrop-blur-xl">
        <div className="px-2 pb-2 pt-1"><div className="text-[11px] font-semibold uppercase tracking-[.14em] text-text-3">Theme</div><div className="mt-1 text-[13px] text-text-2">Choose the look that feels like you.</div></div>
        <div className="space-y-1">{themeOptions.map((option)=>{const selected=option.id===theme;return <button key={option.id} type="button" onClick={()=>{setTheme(option.id);setOpen(false)}} className="flex w-full items-center gap-3 rounded-[16px] px-3 py-3 text-left transition hover:bg-[var(--surface-2)]"><span className="flex min-w-[72px] items-center gap-1.5">{option.swatches.map((swatch)=><span key={swatch} className="h-3 w-3 rounded-full border border-black/5" style={{backgroundColor:swatch}}/>)}</span><span className="min-w-0 flex-1"><span className="block text-[13.5px] font-semibold text-text-1">{option.label}</span><span className="mt-0.5 block text-[11px] text-text-3">{option.description}</span></span><span className="flex h-6 w-6 items-center justify-center rounded-full border text-[12px]" style={{borderColor:selected?"var(--accent)":"var(--border)",background:selected?"var(--accent)":"transparent",color:selected?"white":"transparent"}}>✓</span></button>})}</div>
      </div>}
    </div>
  );
}
