"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ROOT_NAV, PLAN_NAV, YOU_NAV, rootSectionForPath, type NavItem } from "./nav-config";
import { NavIcon } from "./nav-icon";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { signOut } from "@/lib/actions/auth";
import type { Profile } from "@/lib/types";
import { ProjectYouLogo } from "@/components/brand/project-you-logo";

export function Sidebar({ profile }: { profile: Profile }) {
  const pathname = usePathname();
  const activeRoot = rootSectionForPath(pathname);

  return (
    <aside className="fixed left-0 top-0 z-40 hidden h-screen w-[252px] flex-col border-r border-border bg-[var(--sidebar-theme)] px-4 py-6 backdrop-blur-xl md:flex">
      <ProjectYouLogo className="mb-7 px-2 text-[16px] font-semibold" markClassName="h-9 w-9" />
      <nav className="flex flex-1 flex-col overflow-y-auto pr-1">
        <div className="space-y-0.5">{ROOT_NAV.map((item)=><SidebarLink key={item.href} item={item} active={activeRoot===item.href}/>)}</div>
        <div className="my-4 border-t border-border"/><div className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[.15em] text-text-3">Plan</div>
        <div className="space-y-0.5">{PLAN_NAV.map((item)=><SidebarLink key={item.href} item={item} active={pathname.startsWith(item.href)} compact/>)}</div>
        <div className="my-4 border-t border-border"/><div className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[.15em] text-text-3">You</div>
        <div className="space-y-0.5">{YOU_NAV.map((item)=><SidebarLink key={item.href} item={item} active={pathname.startsWith(item.href)} compact/>)}</div>
      </nav>
      <div className="border-t border-border px-2 pt-4"><div className="flex items-center gap-2.5"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-soft text-[13px] font-semibold text-accent-text">{(profile.fullName??"?")[0]}</div><div className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-text-1">{profile.fullName??"Guest"}</div></div><div className="mt-3"><ThemeToggle/></div></div>
      <form action={signOut} className="mt-3"><button className="w-full rounded-xl px-2 py-2 text-left text-[13px] text-text-3 transition hover:text-text-1">Sign out</button></form>
    </aside>
  );
}

function SidebarLink({item,active,compact=false}:{item:NavItem;active:boolean;compact?:boolean}){
  return <Link href={item.href} className={cn("flex items-center gap-3 rounded-xl px-3 text-[13.5px] font-medium text-text-2 transition-all",compact?"min-h-[38px] py-1.5":"min-h-[42px] py-2",active&&"bg-accent-soft text-text-1 shadow-[inset_0_0_0_1px_var(--accent-soft)]")}><NavIcon name={item.icon} className={compact?"h-[16px] w-[16px]":"h-[18px] w-[18px]"}/>{item.label}</Link>
}
