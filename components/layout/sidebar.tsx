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

const MODULE_BY_HREF: Record<string, string> = {
  "/health": "health",
  "/money": "money",
  "/coach": "coach",
  "/fitness": "fitness",
  "/supplements": "supplements",
  "/accountability": "accountability",
  "/reminders": "reminders",
  "/integrations": "integrations",
};

export function Sidebar({
  profile,
  isAdmin = false,
  disabledModules = [],
}: {
  profile: Profile;
  isAdmin?: boolean;
  disabledModules?: string[];
}) {
  const pathname = usePathname();
  const activeRoot = rootSectionForPath(pathname);
  const disabled = new Set(disabledModules);
  const rootNav = visibleItems(ROOT_NAV, disabled);
  const planNav = visibleItems(PLAN_NAV, disabled);
  const youNav = visibleItems(YOU_NAV, disabled);

  return (
    <aside className="fixed left-0 top-0 z-40 hidden h-screen w-[252px] flex-col border-r border-border bg-[rgba(5,5,9,.94)] px-4 py-6 backdrop-blur-xl md:flex">
      <ProjectYouLogo className="mb-7 px-2 text-[16px] font-semibold" markClassName="h-9 w-9" />

      <nav className="flex flex-1 flex-col overflow-y-auto pr-1">
        <div className="space-y-0.5">
          {rootNav.map((item) => (
            <SidebarLink key={item.href} item={item} active={activeRoot === item.href} />
          ))}
        </div>

        <div className="my-4 border-t border-border" />
        <div className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-text-3">Plan</div>
        <div className="space-y-0.5">
          {planNav.map((item) => <SidebarLink key={item.href} item={item} active={pathname.startsWith(item.href)} compact />)}
        </div>

        <div className="my-4 border-t border-border" />
        <div className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-text-3">You</div>
        <div className="space-y-0.5">
          {youNav.map((item) => <SidebarLink key={item.href} item={item} active={pathname.startsWith(item.href)} compact />)}
        </div>

        {isAdmin && (
          <>
            <div className="my-4 border-t border-border" />
            <div className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-accent-text">Owner</div>
            <Link
              href="/owner"
              className="flex min-h-[40px] items-center gap-3 rounded-xl border border-accent/15 bg-accent-soft px-3 py-1.5 text-[13.5px] font-semibold text-accent-text transition hover:border-accent/30 hover:bg-accent/15"
            >
              <NavIcon name="settings" className="h-[16px] w-[16px]" />
              Command Center
            </Link>
          </>
        )}
      </nav>

      <div className="flex items-center justify-between border-t border-border px-2 pt-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-soft text-[13px] font-semibold text-accent-text">
            {(profile.fullName ?? "?")[0]}
          </div>
          <div className="max-w-[120px] truncate text-[13.5px] font-medium text-text-1">{profile.fullName ?? "Guest"}</div>
        </div>
        <ThemeToggle />
      </div>

      <form action={signOut} className="mt-3">
        <button className="w-full rounded-xl px-2 py-2 text-left text-[13px] text-text-3 transition hover:text-text-1">Sign out</button>
      </form>
    </aside>
  );
}

function visibleItems(items: NavItem[], disabled: Set<string>) {
  return items.filter((item) => {
    const moduleKey = MODULE_BY_HREF[item.href];
    return !moduleKey || !disabled.has(moduleKey);
  });
}

function SidebarLink({ item, active, compact = false }: { item: NavItem; active: boolean; compact?: boolean }) {
  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 text-[13.5px] font-medium text-text-2 transition-all",
        compact ? "min-h-[38px] py-1.5" : "min-h-[42px] py-2",
        active && "bg-accent-soft text-white shadow-[inset_0_0_0_1px_rgba(139,92,246,.16)]"
      )}
    >
      <NavIcon name={item.icon} className={compact ? "h-[16px] w-[16px]" : "h-[18px] w-[18px]"} />
      {item.label}
    </Link>
  );
}
