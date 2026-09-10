"use client";

import { useMemo, useState } from "react";
import { DAILY_ENGINE, MARKETING_AGENTS, type MarketingAgentId } from "@/lib/marketing/agents";

type RunResult = {
  agentId: MarketingAgentId;
  agentName: string;
  role: string;
  output: string;
  generatedAt: string;
};

type AgentState = "ready" | "running" | "review" | "idle";

const initialStates: Record<MarketingAgentId, AgentState> = {
  orchestrator: "ready",
  strategy: "ready",
  reels: "ready",
  creative: "ready",
  copy: "ready",
  trends: "ready",
  analytics: "ready",
  community: "ready",
  partnerships: "ready",
};

const samplePipeline = [
  { stage: "Idea", count: 12, detail: "Trend + strategy backlog" },
  { stage: "Production", count: 4, detail: "Scripts, covers, carousels" },
  { stage: "Approval", count: 3, detail: "Needs owner decision" },
  { stage: "Scheduled", count: 2, detail: "Ready to publish" },
  { stage: "Learning", count: 7, detail: "24h performance review" },
];

const sampleMetrics = [
  { label: "7D Reach", value: "—", note: "Connect Instagram data" },
  { label: "Share Rate", value: "—", note: "Primary quality KPI" },
  { label: "Profile → Follow", value: "—", note: "Measure positioning" },
  { label: "Content Velocity", value: "2/day", note: "Target publishing pace" },
];

