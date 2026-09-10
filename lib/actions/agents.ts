"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/owner/access";
import { runAgentWithOpenAI, type AgentKey } from "@/lib/ai/agent-runtime";
import { runBuilderFix } from "@/lib/ai/builder-fix-runtime";

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
      run_type: agentKey === "builder" ? "fix_pr" : runType,
      title: agentKey === "builder" ? "Create a safe fix pull request for the highest-priority open root issue" : title,
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

  if (agentKey === "builder") {
    await runBuilderFix({ supabase, runId: Number(run.id) });
  } else {
    await runAgentWithOpenAI({ supabase, runId: Number(run.id), agentKey, title, runType });
  }
  revalidatePath("/owner/agents");
}

export async function queueFullAudit() {
  const { supabase, user } = await requireAdmin();
  const now = new Date().toISOString();
  const auditJobs: Array<{ agent_key: AgentKey; run_type: string; title: string }> = [
    { agent_key: "qa", run_type: "regression", title: "Run full product regression risk review" },
    { agent_key: "backend", run_type: "security", title: "Review observable Supabase security and database health signals" },
    { agent_key: "design", run_type: "visual", title: "Review available UI and brand consistency evidence" },
    { agent_key: "product", run_type: "analytics", title: "Analyze live funnels and product signals" },
  ];

  const { data: enabledAgents } = await supabase
    .from("ai_agents")
    .select("agent_key,enabled,status")
    .in("agent_key", AGENT_KEYS);

  const allowed = new Set(
    (enabledAgents ?? [])
      .filter((agent) => agent.enabled && !["queued", "running"].includes(agent.status))
      .map((agent) => agent.agent_key as AgentKey)
  );

  const runnableAuditJobs = auditJobs.filter((job) => allowed.has(job.agent_key));
  if (runnableAuditJobs.length) {
    const { data: runs, error } = await supabase
      .from("ai_agent_runs")
      .insert(
        runnableAuditJobs.map((job) => ({
          agent_key: job.agent_key,
          requested_by: user.id,
          run_type: job.run_type,
          title: job.title,
          status: "queued",
          metadata: { source: "orchestrator", batch: now, phase: "audit" },
        }))
      )
      .select("id,agent_key,run_type,title");
    if (error) throw error;

    await supabase
      .from("ai_agents")
      .update({ status: "queued", last_run_at: now, updated_at: now })
      .in("agent_key", runnableAuditJobs.map((job) => job.agent_key));

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
  }

  if (allowed.has("orchestrator")) {
    const { data: run, error } = await supabase
      .from("ai_agent_runs")
      .insert({
        agent_key: "orchestrator",
        requested_by: user.id,
        run_type: "orchestrate",
        title: "Prioritize the latest Project You+ audit findings and next actions",
        status: "queued",
        metadata: { source: "owner_command_center", batch: now, phase: "prioritize" },
      })
      .select("id")
      .single();
    if (error) throw error;
    await runAgentWithOpenAI({
      supabase,
      runId: Number(run.id),
      agentKey: "orchestrator",
      title: "Prioritize the latest Project You+ audit findings and next actions",
      runType: "orchestrate",
    });
  }

  if (allowed.has("builder")) {
    const { data: run, error } = await supabase
      .from("ai_agent_runs")
      .insert({
        agent_key: "builder",
        requested_by: user.id,
        run_type: "fix_pr",
        title: "Create a safe fix pull request for the highest-priority open root issue",
        status: "queued",
        metadata: { source: "orchestrator", batch: now, phase: "fix_pr" },
      })
      .select("id")
      .single();
    if (error) throw error;
    await runBuilderFix({ supabase, runId: Number(run.id) });
  }

  revalidatePath("/owner/agents");
}
