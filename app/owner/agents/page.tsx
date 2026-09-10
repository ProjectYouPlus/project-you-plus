import Link from "next/link";
import { ProjectYouLogo } from "@/components/brand/project-you-logo";
import { requireAdmin } from "@/lib/owner/access";
import { queueAgentRun, queueFullAudit, toggleAgent } from "@/lib/actions/agents";

export const dynamic = "force-dynamic";

type Agent = {
  agent_key: string;
  name: string;
  description: string | null;
  category: string;
  status: string;
  enabled: boolean;
  capabilities: string[] | null;
  last_run_at: string | null;
  last_success_at: string | null;
  last_error: string | null;
};

type Run = {
  id: number;
  agent_key: string;
  run_type: string;
  title: string;
  status: string;
  summary: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
};

type Finding = {
  id: number;
  agent_key: string;
  severity: string;
  title: string;
  detail: string | null;
  path: string | null;
  status: string;
  created_at: string;
};

const icons: Record<string, string> = {
  orchestrator: "◎",
  builder: "⌘",
  qa: "✓",
  backend: "◇",
  design: "✦",
  product: "↗",
};

const defaultRun: Record<string, { runType: string; title: string }> = {
  orchestrator: { runType: "orchestrate", title: "Coordinate next Project You+ audit" },
  builder: { runType: "code_review", title: "Review latest app changes and prepare fixes" },
  qa: { runType: "regression", title: "Run full product regression" },
  backend: { runType: "security", title: "Review Supabase security and database health" },
  design: { runType: "visual", title: "Review UI and brand consistency" },
  product: { runType: "analytics", title: "Analyze funnels and product signals" },
};

