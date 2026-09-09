import Link from "next/link";
import { NavIcon } from "@/components/layout/nav-icon";

type Status = "connected" | "available" | "planned";

type Integration = {
  name: string;
  description: string;
  status: Status;
  icon: string;
  href?: string;
};

const INTEGRATIONS: Integration[] = [
  { name: "Project You+ Calendar", status: "connected", icon: "calendar", description: "Internal schedule powers Today, Plan, Run My Day, and calendar awareness." },
  { name: "Google Calendar", status: "available", icon: "calendar", description: "Two-way event sync and availability context." },
  { name: "Apple Calendar", status: "available", icon: "calendar", description: "Bring personal commitments into your planning layer." },
  { name: "Apple Health", status: "available", icon: "health", description: "Sleep, steps, activity, and workout context for the Health layer." },
  { name: "Wearables", status: "planned", icon: "fitness", description: "Whoop, Oura, and Garmin recovery signals." },
  { name: "Bank accounts", status: "available", icon: "money", description: "Cash flow, recurring bills, balances, and savings pace.", href: "/money/connect" },
  { name: "Investments", status: "available", icon: "progress", description: "Portfolio value, allocation, and progress toward wealth goals.", href: "/money/connect" },
  { name: "Task services", status: "planned", icon: "tasks", description: "Bring external task context into your Project You+ priority stack." },
];

const LABEL: Record<Status, string> = { connected: "Connected", available: "Available", planned: "Planned" };

export default function IntegrationsPage() {
  return (
    <main className="py-mobile-shell md:py-shell-narrow">
      <header className="mb-6">
        <div className="py-eyebrow mb-1.5">Connections</div>
        <h1 className="py-title">Integrations</h1>
        <p className="py-subtitle">You decide which parts of your life Project You+ can use to help you.</p>
      </header>

      <section className="py-card px-4">
        {INTEGRATIONS.map((integration) => {
          const content = (
            <>
              <span className="py-icon-tile"><NavIcon name={integration.icon} className="h-[18px] w-[18px]" /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-semibold text-text-1">{integration.name}</span>
                <span className="mt-0.5 block text-[11.5px] leading-relaxed text-text-2">{integration.description}</span>
              </span>
              <StatusPill status={integration.status} />
            </>
          );
          return integration.href ? <Link key={integration.name} href={integration.href} className="py-list-row">{content}</Link> : <div key={integration.name} className="py-list-row">{content}</div>;
        })}
      </section>

      <section className="mt-4 py-accent-card p-4">
        <div className="py-section-label text-accent-text">Privacy by design</div>
        <p className="mb-0 mt-2 text-[12.5px] leading-relaxed text-text-2">A connection never means unlimited AI access. Project You+ should request the minimum permission needed, expose what is being used, and let you turn each category off at any time.</p>
      </section>
    </main>
  );
}

function StatusPill({ status }: { status: Status }) {
  const style = status === "connected" ? "bg-positive-soft text-positive" : status === "available" ? "bg-accent-soft text-accent-text" : "bg-[var(--surface-2)] text-text-3";
  return <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10.5px] font-semibold ${style}`}>{LABEL[status]}</span>;
}
