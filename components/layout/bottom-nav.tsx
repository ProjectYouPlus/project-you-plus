"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { MOBILE_PRIMARY_NAV, rootSectionForPath } from "./nav-config";
import { NavIcon } from "./nav-icon";

export function BottomNav() {
  const pathname = usePathname();
  const activeRoot = rootSectionForPath(pathname);
  return <nav className="fixed bottom-[8px] left-1/2 z-40 mx-auto flex w-[calc(100%-20px)] max-w-[500px] -translate-x-1/2 items-center justify-around rounded-[26px] border border-white/[.10] bg-[rgba(18,18,29,.70)] px-2 pb-[calc(8px+env(safe-area-inset-bottom))] pt-2 shadow-[0_22px_70px_rgba(0,0,0,.42)] backdrop-blur-[30px] backdrop-saturate-150 md:hidden">
    {MOBILE_PRIMARY_NAV.map((item)=>{const active=activeRoot===item.href;return <Link key={item.href} href={item.href} aria-current={active?"page":undefined} className={cn("py-pressable relative flex min-w-[72px] flex-col items-center gap-1 rounded-[20px] px-2 py-1.5 text-[10px] font-semibold text-text-3",active&&"text-accent-text")}>
      <span className={cn("relative flex h-7 w-10 items-center justify-center rounded-full transition-all duration-300",active&&"bg-[rgba(139,92,246,.16)] shadow-[inset_0_1px_0_rgba(255,255,255,.09)]")}><NavIcon name={item.icon} className="h-[19px] w-[19px]"/>{active&&<span className="absolute -top-[2px] right-[2px] h-1.5 w-1.5 rounded-full bg-accent-2 shadow-[0_0_10px_rgba(169,112,255,.8)]"/>}</span>{item.label}
    </Link>})}
  </nav>
}