export function MarketingOpsDashboard() {
  const [states, setStates] = useState(initialStates);
  const [activeAgent, setActiveAgent] = useState<MarketingAgentId>("orchestrator");
  const [results, setResults] = useState<Partial<Record<MarketingAgentId, RunResult>>>({});
  const [objective, setObjective] = useState("Grow qualified Instagram awareness for Project You+ and create a repeatable daily content engine.");
  const [context, setContext] = useState("Instagram-first. Premium positioning. Organic growth. Prioritize Reels, carousels, founder-led product storytelling, saves, shares, profile visits and qualified waitlist intent.");
  const [error, setError] = useState("");

  const selected = useMemo(
    () => MARKETING_AGENTS.find((agent) => agent.id === activeAgent) ?? MARKETING_AGENTS[0],
    [activeAgent]
  );

  async function runAgent(agentId: MarketingAgentId) {
    setError("");
    setActiveAgent(agentId);
    setStates((current) => ({ ...current, [agentId]: "running" }));
    try {
      const response = await fetch("/api/marketing-ops/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ agentId, objective, context }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Agent run failed");
      setResults((current) => ({ ...current, [agentId]: data }));
      setStates((current) => ({ ...current, [agentId]: "review" }));
    } catch (err) {
      setStates((current) => ({ ...current, [agentId]: "ready" }));
      setError(err instanceof Error ? err.message : "Agent run failed");
    }
  }

  return (
    <main className="min-h-screen bg-[#07070b] text-white">
      <div className="mx-auto max-w-[1500px] px-4 py-5 sm:px-6 lg:px-8">
        <header className="mb-6 flex flex-col gap-4 border-b border-white/10 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-violet-300">
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,.8)]" />
              Owner Command Center
            </div>
            <h1 className="text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Marketing Operations</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-white/55 sm:text-base">
              Nine specialized agents coordinated around one Instagram-first growth engine for Project You+.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => runAgent("orchestrator")}
              className="rounded-2xl border border-violet-400/30 bg-violet-500 px-5 py-3 text-sm font-semibold shadow-[0_12px_40px_rgba(124,58,237,.28)] transition hover:bg-violet-400"
            >
              Run Daily Brief
            </button>
          </div>
        </header>

        {error ? (
          <div className="mb-5 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>
        ) : null}

        <section className="grid gap-4 xl:grid-cols-[1.3fr_.7fr]">
          <div className="rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(124,58,237,.22),transparent_34%),linear-gradient(180deg,rgba(255,255,255,.055),rgba(255,255,255,.025))] p-5 shadow-2xl shadow-black/30 sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-white/40">Today&apos;s Objective</p>
                <h2 className="mt-2 text-xl font-medium tracking-tight">One goal. One operating loop. Every agent aligned.</h2>
              </div>
              <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-300">Engine Online</span>
            </div>
            <textarea
              value={objective}
              onChange={(event) => setObjective(event.target.value)}
              className="min-h-24 w-full resize-none rounded-2xl border border-white/10 bg-black/25 p-4 text-sm leading-6 text-white outline-none transition placeholder:text-white/25 focus:border-violet-400/50"
            />
            <textarea
              value={context}
              onChange={(event) => setContext(event.target.value)}
              className="mt-3 min-h-24 w-full resize-none rounded-2xl border border-white/10 bg-black/20 p-4 text-sm leading-6 text-white/70 outline-none transition focus:border-violet-400/50"
            />
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {sampleMetrics.map((metric) => (
                <div key={metric.label} className="rounded-2xl border border-white/8 bg-white/[0.035] p-4">
                  <div className="text-xs text-white/38">{metric.label}</div>
                  <div className="mt-2 text-2xl font-semibold tracking-tight">{metric.value}</div>
                  <div className="mt-1 text-xs text-white/35">{metric.note}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-white/[0.035] p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-white/40">Content Engine</p>
                <h2 className="mt-1 text-lg font-medium">Pipeline health</h2>
              </div>
              <span className="text-xs text-white/35">Instagram · Organic</span>
            </div>
            <div className="mt-5 space-y-3">
              {samplePipeline.map((item, index) => (
                <div key={item.stage} className="flex items-center gap-4 rounded-2xl border border-white/8 bg-black/20 px-4 py-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-violet-400/20 bg-violet-500/10 text-sm font-semibold text-violet-200">{item.count}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{item.stage}</span>
                      <span className="text-[11px] text-white/25">0{index + 1}</span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-white/38">{item.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-4 grid gap-4 2xl:grid-cols-[1fr_390px]">
          <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5 sm:p-6">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-white/40">Agent Floor</p>
                <h2 className="mt-1 text-lg font-medium">Specialist team</h2>
              </div>
              <div className="text-xs text-white/35">{MARKETING_AGENTS.length} agents</div>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {MARKETING_AGENTS.map((agent, index) => {
                const state = states[agent.id];
                const active = agent.id === activeAgent;
                return (
                  <button
                    key={agent.id}
                    onClick={() => setActiveAgent(agent.id)}
                    className={`group rounded-2xl border p-4 text-left transition ${active ? "border-violet-400/45 bg-violet-500/10" : "border-white/8 bg-black/15 hover:border-white/16 hover:bg-white/[0.04]"}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-sm font-semibold text-violet-200">{String(index + 1).padStart(2, "0")}</div>
                        <div>
                          <div className="font-medium">{agent.name}</div>
                          <div className="text-xs text-white/38">{agent.role}</div>
                        </div>
                      </div>
                      <span className={`mt-1 h-2.5 w-2.5 rounded-full ${state === "running" ? "animate-pulse bg-amber-300" : state === "review" ? "bg-violet-300" : "bg-emerald-400"}`} />
                    </div>
                    <p className="mt-4 line-clamp-2 text-xs leading-5 text-white/48">{agent.objective}</p>
                    <div className="mt-4 flex items-center justify-between text-[11px]">
                      <span className="text-white/28">{agent.cadence}</span>
                      <span className="capitalize text-white/50">{state}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <aside className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(124,58,237,.10),rgba(255,255,255,.025))] p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-violet-300/70">Selected Agent</p>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight">{selected.name}</h2>
                <p className="text-sm text-white/45">{selected.role}</p>
              </div>
              <button
                onClick={() => runAgent(selected.id)}
                disabled={states[selected.id] === "running"}
                className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs font-semibold transition hover:bg-white/15 disabled:cursor-wait disabled:opacity-50"
              >
                {states[selected.id] === "running" ? "Running…" : "Run"}
              </button>
            </div>

            <p className="mt-5 text-sm leading-6 text-white/60">{selected.objective}</p>

            <div className="mt-5 grid gap-4">
              <div>
                <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-white/30">Produces</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {selected.outputs.map((output) => (
                    <span key={output} className="rounded-full border border-white/8 bg-black/20 px-3 py-1 text-[11px] text-white/48">{output}</span>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-white/30">Needs</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {selected.inputs.map((input) => (
                    <span key={input} className="rounded-full border border-white/8 bg-black/20 px-3 py-1 text-[11px] text-white/48">{input}</span>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 border-t border-white/10 pt-5">
              <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-white/30">Latest Output</div>
              {results[selected.id] ? (
                <div className="max-h-[420px] overflow-y-auto whitespace-pre-wrap rounded-2xl border border-violet-400/15 bg-black/30 p-4 text-xs leading-6 text-white/68">
                  {results[selected.id]?.output}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 bg-black/10 p-5 text-sm leading-6 text-white/35">
                  Run this agent to generate its first execution-ready deliverable.
                </div>
              )}
            </div>
          </aside>
        </section>

        <section className="mt-4 rounded-[28px] border border-white/10 bg-white/[0.028] p-5 sm:p-6">
          <div className="mb-5">
            <p className="text-xs uppercase tracking-[0.18em] text-white/40">Daily Operating Loop</p>
            <h2 className="mt-1 text-lg font-medium">Repeatable content engine</h2>
          </div>
          <div className="grid gap-3 lg:grid-cols-3">
            {DAILY_ENGINE.map((step, index) => (
              <div key={step} className="flex gap-3 rounded-2xl border border-white/8 bg-black/15 p-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-xs font-semibold text-violet-200">{index + 1}</div>
                <p className="text-sm leading-6 text-white/55">{step}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
