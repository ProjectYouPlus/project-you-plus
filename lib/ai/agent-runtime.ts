import type { SupabaseClient } from "@supabase/supabase-js";

export type AgentKey = "orchestrator" | "builder" | "qa" | "backend" | "design" | "product";

type AgentFinding = {
  severity: "info" | "low" | "medium" | "high" | "critical";
  title: string;
  detail: string;
  path: string | null;
};

type AgentResult = {
  summary: string;
  findings: AgentFinding[];
  recommendations: string[];
};

type RunArgs = {
  supabase: SupabaseClient;
  runId: number;
  agentKey: AgentKey;
  title: string;
  runType: string;
};

const agentInstructions: Record<AgentKey, string> = {
  orchestrator:
    "You are the Project You+ Development Orchestrator. Coordinate engineering work, prioritize risk, and propose the next highest-value actions. Never claim a change was executed unless the supplied context proves it. Production releases require owner approval.",
  builder:
    "You are the Project You+ Builder Agent. Review supplied product findings and technical context, identify likely implementation work, and produce precise engineering recommendations. Do not claim code was changed unless supplied context proves it.",
  qa:
    "You are the Project You+ QA Agent. Look for product regression risk, broken flows, auth/navigation problems, mobile risks, and missing test coverage using only the supplied evidence. Clearly distinguish observed evidence from tests that still need to run.",
  backend:
    "You are the Project You+ Backend Agent. Review observable Supabase/auth/app configuration signals for security, reliability, data integrity, and performance risk. Do not pretend you inspected database internals that are not in the supplied context.",
  design:
    "You are the Project You+ Design QA Agent. The locked target is a premium dark Project You+ experience with exact owner and AI Operations references. Use supplied route/product context to flag likely consistency or usability risks. Never claim visual inspection unless screenshots or visual evidence are supplied.",
  product:
    "You are the Project You+ Product Analyst. Analyze real usage, onboarding, sign-in, route activity, feature availability, and retention signals. Prioritize specific evidence-backed opportunities and avoid invented metrics.",
};

const resultSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string" },
    findings: {
      type: "array",
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          severity: { type: "string", enum: ["info", "low", "medium", "high", "critical"] },
          title: { type: "string" },
          detail: { type: "string" },
          path: { anyOf: [{ type: "string" }, { type: "null" }] },
        },
        required: ["severity", "title", "detail", "path"],
      },
    },
    recommendations: {
      type: "array",
      maxItems: 8,
      items: { type: "string" },
    },
  },
  required: ["summary", "findings", "recommendations"],
} as const;

export async function runAgentWithOpenAI({ supabase, runId, agentKey, title, runType }: RunArgs) {
  const startedAt = new Date().toISOString();
  await supabase.from("ai_agent_runs").update({ status: "running", started_at: startedAt }).eq("id", runId);
  await supabase
    .from("ai_agents")
    .update({ status: "running", last_run_at: startedAt, last_error: null, updated_at: startedAt })
    .eq("agent_key", agentKey);

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    const message = "OpenAI API key is not configured in the server environment.";
    await markBlocked(supabase, runId, agentKey, message);
    return { ok: false as const, blocked: true as const, message };
  }

  try {
    const context = await buildAgentContext(supabase, agentKey);
    const model = process.env.OPENAI_AGENT_MODEL || "gpt-5.6-terra";

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        instructions: agentInstructions[agentKey],
        input: `Task: ${title}\nRun type: ${runType}\n\nUse only the following Project You+ evidence. Do not invent facts.\n\n${JSON.stringify(context)}`,
        reasoning: { effort: agentKey === "builder" || agentKey === "backend" ? "medium" : "low" },
        max_output_tokens: 1400,
        store: false,
        text: {
          verbosity: "low",
          format: {
            type: "json_schema",
            name: "project_you_agent_result",
            strict: true,
            schema: resultSchema,
          },
        },
        metadata: {
          app: "project-you-plus",
          agent: agentKey,
          run_id: String(runId),
        },
      }),
      signal: AbortSignal.timeout(25_000),
    });

    const raw = await response.json();
    if (!response.ok) {
      const message = raw?.error?.message || `OpenAI request failed with status ${response.status}`;
      throw new Error(message);
    }

    const text = extractOutputText(raw);
    if (!text) throw new Error("OpenAI returned no structured text output.");
    const result = JSON.parse(text) as AgentResult;

    if (result.findings?.length) {
      const rows = result.findings.map((finding) => ({
        run_id: runId,
        agent_key: agentKey,
        severity: finding.severity,
        title: finding.title.slice(0, 200),
        detail: finding.detail.slice(0, 4000),
        path: finding.path ? finding.path.slice(0, 500) : null,
        status: "open",
        metadata: { source: "openai", model },
      }));
      const { error: findingsError } = await supabase.from("ai_agent_findings").insert(rows);
      if (findingsError) throw findingsError;
    }

    const finishedAt = new Date().toISOString();
    const usage = raw?.usage ?? null;
    await supabase
      .from("ai_agent_runs")
      .update({
        status: "passed",
        summary: result.summary.slice(0, 4000),
        finished_at: finishedAt,
        metadata: {
          source: "openai",
          model,
          recommendations: result.recommendations ?? [],
          usage,
          response_id: raw?.id ?? null,
        },
      })
      .eq("id", runId);

    await supabase
      .from("ai_agents")
      .update({ status: "idle", last_success_at: finishedAt, last_error: null, updated_at: finishedAt })
      .eq("agent_key", agentKey);

    return { ok: true as const, result };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown agent runtime error";
    const finishedAt = new Date().toISOString();
    await supabase
      .from("ai_agent_runs")
      .update({ status: "failed", summary: message.slice(0, 4000), finished_at: finishedAt })
      .eq("id", runId);
    await supabase
      .from("ai_agents")
      .update({ status: "error", last_error: message.slice(0, 4000), updated_at: finishedAt })
      .eq("agent_key", agentKey);
    return { ok: false as const, blocked: false as const, message };
  }
}

