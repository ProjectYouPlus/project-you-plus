"use client";

import { useEffect, useMemo, useState } from "react";
import { MARKETING_AGENTS, type MarketingAgentId } from "@/lib/marketing/agents";

type RecordRow = Record<string, any>;
type Overview = {
  content: RecordRow[]; trends: RecordRow[]; metrics: RecordRow[]; community: RecordRow[];
  partnerships: RecordRow[]; learnings: RecordRow[]; campaigns: RecordRow[]; runs: RecordRow[];
  growthScore: { score: number; label: string; components: Record<string, number> };
  instagram: { status: string; connected_at: string | null; metadata: Record<string, any> | null } | null;
};

type Tab = "command" | "content" | "intelligence" | "community" | "partners" | "learning";

const EMPTY: Overview = { content: [], trends: [], metrics: [], community: [], partnerships: [], learnings: [], campaigns: [], runs: [], growthScore: { score: 0, label: "Needs data", components: { velocity: 0, engagement: 0, conversion: 0, momentum: 0 } }, instagram: null };
const tabs: Array<{ id: Tab; label: string }> = [
  { id: "command", label: "Command" }, { id: "content", label: "Content Factory" }, { id: "intelligence", label: "Trend Radar" },
  { id: "community", label: "Community" }, { id: "partners", label: "Creator CRM" }, { id: "learning", label: "Learning" },
];

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-[26px] border border-white/10 bg-white/[0.035] ${className}`}>{children}</div>;
}
function Pill({ children }: { children: React.ReactNode }) { return <span className="rounded-full border border-white/10 bg-black/25 px-2.5 py-1 text-[11px] text-white/55">{children}</span>; }

export function GrowthDepartmentDashboard() {
  const [tab, setTab] = useState<Tab>("command");
  const [data, setData] = useState<Overview>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [objective, setObjective] = useState("Grow qualified Instagram awareness for Project You+ and turn attention into profile visits, follows and waitlist intent.");
  const [context, setContext] = useState("Instagram-first. Premium AI life operating system. Founder-led product storytelling. Prioritize Reels, saves, shares, profile visits and qualified signups.");
  const [agentOutput, setAgentOutput] = useState<RecordRow | null>(null);

  async function refresh() {
    try {
      const response = await fetch("/api/marketing-ops/overview", { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Could not load marketing data");
      setData(json);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load marketing data"); }
    finally { setLoading(false); }
  }
  useEffect(() => { void refresh(); }, []);

  async function autopilot() {
    setBusy("autopilot"); setError("");
    try {
      const response = await fetch("/api/marketing-ops/autopilot", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ objective, context }) });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Morning Autopilot failed");
      await refresh(); setTab("content");
    } catch (e) { setError(e instanceof Error ? e.message : "Morning Autopilot failed"); }
    finally { setBusy(""); }
  }

  async function runAgent(agentId: MarketingAgentId) {
    setBusy(agentId); setError("");
    try {
      const response = await fetch("/api/marketing-ops/run", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ agentId, objective, context }) });
      const json = await response.json(); if (!response.ok) throw new Error(json.error || "Agent failed");
      setAgentOutput(json); await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Agent failed"); }
    finally { setBusy(""); }
  }

  async function patch(resource: string, id: string, values: Record<string, unknown>) {
    setBusy(`${resource}:${id}`); setError("");
    try {
      const response = await fetch("/api/marketing-ops/actions", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ resource, id, values }) });
      const json = await response.json(); if (!response.ok) throw new Error(json.error || "Update failed");
      await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Update failed"); }
    finally { setBusy(""); }
  }

  const approvals = useMemo(() => data.content.filter((x) => x.stage === "approval" || (x.approval_status === "pending" && ["production", "approval"].includes(x.stage))), [data.content]);
  const founderQueue = useMemo(() => data.content.filter((x) => x.metrics?.founder_task && !["published", "learning", "archived"].includes(x.stage)), [data.content]);
  const published = data.content.filter((x) => x.stage === "published" || x.stage === "learning");
  const activeCampaign = data.campaigns.find((x) => x.status === "active");
  const latestMetrics = data.metrics[0];
  const pipeline = ["idea", "production", "approval", "scheduled", "published", "learning"].map((stage) => ({ stage, count: data.content.filter((x) => x.stage === stage).length }));

  return (
    <main className="min-h-screen bg-[#07070b] text-white">
      <div className="mx-auto max-w-[1580px] px-4 py-5 sm:px-6 lg:px-8">
        <header className="mb-5 flex flex-col gap-4 border-b border-white/10 pb-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[.22em] text-violet-300"><span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_16px_rgba(52,211,153,.75)]" />Project You+ · Owner</div>
            <h1 className="text-3xl font-semibold tracking-[-.04em] sm:text-4xl">Growth Department</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-white/50">Strategy, creation, distribution, community, partnerships and learning coordinated as one Instagram-first growth system.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {data.instagram?.status === "connected" ? <form action="/api/integrations/instagram/sync" method="post"><button className="rounded-2xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-200">Instagram · @{String(data.instagram.metadata?.username || "connected")}</button></form> : <a href="/api/integrations/instagram/start" className="rounded-2xl border border-violet-400/30 bg-violet-500/10 px-4 py-3 text-sm font-medium text-violet-200">Connect Instagram</a>}
            <button onClick={() => void refresh()} className="rounded-2xl border border-white/10 bg-white/[.05] px-4 py-3 text-sm font-medium hover:bg-white/[.08]">Refresh</button>
            <button onClick={autopilot} disabled={busy === "autopilot"} className="rounded-2xl bg-violet-500 px-5 py-3 text-sm font-semibold shadow-[0_12px_38px_rgba(124,58,237,.32)] hover:bg-violet-400 disabled:opacity-50">{busy === "autopilot" ? "Building today…" : "Run Morning Autopilot"}</button>
          </div>
        </header>

        <nav className="mb-5 flex gap-2 overflow-x-auto pb-1">
          {tabs.map((item) => <button key={item.id} onClick={() => setTab(item.id)} className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-medium transition ${tab === item.id ? "bg-white text-black" : "border border-white/10 bg-white/[.03] text-white/55 hover:text-white"}`}>{item.label}</button>)}
        </nav>
        {error ? <div className="mb-4 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div> : null}
        {loading ? <div className="py-24 text-center text-sm text-white/35">Loading Growth Department…</div> : null}

        {!loading && tab === "command" ? <>
          <section className="grid gap-4 xl:grid-cols-[1.15fr_.85fr]">
            <Card className="bg-[radial-gradient(circle_at_top_left,rgba(124,58,237,.24),transparent_35%),rgba(255,255,255,.035)] p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4"><div><p className="text-xs uppercase tracking-[.18em] text-white/35">Morning Brief</p><h2 className="mt-1 text-xl font-medium">One objective across every agent</h2></div><Pill>{activeCampaign ? activeCampaign.name : "No active campaign"}</Pill></div>
              <textarea value={objective} onChange={(e) => setObjective(e.target.value)} className="mt-5 min-h-20 w-full resize-none rounded-2xl border border-white/10 bg-black/25 p-4 text-sm leading-6 outline-none focus:border-violet-400/50" />
              <textarea value={context} onChange={(e) => setContext(e.target.value)} className="mt-3 min-h-20 w-full resize-none rounded-2xl border border-white/10 bg-black/20 p-4 text-sm leading-6 text-white/65 outline-none focus:border-violet-400/50" />
              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Metric label="Growth Score" value={String(data.growthScore.score)} note={data.growthScore.label} />
                <Metric label="Approval Queue" value={String(approvals.length)} note="Owner decisions" />
                <Metric label="Founder Clips" value={String(founderQueue.length)} note="Ready to film" />
                <Metric label="7D Reach" value={latestMetrics?.reach?.toLocaleString?.() || "—"} note="Instagram" />
              </div>
            </Card>
            <Card className="p-5 sm:p-6">
              <div className="flex items-center justify-between"><div><p className="text-xs uppercase tracking-[.18em] text-white/35">Growth Score</p><h2 className="mt-1 text-lg font-medium">Marketing health</h2></div><div className="text-5xl font-semibold tracking-[-.06em]">{data.growthScore.score}</div></div>
              <div className="mt-6 space-y-4">{Object.entries(data.growthScore.components || {}).map(([key, value]) => <ScoreBar key={key} label={key} value={value} />)}</div>
              <div className="mt-6 grid grid-cols-3 gap-2 text-center"><Mini label="Published" value={published.length} /><Mini label="Trends" value={data.trends.filter((x) => x.status === "new" || x.status === "watching").length} /><Mini label="Partners" value={data.partnerships.filter((x) => !["passed"].includes(x.status)).length} /></div>
            </Card>
          </section>

          <section className="mt-4 grid gap-4 2xl:grid-cols-[1.15fr_.85fr]">
            <Card className="p-5 sm:p-6"><SectionHead eyebrow="Agent Floor" title="Nine-agent growth team" aside={`${MARKETING_AGENTS.length} specialists`} />
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{MARKETING_AGENTS.map((agent, index) => <button key={agent.id} onClick={() => runAgent(agent.id)} className="rounded-2xl border border-white/8 bg-black/20 p-4 text-left transition hover:border-violet-400/35 hover:bg-violet-500/[.07]"><div className="flex items-center justify-between"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/10 text-xs text-violet-200">{String(index + 1).padStart(2,"0")}</span><div><div className="text-sm font-medium">{agent.name}</div><div className="text-[11px] text-white/35">{agent.role}</div></div></div><span className={`h-2 w-2 rounded-full ${busy === agent.id ? "animate-pulse bg-amber-300" : "bg-emerald-400"}`} /></div><p className="mt-3 line-clamp-2 text-xs leading-5 text-white/45">{agent.objective}</p></button>)}</div>
            </Card>
            <Card className="p-5 sm:p-6"><SectionHead eyebrow="Latest Agent Output" title={agentOutput?.agentName || data.runs[0]?.metadata?.agent_name || "Awaiting run"} aside={agentOutput?.role || ""} /><div className="max-h-[480px] overflow-y-auto whitespace-pre-wrap rounded-2xl border border-white/8 bg-black/25 p-4 text-xs leading-6 text-white/62">{agentOutput?.output || data.runs[0]?.output || "Run an agent or Morning Autopilot to generate the next execution-ready deliverable."}</div></Card>
          </section>

          <section className="mt-4"><Card className="p-5 sm:p-6"><SectionHead eyebrow="Content Engine" title="Pipeline velocity" aside={`${data.content.length} total assets`} /><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">{pipeline.map((p, i) => <div key={p.stage} className="rounded-2xl border border-white/8 bg-black/15 p-4"><div className="flex items-center justify-between"><span className="text-2xl font-semibold">{p.count}</span><span className="text-[10px] text-white/25">0{i+1}</span></div><div className="mt-2 text-xs capitalize text-white/45">{p.stage}</div></div>)}</div></Card></section>
        </> : null}

        {!loading && tab === "content" ? <section className="grid gap-4 2xl:grid-cols-[1fr_420px]">
          <Card className="p-5 sm:p-6"><SectionHead eyebrow="Content Factory" title="Idea → publish → learn" aside={`${data.content.length} assets`} /><div className="space-y-3">{data.content.length ? data.content.map((item) => <ContentRow key={item.id} item={item} busy={busy} patch={patch} />) : <Empty text="Run Morning Autopilot to create the first content batch." />}</div></Card>
          <div className="space-y-4"><Card className="p-5"><SectionHead eyebrow="Founder Mode" title="Film these next" aside={`${founderQueue.length} clips`} /><div className="space-y-3">{founderQueue.slice(0,6).map((item) => <div key={item.id} className="rounded-2xl border border-white/8 bg-black/20 p-4"><div className="flex items-start justify-between gap-3"><div className="text-sm font-medium">{item.title}</div><Pill>{item.format}</Pill></div><p className="mt-2 text-xs leading-5 text-white/52">{item.metrics?.founder_task}</p><button onClick={() => patch("content", item.id, { stage: "approval" })} className="mt-3 text-xs font-medium text-violet-300">Mark filmed →</button></div>)}{!founderQueue.length ? <Empty text="No filming tasks queued." /> : null}</div></Card>
          <Card className="p-5"><SectionHead eyebrow="Approval Inbox" title="Needs your decision" aside={`${approvals.length} waiting`} /><div className="space-y-3">{approvals.slice(0,5).map((item) => <div key={item.id} className="rounded-2xl border border-violet-400/15 bg-violet-500/[.05] p-4"><div className="text-sm font-medium">{item.title}</div><div className="mt-2 text-xs text-white/45">{item.hook}</div><div className="mt-3 flex gap-2"><button onClick={() => patch("content", item.id, { approval_status: "approved", stage: "scheduled" })} className="rounded-xl bg-white px-3 py-2 text-[11px] font-semibold text-black">Approve</button><button onClick={() => patch("content", item.id, { approval_status: "changes_requested", stage: "production" })} className="rounded-xl border border-white/10 px-3 py-2 text-[11px] text-white/60">Changes</button></div></div>)}{!approvals.length ? <Empty text="Approval inbox is clear." /> : null}</div></Card></div>
        </section> : null}

        {!loading && tab === "intelligence" ? <section className="grid gap-4 xl:grid-cols-[1fr_.8fr]"><Card className="p-5 sm:p-6"><SectionHead eyebrow="Pulse · Trend Radar" title="Opportunities worth acting on" aside={`${data.trends.length} signals`} /><div className="grid gap-3 md:grid-cols-2">{data.trends.map((trend) => <div key={trend.id} className="rounded-2xl border border-white/8 bg-black/20 p-4"><div className="flex items-start justify-between gap-3"><div className="font-medium">{trend.title}</div><Pill>{Math.round(Number(trend.brand_fit_score || 0))} fit</Pill></div><p className="mt-3 text-xs leading-5 text-white/48">{trend.opportunity}</p><div className="mt-4 flex gap-2 text-[10px] text-white/38"><span>Relevance {trend.relevance_score || "—"}</span><span>·</span><span>Velocity {trend.velocity_score || "—"}</span></div><div className="mt-3 flex gap-3"><button onClick={() => patch("trends", trend.id, { status: "watching" })} className="text-xs text-violet-300">Watch</button><button onClick={() => patch("trends", trend.id, { status: "used" })} className="text-xs text-emerald-300">Used</button></div></div>)}{!data.trends.length ? <Empty text="Trend signals will appear after Autopilot or Pulse runs." /> : null}</div></Card><Card className="p-5 sm:p-6"><SectionHead eyebrow="Signal Quality" title="What we prioritize" /><div className="space-y-3 text-sm leading-6 text-white/52"><p>High brand fit beats generic virality. Project You+ should borrow proven formats without becoming a trend-chasing account.</p><p>Use trends when they make the product idea easier to understand, more shareable, or more culturally relevant.</p><p>Once Instagram data is connected, velocity and opportunity scores can be replaced with live inputs instead of agent estimates.</p></div></Card></section> : null}

        {!loading && tab === "community" ? <Card className="p-5 sm:p-6"><SectionHead eyebrow="Echo · Community Command Center" title="Turn conversation into growth" aside={`${data.community.filter((x)=>x.status==="open").length} open`} /><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{data.community.map((item) => <div key={item.id} className="rounded-2xl border border-white/8 bg-black/20 p-4"><div className="flex items-start justify-between"><div><div className="text-sm font-medium capitalize">{item.action_type}</div><div className="text-[11px] text-white/32">{item.contact_handle || "Instagram community"}</div></div><Pill>P{item.priority}</Pill></div><p className="mt-3 text-xs leading-5 text-white/48">{item.context}</p>{item.suggested_reply ? <div className="mt-3 rounded-xl bg-white/[.04] p-3 text-xs leading-5 text-white/62">{item.suggested_reply}</div> : null}<button onClick={() => patch("community", item.id, { status: "done" })} className="mt-3 text-xs font-medium text-emerald-300">Mark done →</button></div>)}{!data.community.length ? <Empty text="No community actions yet." /> : null}</div></Card> : null}

        {!loading && tab === "partners" ? <Card className="p-5 sm:p-6"><SectionHead eyebrow="Bridge · Creator CRM" title="Partnership pipeline" aside={`${data.partnerships.length} prospects`} /><div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left text-sm"><thead className="text-[11px] uppercase tracking-[.14em] text-white/28"><tr><th className="pb-3">Partner</th><th className="pb-3">Fit</th><th className="pb-3">Idea</th><th className="pb-3">Status</th><th className="pb-3">Next</th></tr></thead><tbody>{data.partnerships.map((p) => <tr key={p.id} className="border-t border-white/8"><td className="py-4 pr-4"><div className="font-medium">{p.name}</div><div className="text-xs text-white/35">{p.category}</div></td><td className="py-4 pr-4">{p.fit_score || "—"}</td><td className="max-w-md py-4 pr-4 text-xs leading-5 text-white/48">{p.collaboration_idea}</td><td className="py-4 pr-4"><Pill>{p.status}</Pill></td><td className="py-4"><button onClick={() => patch("partnerships", p.id, { status: p.status === "prospect" ? "research" : p.status === "research" ? "ready" : p.status === "ready" ? "contacted" : p.status === "contacted" ? "replied" : "active" })} className="text-xs text-violet-300">Advance →</button></td></tr>)}</tbody></table>{!data.partnerships.length ? <Empty text="No partnership prospects yet." /> : null}</div></Card> : null}

        {!loading && tab === "learning" ? <section className="grid gap-4 xl:grid-cols-[1fr_.8fr]"><Card className="p-5 sm:p-6"><SectionHead eyebrow="Vector · Winning Pattern Memory" title="What Project You+ is learning" aside={`${data.learnings.length} patterns`} /><div className="space-y-3">{data.learnings.map((item) => <div key={item.id} className="rounded-2xl border border-white/8 bg-black/20 p-4"><div className="flex items-start justify-between gap-3"><div><div className="text-sm font-medium">{item.pattern}</div><div className="mt-1 text-[11px] capitalize text-white/35">{item.learning_type} · {item.status}</div></div><Pill>{Math.round(Number(item.impact_score || 0))} impact</Pill></div><p className="mt-3 text-xs leading-5 text-white/48">{item.evidence}</p></div>)}{!data.learnings.length ? <Empty text="Learning memory begins once published content has performance data." /> : null}</div></Card><Card className="p-5 sm:p-6"><SectionHead eyebrow="Performance Loop" title="How the engine compounds" /><div className="space-y-3">{["Publish and collect 24h / 7d performance","Vector identifies hook, format, topic, CTA and timing patterns","Validated patterns are stored as reusable marketing memory","Northstar and Atlas bias the next content batch toward winners","Continue controlled experiments so the account does not overfit"].map((x,i)=><div key={x} className="flex gap-3 rounded-2xl border border-white/8 bg-black/15 p-4"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-[11px] text-violet-200">{i+1}</span><p className="text-xs leading-5 text-white/52">{x}</p></div>)}</div></Card></section> : null}
      </div>
    </main>
  );
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) { return <div className="rounded-2xl border border-white/8 bg-black/20 p-4"><div className="text-xs text-white/35">{label}</div><div className="mt-2 text-2xl font-semibold tracking-tight">{value}</div><div className="mt-1 text-[11px] text-white/30">{note}</div></div>; }
function Mini({ label, value }: { label: string; value: number }) { return <div className="rounded-2xl border border-white/8 bg-black/20 p-3"><div className="text-lg font-semibold">{value}</div><div className="text-[10px] text-white/30">{label}</div></div>; }
function ScoreBar({ label, value }: { label: string; value: number }) { return <div><div className="mb-1.5 flex justify-between text-xs"><span className="capitalize text-white/45">{label}</span><span className="text-white/65">{value}</span></div><div className="h-2 overflow-hidden rounded-full bg-white/[.06]"><div className="h-full rounded-full bg-violet-400" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div></div>; }
function SectionHead({ eyebrow, title, aside }: { eyebrow: string; title: string; aside?: string }) { return <div className="mb-5 flex items-end justify-between gap-4"><div><p className="text-xs uppercase tracking-[.18em] text-white/32">{eyebrow}</p><h2 className="mt-1 text-lg font-medium">{title}</h2></div>{aside ? <div className="text-xs text-white/30">{aside}</div> : null}</div>; }
function Empty({ text }: { text: string }) { return <div className="rounded-2xl border border-dashed border-white/10 p-6 text-sm text-white/32">{text}</div>; }
function ContentRow({ item, patch }: { item: RecordRow; busy: string; patch: (resource: string, id: string, values: Record<string, unknown>) => Promise<void> }) {
  const nextStage: Record<string,string> = { idea: "production", production: "approval", approval: "scheduled", scheduled: "published", published: "learning" };
  return <div className="rounded-2xl border border-white/8 bg-black/20 p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="font-medium">{item.title}</span><Pill>{item.format}</Pill><Pill>{item.stage}</Pill>{item.score ? <Pill>{Math.round(Number(item.score))} score</Pill> : null}</div><p className="mt-2 text-xs leading-5 text-white/52">{item.hook || item.creative_brief}</p>{item.metrics?.founder_task ? <p className="mt-2 text-[11px] leading-5 text-violet-200/65">Film: {item.metrics.founder_task}</p> : null}</div><div className="flex shrink-0 gap-2">{nextStage[item.stage] ? <button onClick={() => patch("content", item.id, { stage: nextStage[item.stage] })} className="rounded-xl border border-white/10 px-3 py-2 text-[11px] text-white/65 hover:bg-white/[.05]">Move → {nextStage[item.stage]}</button> : null}</div></div></div>;
}
