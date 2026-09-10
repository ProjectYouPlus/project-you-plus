import Link from "next/link";
import { requireAdmin } from "@/lib/owner/access";
import { queueAgentRun, queueFullAudit } from "@/lib/actions/agents";

export const dynamic = "force-dynamic";

type Agent = { agent_key:string; name:string; description:string|null; status:string; enabled:boolean; capabilities:string[]|null; last_run_at:string|null; last_success_at:string|null; last_error:string|null };
type Run = { id:number; agent_key:string; run_type:string; title:string; status:string; summary:string|null; created_at:string };
type Finding = { id:number; agent_key:string; severity:string; title:string; detail:string|null; path:string|null; created_at:string };

const defaults: Record<string,{runType:string;title:string}> = {
  orchestrator:{runType:"orchestrate",title:"Coordinate next Project You+ audit"},
  builder:{runType:"code_review",title:"Review latest app changes and prepare fixes"},
  qa:{runType:"regression",title:"Run full product regression"},
  backend:{runType:"security",title:"Review Supabase security and database health"},
  design:{runType:"visual",title:"Review UI and brand consistency"},
  product:{runType:"analytics",title:"Analyze funnels and product signals"},
};

export default async function AgentOperationsPage(){
  const { supabase, role } = await requireAdmin();
  const [agentsRes,runsRes,findingsRes] = await Promise.all([
    supabase.from("ai_agents").select("agent_key,name,description,status,enabled,capabilities,last_run_at,last_success_at,last_error").order("agent_key"),
    supabase.from("ai_agent_runs").select("id,agent_key,run_type,title,status,summary,created_at").order("created_at",{ascending:false}).limit(30),
    supabase.from("ai_agent_findings").select("id,agent_key,severity,title,detail,path,created_at").eq("status","open").order("created_at",{ascending:false}).limit(20),
  ]);
  const agents=(agentsRes.data??[]) as Agent[];
  const runs=(runsRes.data??[]) as Run[];
  const findings=(findingsRes.data??[]) as Finding[];
  const working=agents.filter(a=>["queued","running"].includes(a.status)).length;
  const high=findings.filter(f=>["critical","high"].includes(f.severity)).length;

  return <main className="min-h-screen bg-[#050509] text-white">
    <div className="pointer-events-none fixed inset-x-0 top-0 h-[520px] bg-[radial-gradient(circle_at_50%_-20%,rgba(124,58,237,.3),transparent_58%)]" />
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] border-r border-white/10 bg-black/40 p-5 backdrop-blur-xl lg:block">
      <div className="text-xl font-bold tracking-tight">PROJECT YOU+</div>
      <div className="mt-8 rounded-2xl border border-violet-500/25 bg-violet-500/10 p-4">
        <div className="text-[10px] font-bold uppercase tracking-[.18em] text-violet-300">AI Operations</div>
        <div className="mt-1 text-sm font-semibold">Agent Command</div>
        <div className="mt-1 text-xs capitalize text-white/50">{role} access</div>
      </div>
      <nav className="mt-6 space-y-1 text-sm text-white/55">
        <Link href="/owner/agents" className="block rounded-xl bg-white/[.05] px-3 py-2.5 text-white">AI Team</Link>
        <a href="#runs" className="block rounded-xl px-3 py-2.5 hover:bg-white/[.04] hover:text-white">Run History</a>
        <a href="#findings" className="block rounded-xl px-3 py-2.5 hover:bg-white/[.04] hover:text-white">Findings</a>
      </nav>
      <Link href="/dashboard" className="absolute bottom-5 left-5 right-5 rounded-xl border border-white/10 px-3 py-2.5 text-xs text-white/60">← Back to Project You+</Link>
    </aside>

    <div className="relative mx-auto max-w-[1600px] px-4 pb-20 pt-7 sm:px-6 lg:pl-[284px] lg:pr-8">
      <header className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div><div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.18em] text-violet-300"><span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,.8)]"/>Project You+ autonomous operations</div><h1 className="mt-2 text-4xl font-bold tracking-[-.04em] sm:text-5xl">AI Operations Center</h1><p className="mt-3 max-w-3xl text-sm leading-relaxed text-white/50">See every development agent, what it is doing, recent outcomes, and the issues that need your attention.</p></div>
        <form action={queueFullAudit}><button className="rounded-full bg-violet-600 px-5 py-3 text-xs font-bold shadow-[0_12px_45px_rgba(124,58,237,.28)] hover:bg-violet-500">Run Full App Audit</button></form>
      </header>

      <section className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Agents online" value={`${agents.filter(a=>a.enabled).length}/${agents.length}`} detail="Available to Project You+" />
        <Metric label="Working now" value={working} detail="Queued or running" />
        <Metric label="Open findings" value={findings.length} detail={`${high} high priority`} />
        <Metric label="Recent runs" value={runs.length} detail="Latest agent activity" />
      </section>

      <section className="mt-9"><div className="mb-4"><div className="text-[10px] font-bold uppercase tracking-[.16em] text-violet-300">Agent fleet</div><h2 className="mt-1 text-2xl font-bold">Your Project You+ AI team</h2></div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{agents.map(agent=>{const run=defaults[agent.agent_key]??{runType:"manual",title:`Run ${agent.name}`};return <article key={agent.agent_key} className="rounded-[24px] border border-white/10 bg-white/[.035] p-5 shadow-[0_20px_70px_rgba(0,0,0,.25)]">
          <div className="flex items-start justify-between gap-4"><div><div className="text-base font-bold">{agent.name}</div><Status status={agent.enabled?agent.status:"offline"}/></div><div className="rounded-full border border-white/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[.08em] text-white/40">{agent.enabled?"Online":"Off"}</div></div>
          <p className="mt-4 min-h-[42px] text-xs leading-relaxed text-white/50">{agent.description}</p>
          <div className="mt-4 flex flex-wrap gap-1.5">{(agent.capabilities??[]).slice(0,4).map(cap=><span key={cap} className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[9px] text-white/45">{cap}</span>)}</div>
          <div className="mt-5 grid grid-cols-2 gap-3 text-[10px] text-white/35"><div><div className="uppercase tracking-[.08em]">Last run</div><div className="mt-1 text-white/60">{relative(agent.last_run_at)}</div></div><div><div className="uppercase tracking-[.08em]">Last success</div><div className="mt-1 text-white/60">{relative(agent.last_success_at)}</div></div></div>
          {agent.last_error?<div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-[10px] text-red-300">{agent.last_error}</div>:null}
          <form action={queueAgentRun} className="mt-5"><input type="hidden" name="agent_key" value={agent.agent_key}/><input type="hidden" name="run_type" value={run.runType}/><input type="hidden" name="title" value={run.title}/><button disabled={!agent.enabled||["queued","running"].includes(agent.status)} className="w-full rounded-xl border border-violet-500/25 bg-violet-500/10 px-3 py-2.5 text-[10px] font-bold text-violet-300 disabled:opacity-35">{["queued","running"].includes(agent.status)?"Working…":"Run Agent"}</button></form>
        </article>})}</div>
      </section>

      <section id="runs" className="mt-10"><div className="mb-4"><div className="text-[10px] font-bold uppercase tracking-[.16em] text-violet-300">Activity stream</div><h2 className="mt-1 text-2xl font-bold">What the agents are doing</h2></div><div className="overflow-hidden rounded-[24px] border border-white/10 bg-white/[.035]">{runs.length?<div className="divide-y divide-white/10">{runs.map(run=><div key={run.id} className="grid gap-3 px-5 py-4 md:grid-cols-[120px_1fr_110px_120px] md:items-center"><div className="text-xs font-bold capitalize">{run.agent_key}</div><div><div className="text-xs font-semibold">{run.title}</div><div className="mt-1 text-[10px] text-white/35">{run.summary||run.run_type.replaceAll("_"," ")}</div></div><Status status={run.status}/><div className="text-[10px] text-white/35">{relative(run.created_at)}</div></div>)}</div>:<Empty text="No agent runs yet. Run a full audit to create the first batch."/>}</div></section>

      <section id="findings" className="mt-10"><div className="mb-4"><div className="text-[10px] font-bold uppercase tracking-[.16em] text-violet-300">Attention queue</div><h2 className="mt-1 text-2xl font-bold">Agent findings</h2></div><div className="grid gap-3 lg:grid-cols-2">{findings.length?findings.map(f=><article key={f.id} className="rounded-[22px] border border-white/10 bg-white/[.035] p-4"><div className="flex items-center justify-between"><span className="text-[9px] font-bold uppercase tracking-[.12em] text-violet-300">{f.agent_key}</span><span className={`text-[9px] font-bold uppercase tracking-[.12em] ${["critical","high"].includes(f.severity)?"text-red-300":f.severity==="medium"?"text-amber-300":"text-white/40"}`}>{f.severity}</span></div><h3 className="mt-3 text-sm font-bold">{f.title}</h3><p className="mt-2 text-xs leading-relaxed text-white/50">{f.detail||"No additional detail."}</p>{f.path?<div className="mt-3 font-mono text-[9px] text-white/35">{f.path}</div>:null}</article>):<div className="lg:col-span-2"><Empty text="No open findings. This queue populates as agents complete audits."/></div>}</div></section>

      <section className="mt-10 rounded-[24px] border border-violet-500/20 bg-gradient-to-br from-violet-500/10 to-cyan-400/[.025] p-5"><div className="text-[10px] font-bold uppercase tracking-[.16em] text-violet-300">Safety model</div><div className="mt-2 text-base font-bold">Agents can inspect, test and prepare work. Production remains yours.</div><p className="mt-2 max-w-4xl text-xs leading-relaxed text-white/50">Builder changes stay reviewable, destructive database work should use migrations, QA uses dedicated test credentials, and production releases remain owner-approved.</p></section>
    </div>
  </main>
}

function Metric({label,value,detail}:{label:string;value:string|number;detail:string}){return <div className="rounded-[22px] border border-white/10 bg-white/[.035] p-4"><div className="text-[9px] font-bold uppercase tracking-[.12em] text-white/35">{label}</div><div className="mt-2 text-3xl font-bold tracking-[-.04em]">{value}</div><div className="mt-1 text-[10px] text-white/45">{detail}</div></div>}
function Status({status}:{status:string}){const tone=status==="running"||status==="passed"?"bg-emerald-500/10 text-emerald-300":status==="queued"?"bg-violet-500/10 text-violet-300":status==="failed"||status==="error"?"bg-red-500/10 text-red-300":status==="blocked"?"bg-amber-500/10 text-amber-300":"bg-white/[.05] text-white/40";return <span className={`mt-1 inline-block rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-[.08em] ${tone}`}>{status}</span>}
function Empty({text}:{text:string}){return <div className="rounded-[22px] border border-dashed border-white/10 px-5 py-8 text-center text-xs text-white/35">{text}</div>}
function relative(value:string|null){if(!value)return "Never";const ms=Date.now()-new Date(value).getTime();if(ms<60000)return "Just now";if(ms<3600000)return `${Math.floor(ms/60000)}m ago`;if(ms<86400000)return `${Math.floor(ms/3600000)}h ago`;return `${Math.floor(ms/86400000)}d ago`}
