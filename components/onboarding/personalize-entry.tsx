"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function PersonalizeProjectYouEntry(){
  const pathname=usePathname();
  if(pathname!=="/you")return null;
  return <div className="px-4 pt-4 sm:px-6 md:px-8 md:pt-6"><Link href="/onboarding?mode=personalize" className="py-glass-soft py-pressable mx-auto flex max-w-[980px] items-center gap-4 p-4"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-accent/20 bg-accent/10 text-[15px] font-semibold text-accent-text">+</div><div className="min-w-0 flex-1"><div className="text-[13px] font-semibold text-text-1">Personalize Project You+</div><div className="mt-1 text-[10.5px] leading-relaxed text-text-3">Review what Project You+ knows about your priorities, schedule, health, money, and coaching preferences. Existing records are preserved unless you confirm a change.</div></div><span className="text-[18px] text-text-3">›</span></Link></div>;
}
