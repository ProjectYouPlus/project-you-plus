import Link from "next/link";
import { requireAdmin } from "@/lib/owner/access";
import { queueAgentRun, queueFullAudit } from "@/lib/actions/agents";

export const dynamic = "force-dynamic";

type Agent = {
  agent_key: string;
  name: string;
  description: string | null;
  status: string;
  enabled: boolean;
  capabilities: string[] | null;
  last_run_at: string | null;
  last_success_at: string | null;
  last_error: string | null;
};

type RunMetadata = {
  source?: string;
  model?: string;
  recommendations?: string[];
  response_id?: string | null;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
  } | null;
};

type Run = {
  id: number;
  agent_key: string;
  run_type: string;
  title: string;
  status: string;
  summary: string | null;
  metadata: RunMetadata | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
};

type Finding = {
  id: number;
  run_id: number | null;
  agent_key: string;
  severity: string;
  title: string;
  detail: string | null;
  path: string | null;
  created_at: string;
};

const defaults: Record<string, { runType: string; title: string }> = {
  orchestrator: { runType: "orchestrate", title: "Coordinate the next Project You+ audit and prioritize work" },
  builder: { runType: "implementation_plan", title: "Turn current Project You+ findings into a concrete engineering plan" },
  qa: { runType: "regression", title: "Run full product regression risk review" },
  backend: { runType: "security", title: "Review observable Supabase security and database health signals" },
  design: { runType: "visual", title: "Review available UI and brand consistency evidence" },
  product: { runType: "analytics", title: "Analyze live funnels and product signals" },
};

const icons: Record<string, string> = {
  orchestrator: "⌘",
  builder: "</>",
  qa: "⌕",
  backend: "▣",
  design: "✦",
  product: "▥",
};