export default async function AgentOperationsPage() {
  const { supabase, role } = await requireAdmin();
  const [agentsRes, runsRes, findingsRes] = await Promise.all([
    supabase.from("ai_agents").select("agent_key,name,description,category,status,enabled,capabilities,last_run_at,last_success_at,last_error").order("category"),
    supabase.from("ai_agent_runs").select("id,agent_key,run_type,title,status,summary,started_at,finished_at,created_at").order("created_at", { ascending: false }).limit(30),
    supabase.from("ai_agent_findings").select("id,agent_key,severity,title,detail,path,status,created_at").eq("status", "open").order("created_at", { ascending: false }).limit(20),
  ]);

  const agents = (agentsRes.data ?? []) as Agent[];
  const runs = (runsRes.data ?? []) as Run[];
  const findings = (findingsRes.data ?? []) as Finding[];
  const active = agents.filter((agent) => ["queued", "running"].includes(agent.status)).length;
  const failures = runs.filter((run) => run.status === "failed").length;
  const critical = findings.filter((finding) => ["critical", "high"].includes(finding.severity)).length;

  return (
    <main className="min-h-screen bg-bg text-text-1">
      <div className="pointer-events-none fixed inset-x-0 top-0 h-[500px] bg-[radial-gradient(circle_at_55%_-10%,rgba(139,92,246,.24),transparent_58%)]" />
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[246px] flex-col border-r border-border bg-[rgba(5,5,9,.95)] px-4 py-6 backdrop-blur-xl lg:flex">
        <ProjectYouLogo className="px-2 text-[16px] font-semibold" markClassName="h-9 w-9" />
        <div className="mt-8 rounded-2xl border border-accent/20 bg-accent-soft p-3.5">
          <div className="text-[9px] font-bold uppercase tracking-[.18em] text-accent-text">AI Operations</div>
          <div className="mt-1 text-[14px] font-semibold text-white">Agent Command</div>
          <div className="mt-1 text-[11px] capitalize text-text-2">{role} access</div>
        </div>
        <nav className="mt-7 space-y-1 text-[13px] font-medium text-text-2">
          <Link href="/owner" className="block rounded-xl px-3 py-2.5 hover:bg-white/[.04] hover:text-white">Overview</Link>
          <Link href="/owner/agents" className="block rounded-xl border border-accent/25 bg-accent-soft px-3 py-2.5 text-accent-text">AI Team</Link>
          <a href="#runs" className="block rounded-xl px-3 py-2.5 hover:bg-white/[.04] hover:text-white">Run History</a>
          <a href="#findings" className="block rounded-xl px-3 py-2.5 hover:bg-white/[.04] hover:text-white">Findings</a>
        </nav>
        <Link href="/dashboard" className="mt-auto rounded-xl border border-border px-3 py-2.5 text-[12px] font-semibold text-text-2 hover:text-white">← Back to Project You+</Link>
      </aside>

      <div className="relative mx-auto max-w-[1680px] px-4 pb-20 pt-6 sm:px-6 lg:pl-[278px] lg:pr-8 lg:pt-8">
        <header className="mb-8 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[9px] font-bold uppercase tracking-[.18em] text-accent-text"><span className="h-2 w-2 rounded-full bg-positive shadow-[0_0_15px_rgba(54,217,139,.75)]" /> Project You+ autonomous operations</div>
            <h1 className="text-[34px] font-bold tracking-[-.045em] sm:text-[42px]">AI Operations Center</h1>
            <p className="mt-2 max-w-[760px] text-[13px] leading-relaxed text-text-2">See every development agent, what it is working on, recent outcomes, and the issues that need your attention.</p>
          </div>
          <form action={queueFullAudit}><button className="rounded-full border border-accent/35 bg-accent px-5 py-2.5 text-[11px] font-bold text-white shadow-[0_10px_40px_rgba(139,92,246,.22)] hover:brightness-110">Run Full App Audit</button></form>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Agents online" value={`${agents.filter((a) => a.enabled).length}/${agents.length}`} detail="Available to Project You+" />
          <Metric label="Working now" value={active} detail="Queued or running" />
          <Metric label="Open findings" value={findings.length} detail={`${critical} high priority`} />
          <Metric label="Failed runs" value={failures} detail="Across recent history" />
        </section>

        <section className="mt-8">
          <div className="mb-4"><div className="text-[9px] font-bold uppercase tracking-[.16em] text-accent-text">Agent fleet</div><h2 className="mt-1 text-[24px] font-bold tracking-[-.03em]">Your Project You+ AI team</h2></div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {agents.map((agent) => {
              const run = defaultRun[agent.agent_key] ?? { runType: "manual", title: `Run ${agent.name}` };
              return (
                <article key={agent.agent_key} className="rounded-[22px] border border-border bg-surface p-5 shadow-[0_20px_70px_rgba(0,0,0,.14)]">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-accent/25 bg-accent-soft text-[20px] text-accent-text">{icons[agent.agent_key] ?? "•"}</div><div><div className="text-[15px] font-bold">{agent.name}</div><Status status={agent.enabled ? agent.status : "offline"} /></div></div>
                    <form action={toggleAgent}><input type="hidden" name="agent_key" value={agent.agent_key} /><input type="hidden" name="enabled" value={String(!agent.enabled)} /><button disabled={agent.agent_key === "orchestrator"} className="rounded-full border border-border px-2.5 py-1 text-[9px] font-bold uppercase tracking-[.08em] text-text-3 disabled:opacity-30">{agent.enabled ? "On" : "Off"}</button></form>
                  </div>
                  <p className="mt-4 min-h-[38px] text-[11px] leading-relaxed text-text-2">{agent.description}</p>
                  <div className="mt-4 flex flex-wrap gap-1.5">{(agent.capabilities ?? []).slice(0, 4).map((cap) => <span key={cap} className="rounded-full border border-border bg-bg/60 px-2 py-1 text-[9px] text-text-3">{cap}</span>)}</div>
                  <div className="mt-5 grid grid-cols-2 gap-2 text-[10px] text-text-3"><div><div className="uppercase tracking-[.08em]">Last run</div><div className="mt-1 text-text-2">{relative(agent.last_run_at)}</div></div><div><div className="uppercase tracking-[.08em]">Last success</div><div className="mt-1 text-text-2">{relative(agent.last_success_at)}</div></div></div>
                  {agent.last_error ? <div className="mt-4 rounded-xl border border-negative/20 bg-negative/5 p-3 text-[10px] text-negative">{agent.last_error}</div> : null}
                  <form action={queueAgentRun} className="mt-5"><input type="hidden" name="agent_key" value={agent.agent_key} /><input type="hidden" name="run_type" value={run.runType} /><input type="hidden" name="title" value={run.title} /><button disabled={!agent.enabled || ["queued","running"].includes(agent.status)} className="w-full rounded-xl border border-accent/30 bg-accent-soft px-3 py-2.5 text-[10px] font-bold text-accent-text disabled:cursor-not-allowed disabled:opacity-35">{["queued","running"].includes(agent.status) ? "Working…" : "Run Agent"}</button></form>
                </article>
              );
            })}
          </div>
        </section>

        <section id="runs" className="mt-9 scroll-mt-5">
          <div className="mb-4"><div className="text-[9px] font-bold uppercase tracking-[.16em] text-accent-text">Activity stream</div><h2 className="mt-1 text-[24px] font-bold tracking-[-.03em]">What the agents are doing</h2></div>
          <div className="overflow-hidden rounded-[22px] border border-border bg-surface">
            {runs.length ? <div className="divide-y divide-border">{runs.map((run) => <div key={run.id} className="grid gap-3 px-5 py-4 md:grid-cols-[130px_1fr_120px_140px] md:items-center"><div className="text-[11px] font-bold capitalize">{run.agent_key}</div><div><div className="text-[12px] font-semibold">{run.title}</div><div className="mt-1 text-[10px] text-text-3">{run.summary || run.run_type.replaceAll("_", " ")}</div></div><Status status={run.status} /><div className="text-[10px] text-text-3">{relative(run.created_at)}</div></div>)}</div> : <Empty text="No agent runs yet. Run a full audit to create the first batch." />}
          </div>
        </section>

        <section id="findings" className="mt-9 scroll-mt-5">
          <div className="mb-4"><div className="text-[9px] font-bold uppercase tracking-[.16em] text-accent-text">Attention queue</div><h2 className="mt-1 text-[24px] font-bold tracking-[-.03em]">Agent findings</h2></div>
          <div className="grid gap-3 lg:grid-cols-2">
            {findings.length ? findings.map((finding) => <article key={finding.id} className="rounded-[20px] border border-border bg-surface p-4"><div className="flex items-center justify-between gap-4"><span className="text-[9px] font-bold uppercase tracking-[.12em] text-accent-text">{finding.agent_key}</span><Severity severity={finding.severity} /></div><h3 className="mt-3 text-[13px] font-bold">{finding.title}</h3><p className="mt-2 text-[11px] leading-relaxed text-text-2">{finding.detail || "No additional detail."}</p>{finding.path ? <div className="mt-3 font-mono text-[9px] text-text-3">{finding.path}</div> : null}</article>) : <div className="lg:col-span-2"><Empty text="No open findings. This queue will populate as agents complete real audits." /></div>}
          </div>
        </section>

        <section className="mt-9 rounded-[22px] border border-accent/20 bg-[linear-gradient(135deg,rgba(139,92,246,.12),rgba(34,211,238,.03))] p-5">
          <div className="text-[9px] font-bold uppercase tracking-[.16em] text-accent-text">Safety model</div><div className="mt-2 text-[15px] font-bold">Agents can inspect, test and prepare work. Production remains yours.</div><p className="mt-2 max-w-4xl text-[11px] leading-relaxed text-text-2">Builder changes should stay on feature branches, destructive database work should use reviewed migrations, QA should use dedicated test credentials, and production merges remain owner-approved.</p>
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value, detail }: { label: string; value: string | number; detail: string }) { return <div className="rounded-[20px] border border-border bg-surface p-4"><div className="text-[9px] font-bold uppercase tracking-[.12em] text-text-3">{label}</div><div className="mt-2 text-[28px] font-bold tracking-[-.04em]">{value}</div><div className="mt-1 text-[10px] text-text-2">{detail}</div></div>; }
function Status({ status }: { status: string }) { const tone = status === "running" || status === "passed" ? "bg-positive-soft text-positive" : status === "queued" ? "bg-accent-soft text-accent-text" : status === "failed" || status === "error" ? "bg-negative/10 text-negative" : status === "blocked" ? "bg-warn-soft text-warn" : "bg-white/[.04] text-text-3"; return <span className={`w-fit rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-[.08em] ${tone}`}>{status}</span>; }
function Severity({ severity }: { severity: string }) { const tone = severity === "critical" || severity === "high" ? "text-negative" : severity === "medium" ? "text-warn" : "text-text-3"; return <span className={`text-[9px] font-bold uppercase tracking-[.12em] ${tone}`}>{severity}</span>; }
function Empty({ text }: { text: string }) { return <div className="rounded-[20px] border border-dashed border-border bg-surface px-5 py-8 text-center text-[11px] text-text-3">{text}</div>; }
function relative(value: string | null) { if (!value) return "Never"; const ms = Date.now() - new Date(value).getTime(); if (ms < 60_000) return "Just now"; if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`; if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`; return `${Math.floor(ms / 86_400_000)}d ago`; }
