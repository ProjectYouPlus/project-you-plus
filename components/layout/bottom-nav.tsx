"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { MOBILE_PRIMARY_NAV, rootSectionForPath } from "./nav-config";
import { NavIcon } from "./nav-icon";

export function BottomNav() {
  const pathname = usePathname();
  const activeRoot = rootSectionForPath(pathname);
  return <nav className="fixed bottom-[8px] left-1/2 z-40 mx-auto grid w-[calc(100%-16px)] max-w-[520px] -translate-x-1/2 grid-cols-5 items-center rounded-[28px] border border-white/[.11] bg-[rgba(17,17,28,.72)] px-1.5 pb-[calc(7px+env(safe-area-inset-bottom))] pt-2 shadow-[0_24px_75px_rgba(0,0,0,.48)] backdrop-blur-[34px] backdrop-saturate-150 md:hidden">
    {MOBILE_PRIMARY_NAV.map((item) => {
      const active = activeRoot === item.href;
      return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={cn("py-pressable relative flex min-w-0 flex-col items-center gap-1 rounded-[20px] px-1 py-1.5 text-[9.5px] font-semibold text-text-3", active && "text-accent-text")}>
        <span className={cn("relative flex h-7 w-10 items-center justify-center rounded-full transition-all duration-300", active && "bg-[rgba(139,92,246,.17)] shadow-[inset_0_1px_0_rgba(255,255,255,.10),0_4px_18px_rgba(139,92,246,.12)]")}><NavIcon name={item.icon} className="h-[18px] w-[18px]" />{active && <span className="absolute -top-[2px] right-[2px] h-1.5 w-1.5 rounded-full bg-accent-2 shadow-[0_0_10px_rgba(169,112,255,.8)]" />}</span>
        <span className="truncate">{item.label}</span>
      </Link>;
    })}
  </nav>;
}
