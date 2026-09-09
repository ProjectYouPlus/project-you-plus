"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { MOBILE_PRIMARY_NAV, rootSectionForPath } from "./nav-config";
import { NavIcon } from "./nav-icon";

export function BottomNav() {
  const pathname = usePathname();
  const activeRoot = rootSectionForPath(pathname);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 mx-auto flex w-full max-w-[520px] items-start justify-around border-t border-border bg-[rgba(13,13,20,.94)] px-3 pb-[calc(10px+env(safe-area-inset-bottom))] pt-2.5 backdrop-blur-2xl md:hidden">
      {MOBILE_PRIMARY_NAV.map((item) => {
        const active = activeRoot === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-w-[74px] flex-col items-center gap-1 rounded-2xl px-2 py-1 text-[10.5px] font-semibold text-text-3 transition",
              active && "text-accent-text"
            )}
          >
            <span className={cn("flex h-7 w-10 items-center justify-center rounded-full transition", active && "bg-accent-soft")}> 
              <NavIcon name={item.icon} className="h-[20px] w-[20px]" />
            </span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
