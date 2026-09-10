"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/owner/access";

const AGENT_KEYS = ["orchestrator", "builder", "qa", "backend", "design", "product"] as const;
type AgentKey = (typeof AGENT_KEYS)[number];

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

  const { error } = await supabase.from("ai_agent_runs").insert({
    agent_key: agentKey,
    requested_by: user.id,
    run_type: runType,
    title,
    status: "queued",
    metadata: { source: "owner_command_center" },
  });
  if (error) throw error;

  await supabase.from("ai_agents").update({ status: "queued", last_run_at: now, updated_at: now }).eq("agent_key", agentKey);
  revalidatePath("/owner/agents");
}

export async function queueFullAudit() {
  const { supabase, user } = await requireAdmin();
  const now = new Date().toISOString();
  const jobs = [
    ["qa", "regression", "Run full product regression"],
    ["backend", "security", "Review Supabase security and database health"],
    ["design", "visual", "Review UI and brand consistency"],
    ["product", "analytics", "Analyze funnels and product signals"],
  ];

  const { error } = await supabase.from("ai_agent_runs").insert(jobs.map(([agent_key, run_type, title]) => ({
    agent_key,
    requested_by: user.id,
    run_type,
    title,
    status: "queued",
    metadata: { source: "orchestrator", batch: now },
  })));
  if (error) throw error;

  await supabase.from("ai_agents").update({ status: "queued", last_run_at: now, updated_at: now }).in("agent_key", ["qa", "backend", "design", "product"]);
  await supabase.from("ai_agents").update({ status: "running", last_run_at: now, updated_at: now }).eq("agent_key", "orchestrator");
  revalidatePath("/owner/agents");
}