export default async function AgentOperationsPage() {
  const { supabase, user } = await requireAdmin();
  const [agentsRes, runsRes, findingsRes] = await Promise.all([
    supabase
      .from("ai_agents")
      .select("agent_key,name,description,status,enabled,capabilities,last_run_at,last_success_at,last_error")
      .order("agent_key"),
    supabase
      .from("ai_agent_runs")
      .select("id,agent_key,run_type,title,status,summary,metadata,started_at,finished_at,created_at")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("ai_agent_findings")
      .select("id,run_id,agent_key,severity,title,detail,path,created_at")
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const agents = (agentsRes.data ?? []) as Agent[];
  const runs = (runsRes.data ?? []) as Run[];
  const findings = (findingsRes.data ?? []) as Finding[];
  const working = agents.filter((a) => ["queued", "running"].includes(a.status)).length;
  const completed = runs.filter((r) => ["completed", "passed", "success"].includes(r.status)).length;
  const failed = runs.filter((r) => ["failed", "error"].includes(r.status)).length;
  const successRate = completed + failed ? Math.round((completed / (completed + failed)) * 100) : null;
  const high = findings.filter((f) => ["critical", "high"].includes(f.severity)).length;
  const medium = findings.filter((f) => f.severity === "medium").length;
  const lastActivity = runs[0]?.created_at ?? agents.map((a) => a.last_run_at).filter(Boolean).sort().at(-1) ?? null;
  const currentTasks = runs.filter((r) => ["queued", "running"].includes(r.status)).slice(0, 6);
  const recentActivity = runs.slice(0, 12);
  const healthy = !agentsRes.error && !runsRes.error && !findingsRes.error;
  const displayName = (user.user_metadata?.full_name as string | undefined) || user.email || "Owner";
  const latestRunByAgent = new Map<string, Run>();
  runs.forEach((run) => {
    if (!latestRunByAgent.has(run.agent_key)) latestRunByAgent.set(run.agent_key, run);
  });
  const findingsByRun = new Map<number, Finding[]>();
  findings.forEach((finding) => {
    if (!finding.run_id) return;
    const existing = findingsByRun.get(finding.run_id) ?? [];
    existing.push(finding);
    findingsByRun.set(finding.run_id, existing);
  });

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
        <nav className="mt-2 space-y-1 px-2 text-[12px] text-[#b7bfd3]">
          <Nav href="/owner" icon="◈" label="Overview" />
          <Nav href="/owner#users" icon="♙" label="Users" />
          <Nav href="/owner#analytics" icon="▥" label="Analytics" />
          <Nav href="/owner/agents" icon="✣" label="AI Operations" active />
          <Nav href="/owner#controls" icon="⚙" label="Feature Controls" />
          <Nav href="/owner#activity" icon="□" label="Content & Messaging" />
          <Nav href="/owner#integrations" icon="⌘" label="Integrations" />
          <Nav href="/owner#audit" icon="▤" label="Audit Log" />
          <Nav href="/owner#settings" icon="⚙" label="Settings" />
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
          <div className="flex h-9 max-w-[860px] flex-1 items-center rounded-lg border border-[#31405a] bg-[#0c1321] px-3 text-[12px] text-[#7f8aa3]">⌕&nbsp;&nbsp;Search users, agents, logs, tasks...</div>
          <div className="ml-auto hidden items-center gap-3 sm:flex">
            <span className="rounded-lg border border-[#263249] bg-[#0b111c] px-3 py-2 text-[11px]"><span className="mr-2 text-emerald-400">●</span>Live</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#4b2c9a] text-[11px] font-bold">{initials(displayName)}</div>
            <div className="text-[11px]"><div className="font-semibold">{displayName}</div><div className="text-[#8c96ab]">Owner</div></div>
          </div>
        </header>

        <div className="px-4 py-5 sm:px-5">
          <section className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[.18em] text-[#b7a2ff]">AI Operations</div>
              <h1 className="mt-1 text-[31px] font-bold tracking-[-.04em]">Your AI Team. Always Working.</h1>
              <p className="text-[14px] text-[#aeb7cd]">Build. Test. Improve. Scale. All in one place.</p>
            </div>
            <div className="flex items-center gap-7">
              <div className="hidden text-center text-[16px] italic text-[#a562ff] lg:block">“A more disciplined you,<br />a better tomorrow.”</div>
              <form action={queueFullAudit}><button className="rounded-lg border border-[#7445ef] bg-[linear-gradient(180deg,#301b68,#1b1242)] px-7 py-3 text-[11px] font-bold shadow-[0_0_24px_rgba(124,77,255,.2)]">▶ &nbsp; Run Full App Audit</button></form>
              <button className="rounded-lg border border-[#40506b] bg-[#0d1421] px-4 py-3">•••</button>
            </div>
          </section>

          <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <Metric icon="♙" label="AI Agents" value={agents.length} detail={`${agents.filter((a) => a.enabled).length} Active`} tone="blue" />
            <Metric icon="✓" label="Tasks Completed" value={completed} detail={completed ? "Across recent runs" : "No completed runs yet"} tone="green" />
            <Metric icon="ϟ" label="Issues Detected" value={findings.length} detail={`${high} High | ${medium} Medium`} tone="purple" />
            <Metric icon="◷" label="Last Agent Activity" value={lastActivity ? relative(lastActivity) : "—"} detail={runs[0]?.agent_key ? `${labelAgent(runs[0].agent_key)} Agent` : "No activity yet"} tone="blue" />
            <Metric icon="↗" label="Agent Success Rate" value={successRate === null ? "—" : `${successRate}%`} detail={successRate === null ? "No finished runs yet" : "Recent completed vs failed"} tone="green" />
          </section>

          <div className="mt-4 flex items-end justify-between">
            <div><h2 className="text-[20px] font-bold">AI Agents</h2><p className="text-[12px] text-[#9aa5bb]">Monitor, manage, and deploy your AI team.</p></div>
            <div className="hidden gap-3 sm:flex"><button className="rounded-lg border border-[#33415c] bg-[#0b1422] px-4 py-2 text-[10px]">All Agents⌄</button><button className="rounded-lg border border-[#7545ee] bg-[#24164c] px-4 py-2 text-[10px]">＋ Add Agent</button></div>
          </div>

          <section className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            {agents.map((agent) => {
              const d = defaults[agent.agent_key] ?? { runType: "manual", title: `Run ${agent.name}` };
              const lastRun = latestRunByAgent.get(agent.agent_key);
              const relatedFindings = lastRun ? findingsByRun.get(lastRun.id) ?? [] : [];
              const busy = ["queued", "running"].includes(agent.status);
              return (
                <article key={agent.agent_key} className="rounded-xl border border-[#1d2b42] bg-[linear-gradient(180deg,#0c1422,#09111c)] p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#242267] text-[17px] text-[#a98fff]">{icons[agent.agent_key] ?? "•"}</div>
                    <div>
                      <div className="text-[13px] font-bold">{agent.name}</div>
                      <div className={`mt-1 text-[10px] ${statusColor(agent.enabled ? agent.status : "offline")}`}><span className="mr-1">●</span>{agent.enabled ? prettyStatus(agent.status) : "Offline"}</div>
                    </div>
                  </div>
                  <p className="mt-3 min-h-[67px] text-[11px] leading-[1.45] text-[#a8b2c7]">{agent.description || "No description configured."}</p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div><div className="text-[9px] text-[#748197]">Last run</div><div className="text-[11px]">{relative(agent.last_run_at)}</div></div>
                    <div><div className="text-[9px] text-[#748197]">Last result</div><div className={`text-[11px] ${lastRun ? statusColor(lastRun.status) : "text-[#748197]"}`}>{lastRun ? prettyStatus(lastRun.status) : "Never"}</div></div>
                  </div>
                  <form action={queueAgentRun} className="mt-3">
                    <input type="hidden" name="agent_key" value={agent.agent_key} />
                    <input type="hidden" name="run_type" value={d.runType} />
                    <input type="hidden" name="title" value={d.title} />
                    <button disabled={!agent.enabled || busy} className="w-full rounded-md border border-[#7445ef] bg-[#24164c] px-2 py-2 text-[9px] font-semibold text-[#d4c8ff] disabled:opacity-35">{busy ? "Working…" : "▶ Run Agent"}</button>
                  </form>
                  <details className="group mt-2 rounded-md border border-[#2a3851] bg-[#0b1420]">
                    <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-[9px] text-[#aeb8cb] [&::-webkit-details-marker]:hidden">View Details <span className="transition-transform group-open:rotate-180">⌄</span></summary>
                    <div className="border-t border-[#243049] px-3 py-3 text-[9px] leading-relaxed text-[#9faac0]">
                      <Detail label="Capabilities" value={(agent.capabilities ?? []).join(" · ") || "None configured"} />
                      <Detail label="Last task" value={lastRun?.title ?? "No run yet"} />
                      <Detail label="Model" value={lastRun?.metadata?.model ?? "—"} />
                      <Detail label="Summary" value={lastRun?.summary ?? "No completed summary yet."} />
                      {(lastRun?.metadata?.recommendations?.length ?? 0) > 0 ? (
                        <div className="mt-3"><div className="text-[#71809a]">Recommendations</div><ul className="mt-1 space-y-1.5 text-[#c2cada]">{lastRun!.metadata!.recommendations!.map((r, i) => <li key={i}>• {r}</li>)}</ul></div>
                      ) : null}
                      {relatedFindings.length > 0 ? (
                        <div className="mt-3"><div className="text-[#71809a]">Findings from last run</div><div className="mt-1 space-y-1.5">{relatedFindings.map((f) => <div key={f.id}><span className={severityClass(f.severity)}>{f.severity}</span> <span className="text-[#c2cada]">{f.title}</span></div>)}</div></div>
                      ) : null}
                    </div>
                  </details>
                </article>
              );
            })}
          </section>

          <section className="mt-3 grid gap-3 xl:grid-cols-[1.25fr_.9fr_.92fr]">
            <Panel title="Agent Activity" subtitle="Click any row to expand the full run evidence.">
              <div className="mt-2 divide-y divide-[#1e2a3f]">
                {recentActivity.length ? recentActivity.map((run) => {
                  const runFindings = findingsByRun.get(run.id) ?? [];
                  return (
                    <details key={run.id} className="group">
                      <summary className="grid cursor-pointer list-none grid-cols-[55px_95px_minmax(0,1fr)_68px_14px] gap-2 py-2 text-[9px] [&::-webkit-details-marker]:hidden">
                        <span className="text-[#78859b]">{timeOnly(run.created_at)}</span>
                        <span className="font-semibold"><b className={statusColor(run.status)}>●</b> {labelAgent(run.agent_key)}</span>
                        <span className="truncate text-[#aab4c7]">{run.summary || run.title}</span>
                        <span className={`text-right font-semibold ${statusColor(run.status)}`}>{prettyStatus(run.status)}</span>
                        <span className="text-[#77839a] transition-transform group-open:rotate-180">⌄</span>
                      </summary>
                      <div className="mb-3 rounded-lg border border-[#26354d] bg-[#0a1320] p-3 text-[9px] leading-relaxed text-[#aab4c7]">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Detail label="Task" value={run.title} />
                          <Detail label="Run type" value={run.run_type.replaceAll("_", " ")} />
                          <Detail label="Started" value={run.started_at ? dateTime(run.started_at) : "—"} />
                          <Detail label="Finished" value={run.finished_at ? dateTime(run.finished_at) : "—"} />
                          <Detail label="Duration" value={duration(run.started_at, run.finished_at)} />
                          <Detail label="Model" value={run.metadata?.model ?? "—"} />
                        </div>
                        <div className="mt-3"><div className="text-[#71809a]">Full result</div><p className="mt-1 whitespace-pre-wrap text-[#d1d7e3]">{run.summary || "No summary recorded yet."}</p></div>
                        {run.metadata?.usage ? <div className="mt-3 text-[#8996ac]">Tokens: {run.metadata.usage.input_tokens ?? 0} in · {run.metadata.usage.output_tokens ?? 0} out · {run.metadata.usage.total_tokens ?? 0} total</div> : null}
                        {(run.metadata?.recommendations?.length ?? 0) > 0 ? <div className="mt-3"><div className="text-[#71809a]">Recommendations</div><ul className="mt-1 space-y-1.5 text-[#d1d7e3]">{run.metadata!.recommendations!.map((r, i) => <li key={i}>• {r}</li>)}</ul></div> : null}
                        {runFindings.length > 0 ? <div className="mt-3"><div className="text-[#71809a]">Findings</div><div className="mt-2 space-y-2">{runFindings.map((f) => <div key={f.id} className="rounded-md border border-[#28364d] bg-[#0d1725] p-2"><div className="flex items-center gap-2"><span className={`rounded px-2 py-0.5 text-[8px] font-semibold ${severityClass(f.severity)}`}>{f.severity}</span><span className="font-semibold text-[#d7ddeb]">{f.title}</span></div>{f.detail ? <p className="mt-1 text-[#9da8bc]">{f.detail}</p> : null}{f.path ? <div className="mt-1 font-mono text-[8px] text-[#71809a]">{f.path}</div> : null}</div>)}</div></div> : null}
                      </div>
                    </details>
                  );
                }) : <Empty text="No agent activity yet." />}
              </div>
            </Panel>

            <Panel title="Current Tasks" subtitle={`${currentTasks.length} active tasks`}>
              <div className="mt-2 divide-y divide-[#1e2a3f]">
                {currentTasks.length ? currentTasks.map((run) => (
                  <div key={run.id} className="py-2.5">
                    <div className="flex items-start gap-3"><div className={`mt-1 h-2 w-2 rounded-full ${run.status === "running" ? "bg-emerald-400" : "bg-amber-400"}`} /><div className="min-w-0 flex-1"><div className="text-[10px] font-semibold">{run.title}</div><div className="mt-0.5 flex justify-between text-[8px] text-[#7f8aa0]"><span>{labelAgent(run.agent_key)} Agent</span><span className={statusColor(run.status)}>{prettyStatus(run.status)}</span></div><div className="mt-1 text-[8px] text-[#64718a]">Started {relative(run.started_at ?? run.created_at)}</div></div></div>
                  </div>
                )) : <Empty text="No queued or running tasks. Agents are ready for the next run." />}
              </div>
            </Panel>

            <div className="space-y-3">
              <Panel title="System Health">
                <HealthRow label="App" value={healthy ? "Healthy" : "Issue"} healthy={healthy} />
                <HealthRow label="Supabase" value={healthy ? "Healthy" : "Issue"} healthy={healthy} />
                <HealthRow label="OpenAI" value={runs.some((r) => r.metadata?.source === "openai" && r.status === "passed") ? "Connected" : "No successful run yet"} healthy={runs.some((r) => r.metadata?.source === "openai" && r.status === "passed")} />
                <HealthRow label="GitHub" value="External status not wired" />
                <HealthRow label="Vercel" value="External status not wired" />
                <HealthRow label="Figma" value="External status not wired" />
              </Panel>
              <Panel title="Recent Findings">
                <div className="mt-2 space-y-2">{findings.slice(0, 4).map((f) => <details key={f.id} className="group"><summary className="grid cursor-pointer list-none grid-cols-[55px_1fr_auto_12px] items-center gap-2 text-[8px] [&::-webkit-details-marker]:hidden"><span className={`rounded px-2 py-1 text-center font-semibold ${severityClass(f.severity)}`}>{f.severity}</span><span className="truncate">{f.title}</span><span className="text-[#77839a]">{relative(f.created_at)}</span><span className="transition-transform group-open:rotate-180">⌄</span></summary><div className="mt-2 rounded-md border border-[#26354d] bg-[#0a1320] p-2 text-[8px] leading-relaxed text-[#9da8bc]">{f.detail || "No additional detail."}{f.path ? <div className="mt-1 font-mono text-[#71809a]">{f.path}</div> : null}</div></details>)}{findings.length === 0 ? <Empty text="No open findings." /> : null}</div>
              </Panel>
            </div>
          </section>

          <section className="mt-3 grid gap-3 xl:grid-cols-[1fr_340px]">
            <Panel title="Quick Actions">
              <div className="mt-3 grid gap-2 sm:grid-cols-4">
                <form action={queueFullAudit}><button className="w-full rounded-lg border border-[#43536f] bg-[#101a29] px-3 py-3 text-[9px]">▷ &nbsp; Run Full App Audit</button></form>
                <Link href="/owner/agents" className="rounded-lg border border-[#43536f] bg-[#101a29] px-3 py-3 text-center text-[9px]">♙ &nbsp; Refresh Agent Status</Link>
                <Link href="#findings" className="rounded-lg border border-[#43536f] bg-[#101a29] px-3 py-3 text-center text-[9px]">□ &nbsp; Review Findings</Link>
                <Link href="/dashboard" className="rounded-lg border border-[#43536f] bg-[#101a29] px-3 py-3 text-center text-[9px]">⇧ &nbsp; Open App</Link>
              </div>
            </Panel>
            <div className="flex items-center justify-center rounded-xl border border-[#251f4f] bg-[linear-gradient(135deg,#171033,#0c1220)] p-5 text-center"><div><div className="text-[18px] font-semibold italic text-[#9b5dff]">“You vs 24.<br />Win Every Day.”</div><div className="mt-4 text-[8px] tracking-[.28em] text-[#c9d0e0]">PROJECT YOU+</div></div></div>
          </section>
        </div>
      </div>
    </main>
  );
}

function Nav({ href, icon, label, active = false }: { href: string; icon: string; label: string; active?: boolean }) {
  return <Link href={href} className={`flex items-center gap-3 rounded-lg px-3 py-2 ${active ? "border border-[#7445ef] bg-[#281950] text-[#d1c5ff]" : "hover:bg-white/[.03]"}`}><span className="w-4 text-center text-[14px]">{icon}</span>{label}</Link>;
}

function Metric({ icon, label, value, detail, tone }: { icon: string; label: string; value: string | number; detail: string; tone: string }) {
  const c = tone === "green" ? "text-emerald-300" : tone === "purple" ? "text-[#b873ff]" : "text-blue-300";
  return <div className="rounded-xl border border-[#1f3768] bg-[linear-gradient(145deg,#0d1831,#0b1221)] p-4"><div className="flex items-center gap-3"><span className={`flex h-9 w-9 items-center justify-center rounded-lg bg-[#1d2951] ${c}`}>{icon}</span><div><div className="text-[23px] font-bold leading-none">{value}</div><div className="mt-1 text-[10px] text-[#bec7d9]">{label}</div></div></div><div className={`mt-2 text-[9px] ${c}`}>{detail}</div></div>;
}

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return <div className="rounded-xl border border-[#1b293f] bg-[linear-gradient(180deg,#0b121f,#09101a)] p-3.5"><div className="flex items-start justify-between"><div><div className="text-[12px] font-semibold">{title}</div>{subtitle ? <div className="mt-0.5 text-[8px] text-[#8793a9]">{subtitle}</div> : null}</div></div>{children}</div>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><div className="text-[#71809a]">{label}</div><div className="mt-0.5 whitespace-pre-wrap text-[#c7cfde]">{value}</div></div>;
}

function HealthRow({ label, value, healthy }: { label: string; value: string; healthy?: boolean }) {
  return <div className="mt-2 flex items-center justify-between text-[9px]"><span>{label}</span><span className={healthy === true ? "text-emerald-300" : healthy === false ? "text-amber-300" : "text-[#7f8aa0]"}>{value}</span></div>;
}

function Empty({ text }: { text: string }) { return <div className="py-5 text-center text-[9px] text-[#707d94]">{text}</div>; }
function prettyStatus(s: string) { return s === "running" ? "Running" : s === "queued" ? "Queued" : s === "idle" ? "Idle" : s === "testing" ? "Testing" : s === "passed" ? "Passed" : s === "failed" ? "Failed" : s === "blocked" ? "Blocked" : s; }
function statusColor(s: string) { return ["running", "passed", "completed", "success", "testing"].includes(s) ? "text-emerald-300" : s === "queued" ? "text-amber-300" : ["failed", "error"].includes(s) ? "text-red-300" : s === "blocked" ? "text-amber-300" : "text-blue-300"; }
function severityClass(s: string) { return ["critical", "high"].includes(s) ? "bg-red-500/15 text-red-300" : s === "medium" ? "bg-amber-500/15 text-amber-300" : "bg-blue-500/15 text-blue-300"; }
function initials(v: string) { return v.split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map((x) => x[0]?.toUpperCase()).join("") || "OU"; }
function labelAgent(k: string) { return k.split("_").map((x) => x[0]?.toUpperCase() + x.slice(1)).join(" "); }
function relative(v: string | null) { if (!v) return "Never"; const ms = Date.now() - new Date(v).getTime(); if (ms < 60e3) return "Just now"; if (ms < 36e5) return `${Math.floor(ms / 60e3)}m ago`; if (ms < 864e5) return `${Math.floor(ms / 36e5)}h ago`; return `${Math.floor(ms / 864e5)}d ago`; }
function timeOnly(v: string) { return new Date(v).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }); }
function dateTime(v: string) { return new Date(v).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit" }); }
function duration(start: string | null, end: string | null) { if (!start || !end) return "—"; const ms = Math.max(0, new Date(end).getTime() - new Date(start).getTime()); if (ms < 1000) return `${ms} ms`; if (ms < 60000) return `${(ms / 1000).toFixed(1)} sec`; return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`; }
