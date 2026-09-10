"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/owner/access";
import { runAgentWithOpenAI, type AgentKey } from "@/lib/ai/agent-runtime";

const AGENT_KEYS: AgentKey[] = ["orchestrator", "builder", "qa", "backend", "design", "product"];

function parseAgent(value: FormDataEntryValue | null): AgentKey {
  const key = String(value ?? "") as AgentKey;
  if (!AGENT_KEYS.includes(key)) throw new Error("Unknown agent");
  return key;
}

export async function queueAgentRun(formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const agentKey = parseAgent(formData.get("agent_key"));
  const title = String(formData.get("title") ?? "Manual agent run").slice(0, 160);
  const runType = String(formData.get("run_type") ?? "manual").slice(0, 80);
  const now = new Date().toISOString();

  const { data: agent } = await supabase
    .from("ai_agents")
    .select("enabled,status")
    .eq("agent_key", agentKey)
    .maybeSingle();

  if (!agent?.enabled) throw new Error("This agent is disabled.");
  if (["queued", "running"].includes(agent.status)) return;

  const { data: run, error } = await supabase
    .from("ai_agent_runs")
    .insert({
      agent_key: agentKey,
      requested_by: user.id,
      run_type: runType,
      title,
      status: "queued",
      metadata: { source: "owner_command_center" },
    })
    .select("id")
    .single();
  if (error) throw error;

  await supabase
    .from("ai_agents")
    .update({ status: "queued", last_run_at: now, updated_at: now })
    .eq("agent_key", agentKey);

  await runAgentWithOpenAI({
    supabase,
    runId: Number(run.id),
    agentKey,
    title,
    runType,
  });

  revalidatePath("/owner/agents");
}

export async function queueFullAudit() {
  const { supabase, user } = await requireAdmin();
  const now = new Date().toISOString();
  const jobs: Array<{ agent_key: AgentKey; run_type: string; title: string }> = [
    { agent_key: "qa", run_type: "regression", title: "Run full product regression risk review" },
    { agent_key: "backend", run_type: "security", title: "Review observable Supabase security and database health signals" },
    { agent_key: "design", run_type: "visual", title: "Review available UI and brand consistency evidence" },
    { agent_key: "product", run_type: "analytics", title: "Analyze live funnels and product signals" },
  ];

  const { data: enabledAgents } = await supabase
    .from("ai_agents")
    .select("agent_key,enabled,status")
    .in("agent_key", jobs.map((job) => job.agent_key));

  const allowed = new Set(
    (enabledAgents ?? [])
      .filter((agent) => agent.enabled && !["queued", "running"].includes(agent.status))
      .map((agent) => agent.agent_key as AgentKey)
  );
  const runnableJobs = jobs.filter((job) => allowed.has(job.agent_key));
  if (!runnableJobs.length) return;

  const { data: runs, error } = await supabase
    .from("ai_agent_runs")
    .insert(
      runnableJobs.map((job) => ({
        agent_key: job.agent_key,
        requested_by: user.id,
        run_type: job.run_type,
        title: job.title,
        status: "queued",
        metadata: { source: "orchestrator", batch: now },
      }))
    )
    .select("id,agent_key,run_type,title");
  if (error) throw error;

  await supabase
    .from("ai_agents")
    .update({ status: "queued", last_run_at: now, updated_at: now })
    .in("agent_key", runnableJobs.map((job) => job.agent_key));

  await Promise.allSettled(
    (runs ?? []).map((run) =>
      runAgentWithOpenAI({
        supabase,
        runId: Number(run.id),
        agentKey: run.agent_key as AgentKey,
        title: run.title,
        runType: run.run_type,
      })
    )
  );

  const finishedAt = new Date().toISOString();
  await supabase
    .from("ai_agents")
    .update({ status: "idle", last_success_at: finishedAt, last_error: null, updated_at: finishedAt })
    .eq("agent_key", "orchestrator");

  revalidatePath("/owner/agents");
}
