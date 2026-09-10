import Link from "next/link";
import { ReactNode } from "react";

type OwnerSection = "overview" | "users" | "analytics" | "agents" | "controls" | "content" | "integrations" | "audit" | "settings" | "approvals";

const ownerLinks: Array<{ key: OwnerSection; href: string; icon: string; label: string }> = [
  { key: "overview", href: "/owner", icon: "◈", label: "Overview" },
  { key: "users", href: "/owner/users", icon: "♙", label: "Users" },
  { key: "analytics", href: "/owner/analytics", icon: "▥", label: "Analytics" },
  { key: "agents", href: "/owner/agents", icon: "✣", label: "AI Operations" },
  { key: "controls", href: "/owner/controls", icon: "⚙", label: "Feature Controls" },
  { key: "content", href: "/owner/content", icon: "□", label: "Content & Messaging" },
  { key: "integrations", href: "/owner/integrations", icon: "⌘", label: "Integrations" },
  { key: "audit", href: "/owner/audit", icon: "▤", label: "Audit Log" },
  { key: "settings", href: "/owner/settings", icon: "⚙", label: "Settings" },
];

export function OwnerSectionShell({
  active,
  title,
  subtitle,
  displayName,
  children,
  approvalCount = 0,
  actions,
}: {
  active: OwnerSection;
  title: string;
  subtitle: string;
  displayName: string;
  children: ReactNode;
  approvalCount?: number;
  actions?: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[#050914] text-[#f5f7ff]">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_58%_-12%,rgba(82,79,255,.12),transparent_38%)]" />
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[205px] border-r border-[#172033] bg-[#070b15]/95 lg:flex lg:flex-col">
        <div className="px-7 pt-5">
          <div className="text-[12px] tracking-[.45em] text-[#c6cbed]">PROJECT</div>
          <div className="-mt-1 text-[39px] font-black leading-none tracking-[-.06em]">YOU<span className="text-[#8b5cf6]">+</span></div>
          <div className="mt-3 text-[7px] font-semibold uppercase tracking-[.35em] leading-[1.8] text-[#a98dff]">Discipline today.<br />A better tomorrow.</div>
        </div>
        <nav className="mt-7 space-y-1 px-2 text-[13px] text-[#c4cbe0]">
          <Nav href="/dashboard" icon="◷" label="Today" />
          <Nav href="/plan" icon="□" label="Plan" />
          <Nav href="/coach" icon="◇" label="Coach" />
          <Nav href="/you" icon="♙" label="You" />
        </nav>
        <div className="mt-5 border-t border-[#172033] px-2 pt-4">
          <div className="rounded-xl border border-[#7248ff] bg-[linear-gradient(90deg,rgba(100,60,255,.32),rgba(121,75,255,.17))] px-3 py-2.5 text-[13px] font-semibold">♣ <span className="ml-2">Owner</span>⌄</div>
        </div>
        <nav aria-label="Owner navigation" className="mt-2 space-y-1 px-2 text-[12px] text-[#b7bfd3]">
          {ownerLinks.map((item) => <Nav key={item.key} href={item.href} icon={item.icon} label={item.label} active={active === item.key} />)}
        </nav>
        <div className="mt-auto p-3">
          <div className="rounded-xl border border-[#24304a] bg-[#0b1220] p-3 text-[10px] text-[#cbd2e3]">
            <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#2a214e] text-xl">★</div><div>Build Better Humans<br />A Stronger Future.</div></div>
          </div>
          <div className="mt-4 px-3 text-[10px] text-[#7f899f]">Project You+<br />v1.0.0</div>
        </div>
      </aside>
      <div className="relative lg:pl-[205px]">
        <header className="flex h-[65px] items-center gap-4 border-b border-[#172033] px-4 sm:px-5">
          <div className="flex h-9 max-w-[860px] flex-1 items-center rounded-lg border border-[#31405a] bg-[#0c1321] px-3 text-[12px] text-[#7f8aa3]">⌕&nbsp;&nbsp;Search owner tools, users, agents, logs...</div>
          <div className="ml-auto flex items-center gap-3">
            <Link aria-label={approvalCount > 0 ? `Open Approval Center, ${approvalCount} items need attention` : "Open Approval Center"} href="/owner/approvals" className="relative rounded-lg border border-[#6942d8] bg-[#160f2d] px-3 py-2 text-[10px] font-semibold text-[#d2c4ff] hover:border-[#8b5cf6]">
              ✓ Approvals{approvalCount > 0 ? <span className="ml-2 rounded-full bg-[#7c4dff] px-1.5 py-0.5 text-[8px] text-white">{approvalCount}</span> : null}
            </Link>
            <span className="hidden rounded-lg border border-[#263249] bg-[#0b111c] px-3 py-2 text-[11px] sm:inline"><span className="mr-2 text-emerald-400">●</span>Live</span>
            <div className="hidden h-9 w-9 items-center justify-center rounded-full bg-[#4b2c9a] text-[11px] font-bold sm:flex">{initials(displayName)}</div>
            <div className="hidden text-[11px] sm:block"><div className="font-semibold">{displayName}</div><div className="text-[#8c96ab]">Owner</div></div>
          </div>
        </header>
        <div className="px-4 py-5 sm:px-5">
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div><h1 className="text-[27px] font-bold tracking-[-.035em]">{title}</h1><p className="text-[13px] text-[#8995ae]">{subtitle}</p></div>
            {actions ? <div>{actions}</div> : null}
          </div>
          {children}
        </div>
      </div>
    </main>
  );
}

export function OwnerPanel({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return <section className="rounded-xl border border-[#1b293f] bg-[linear-gradient(180deg,#0b121f,#09101a)] p-4"><div><div className="text-[12px] font-semibold">{title}</div>{subtitle ? <div className="mt-0.5 text-[9px] text-[#7f8aa0]">{subtitle}</div> : null}</div>{children}</section>;
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="py-10 text-center text-[10px] text-[#71809a]">{children}</div>;
}

function Nav({ href, icon, label, active = false }: { href: string; icon: string; label: string; active?: boolean }) {
  return <Link href={href} className={`flex items-center gap-3 rounded-lg px-3 py-2 ${active ? "border border-[#7445ef] bg-[#281950] text-[#d1c5ff]" : "hover:bg-white/[.03]"}`}><span className="w-4 text-center text-[14px]">{icon}</span>{label}</Link>;
}

function initials(v: string) { return v.split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map((x) => x[0]?.toUpperCase()).join("") || "OU"; }