async function markBlocked(supabase: SupabaseClient, runId: number, agentKey: AgentKey, message: string) {
  const now = new Date().toISOString();
  await supabase
    .from("ai_agent_runs")
    .update({ status: "blocked", summary: message, finished_at: now })
    .eq("id", runId);
  await supabase
    .from("ai_agents")
    .update({ status: "blocked", last_error: message, updated_at: now })
    .eq("agent_key", agentKey);
}

async function buildAgentContext(supabase: SupabaseClient, agentKey: AgentKey) {
  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();

  const commonPromise = Promise.all([
    supabase.from("app_modules").select("module_key,label,enabled,rollout_percent,locked").order("label"),
    supabase.from("app_settings").select("setting_key,label,value").order("setting_key"),
    supabase.from("ai_agent_findings").select("agent_key,severity,title,detail,path,status,created_at").eq("status", "open").order("created_at", { ascending: false }).limit(30),
    supabase.from("ai_agent_runs").select("agent_key,run_type,title,status,summary,created_at").order("created_at", { ascending: false }).limit(30),
  ]);

  if (agentKey === "product") {
    const [common, usersRes, activityRes, loginRes] = await Promise.all([
      commonPromise,
      supabase.from("user_directory").select("user_id,created_at,last_sign_in_at,onboarding_completed"),
      supabase.from("activity_events").select("user_id,event_name,path,occurred_at").gte("occurred_at", sevenDaysAgo).limit(5000),
      supabase.from("login_events").select("user_id,event_type,city,region,country,device_family,browser,os,occurred_at").gte("occurred_at", sevenDaysAgo).limit(2000),
    ]);
    const [modules, settings, findings, runs] = common;
    return {
      evidence_scope: "Live product analytics available through Supabase. No invented benchmarks.",
      modules: modules.data ?? [],
      settings: settings.data ?? [],
      open_findings: findings.data ?? [],
      recent_agent_runs: runs.data ?? [],
      users: usersRes.data ?? [],
      activity_events_7d: activityRes.data ?? [],
      login_events_7d: loginRes.data ?? [],
    };
  }

  if (agentKey === "orchestrator") {
    const [common, agentsRes] = await Promise.all([
      commonPromise,
      supabase.from("ai_agents").select("agent_key,name,status,enabled,capabilities,last_run_at,last_success_at,last_error").order("agent_key"),
    ]);
    const [modules, settings, findings, runs] = common;
    return {
      evidence_scope: "Agent fleet, current findings, product controls, and recent runs.",
      agents: agentsRes.data ?? [],
      modules: modules.data ?? [],
      settings: settings.data ?? [],
      open_findings: findings.data ?? [],
      recent_agent_runs: runs.data ?? [],
    };
  }

  if (agentKey === "backend") {
    const [common, auditRes] = await Promise.all([
      commonPromise,
      supabase.from("admin_audit_log").select("action,target_type,target_id,created_at").order("created_at", { ascending: false }).limit(50),
    ]);
    const [modules, settings, findings, runs] = common;
    return {
      evidence_scope: "Observable app settings, modules, admin audit history, and agent findings. This is not a Supabase management/advisor scan.",
      modules: modules.data ?? [],
      settings: settings.data ?? [],
      admin_audit: auditRes.data ?? [],
      open_findings: findings.data ?? [],
      recent_agent_runs: runs.data ?? [],
    };
  }

  const [modules, settings, findings, runs] = await commonPromise;
  return {
    evidence_scope:
      agentKey === "design"
        ? "No screenshot/visual payload is supplied in this runtime yet; only product configuration and existing findings may be assessed."
        : agentKey === "qa"
          ? "No live browser execution is supplied in this OpenAI runtime; analyze regression risk and existing evidence only."
          : "Use open findings and recent runs to produce an implementation plan. No repository write access is supplied to this runtime yet.",
    modules: modules.data ?? [],
    settings: settings.data ?? [],
    open_findings: findings.data ?? [],
    recent_agent_runs: runs.data ?? [],
  };
}

function extractOutputText(response: any): string {
  if (typeof response?.output_text === "string") return response.output_text;
  const pieces: string[] = [];
  for (const item of response?.output ?? []) {
    if (item?.type !== "message") continue;
    for (const content of item?.content ?? []) {
      if (content?.type === "output_text" && typeof content?.text === "string") pieces.push(content.text);
    }
  }
  return pieces.join("\n");
}
