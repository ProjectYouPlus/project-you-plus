import type { SupabaseClient } from "@supabase/supabase-js";

const REPO = "ProjectYouPlus/project-you-plus";
const API = `https://api.github.com/repos/${REPO}`;
const MODEL = process.env.OPENAI_AGENT_MODEL || "gpt-5.6-terra";
const severityRank: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
const SKIP_FIX_STATUSES = new Set(["needs_owner", "draft_pr_open", "pr_open"]);

type Finding = {
  id: number;
  severity: string;
  title: string;
  detail: string | null;
  path: string | null;
  metadata: Record<string, unknown> | null;
};

type FileSource = { path: string; sha: string; content: string };
type Replacement = { old_text: string; new_text: string; reason: string };
type Change = { path: string; replacements: Replacement[] };
type Proposal = {
  can_fix: boolean;
  blocker: string;
  summary: string;
  changes: Change[];
  tests: string[];
};
type SafetyReview = {
  approved: boolean;
  verdict: string;
  reasons: string[];
  required_tests: string[];
};

type ChangedFile = FileSource & { nextContent: string; reasons: string[] };

export async function runBuilderFix({ supabase, runId }: { supabase: SupabaseClient; runId: number }) {
  const startedAt = new Date().toISOString();
  await supabase.from("ai_agent_runs").update({ status: "running", started_at: startedAt }).eq("id", runId);
  await supabase
    .from("ai_agents")
    .update({ status: "running", last_run_at: startedAt, last_error: null, updated_at: startedAt })
    .eq("agent_key", "builder");

  const openAIKey = process.env.OPENAI_API_KEY;
  const githubToken = process.env.GITHUB_AGENT_TOKEN;
  if (!openAIKey || !githubToken) {
    const missing = !openAIKey ? "OPENAI_API_KEY" : "GITHUB_AGENT_TOKEN";
    return markBlocked(
      supabase,
      runId,
      `${missing} is not configured. Builder can analyze, but cannot safely create a fix branch and pull request yet.`
    );
  }

  try {
    const { data: findingRows, error: findingError } = await supabase
      .from("ai_agent_findings")
      .select("id,severity,title,detail,path,metadata")
      .eq("status", "open")
      .limit(30);
    if (findingError) throw findingError;

    const findings = ((findingRows ?? []) as Finding[])
      .filter((finding) => !SKIP_FIX_STATUSES.has(String(finding.metadata?.fix_status ?? "")))
      .sort(
        (a, b) =>
          (severityRank[a.severity] ?? 99) - (severityRank[b.severity] ?? 99) || a.id - b.id
      );
    const finding = findings[0];
    if (!finding) {
      return markPassed(supabase, runId, "No open root issue is currently eligible for an automated Builder fix.", {
        source: "builder_fix",
        no_op: true,
      });
    }

    const tree = await githubJson(`${API}/git/trees/main?recursive=1`, githubToken);
    const paths = (tree.tree ?? [])
      .filter((item: any) => item.type === "blob" && isAllowedSourcePath(item.path))
      .map((item: any) => String(item.path))
      .slice(0, 1200);
    if (!paths.length) throw new Error("Builder could not read an editable source tree from GitHub.");

    const selected = await selectFiles(openAIKey, finding, paths);
    const sources: FileSource[] = [];
    let sourceChars = 0;
    for (const path of selected) {
      if (!paths.includes(path) || !isAllowedSourcePath(path)) continue;
      const file = await getFile(path, "main", githubToken);
      if (!file || file.content.length > 35_000 || sourceChars + file.content.length > 100_000) continue;
      sources.push(file);
      sourceChars += file.content.length;
      if (sources.length >= 5) break;
    }
    if (!sources.length) throw new Error("Builder did not select any safe editable source files for this issue.");

    const proposal = (await proposeChanges(openAIKey, finding, sources)) as Proposal;
    if (!proposal.can_fix) {
      const blocker = proposal.blocker || "The issue requires an owner, product, privacy, or architecture decision before code should change.";
      await supabase
        .from("ai_agent_findings")
        .update({
          metadata: {
            ...(finding.metadata ?? {}),
            fix_status: "needs_owner",
            automation_blocker: blocker.slice(0, 2000),
          },
        })
        .eq("id", finding.id);
      return markBlocked(supabase, runId, `Root issue #${finding.id} needs owner input before Builder should modify code: ${blocker}`);
    }

    const changedFiles = applyProposal(sources, proposal);
    if (!changedFiles.length) {
      throw new Error("Builder produced no valid source change for the selected root issue.");
    }

    assertNoCapabilityShutdown(sources, changedFiles);

    const safetyReview = (await reviewProposal(openAIKey, finding, sources, changedFiles, proposal)) as SafetyReview;
    if (!safetyReview.approved) {
      const reason = safetyReview.reasons?.join(" ") || safetyReview.verdict || "Independent safety review rejected the patch.";
      return markBlocked(supabase, runId, `Builder proposal rejected before GitHub write: ${reason}`);
    }

    const mainRef = await githubJson(`${API}/git/ref/heads/main`, githubToken);
    const mainSha = mainRef?.object?.sha;
    if (!mainSha) throw new Error("Builder could not resolve the current main branch SHA.");

    const branch = `agent/fix-${finding.id}-${Date.now().toString(36)}`;
    await githubJson(`${API}/git/refs`, githubToken, {
      method: "POST",
      body: { ref: `refs/heads/${branch}`, sha: mainSha },
    });

    for (const file of changedFiles) {
      await githubJson(`${API}/contents/${encodePath(file.path)}`, githubToken, {
        method: "PUT",
        body: {
          message: `Agent fix #${finding.id}: ${finding.title}`.slice(0, 180),
          content: Buffer.from(file.nextContent, "utf8").toString("base64"),
          sha: file.sha,
          branch,
        },
      });
    }

    const requestedTests = uniqueStrings([...(proposal.tests ?? []), ...(safetyReview.required_tests ?? [])]).slice(0, 12);
    const pr = await githubJson(`${API}/pulls`, githubToken, {
      method: "POST",
      body: {
        title: `[Agent] ${finding.title}`.slice(0, 240),
        head: branch,
        base: "main",
        draft: true,
        body: [
          "## Project You+ Builder Agent",
          "",
          `Root issue #${finding.id} (${finding.severity}): **${finding.title}**`,
          "",
          finding.detail || "No additional root-issue detail was supplied.",
          "",
          "### Proposed fix",
          proposal.summary || "Minimal AI-proposed source change.",
          "",
          "### Independent safety review",
          safetyReview.verdict || "Approved for draft PR validation.",
          ...(safetyReview.reasons ?? []).map((reason) => `- ${reason}`),
          "",
          "### Files changed",
          ...changedFiles.map((file) => `- \`${file.path}\``),
          "",
          "### Validation required",
          ...(requestedTests.length ? requestedTests.map((test) => `- ${test}`) : ["- Automated Project You+ QA workflow"]),
          "",
          "**Safety:** This is a draft PR. The agent cannot merge it. QA and owner approval are required before production.",
        ].join("\n"),
      },
    });

    const finishedAt = new Date().toISOString();
    const metadata = {
      source: "builder_fix",
      model: MODEL,
      finding_id: finding.id,
      github_branch: branch,
      pull_request_number: pr.number ?? null,
      pull_request_url: pr.html_url ?? null,
      pull_request_draft: true,
      files_changed: changedFiles.map((file) => file.path),
      tests_requested: requestedTests,
      safety_review: safetyReview,
      owner_approval_required: true,
    };

    await supabase
      .from("ai_agent_runs")
      .update({
        status: "passed",
        summary: `Draft fix PR created for root issue #${finding.id}: ${finding.title}${pr.html_url ? ` — ${pr.html_url}` : ""}`,
        metadata,
        finished_at: finishedAt,
      })
      .eq("id", runId);
    await supabase
      .from("ai_agents")
      .update({ status: "idle", last_success_at: finishedAt, last_error: null, updated_at: finishedAt })
      .eq("agent_key", "builder");
    await supabase
      .from("ai_agent_findings")
      .update({
        metadata: {
          ...(finding.metadata ?? {}),
          fix_status: "draft_pr_open",
          fix_branch: branch,
          fix_pr_number: pr.number ?? null,
          fix_pr_url: pr.html_url ?? null,
        },
      })
      .eq("id", finding.id);

    return { ok: true as const, prUrl: pr.html_url as string | undefined, findingId: finding.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Builder fix error";
    const finishedAt = new Date().toISOString();
    await supabase
      .from("ai_agent_runs")
      .update({ status: "failed", summary: message.slice(0, 4000), finished_at: finishedAt })
      .eq("id", runId);
    await supabase
      .from("ai_agents")
      .update({ status: "error", last_error: message.slice(0, 4000), updated_at: finishedAt })
      .eq("agent_key", "builder");
    return { ok: false as const, message };
  }
}

function applyProposal(sources: FileSource[], proposal: Proposal): ChangedFile[] {
  const changedFiles: ChangedFile[] = [];
  for (const source of sources) {
    const change = (proposal.changes ?? []).find((candidate) => candidate.path === source.path);
    if (!change?.replacements?.length) continue;
    let nextContent = source.content;
    const reasons: string[] = [];
    for (const replacement of change.replacements.slice(0, 8)) {
      const oldText = String(replacement.old_text ?? "");
      const newText = String(replacement.new_text ?? "");
      if (!oldText || oldText.length > 12_000 || newText.length > 18_000) {
        throw new Error(`Unsafe replacement size proposed for ${source.path}.`);
      }
      const first = nextContent.indexOf(oldText);
      if (first < 0 || nextContent.indexOf(oldText, first + oldText.length) >= 0) {
        throw new Error(`Builder patch for ${source.path} did not match the source exactly once.`);
      }
      nextContent = `${nextContent.slice(0, first)}${newText}${nextContent.slice(first + oldText.length)}`;
      reasons.push(String(replacement.reason ?? "AI-proposed fix"));
    }
    if (nextContent !== source.content) changedFiles.push({ ...source, nextContent, reasons });
  }
  return changedFiles;
}

function assertNoCapabilityShutdown(sources: FileSource[], changedFiles: ChangedFile[]) {
  for (const changed of changedFiles) {
    const source = sources.find((item) => item.path === changed.path)?.content ?? "";
    const addedNullShutdown = /export function\s+\w+\([^)]*\)\s*{\s*return null;/.test(changed.nextContent) &&
      !/export function\s+\w+\([^)]*\)\s*{\s*return null;/.test(source);
    const addedVoidShutdown = /export async function\s+\w+\([^)]*\)[^{]*{\s*(?:\/\/[^\n]*\n\s*)?return;/.test(changed.nextContent) &&
      !/export async function\s+\w+\([^)]*\)[^{]*{\s*(?:\/\/[^\n]*\n\s*)?return;/.test(source);
    if (addedNullShutdown || addedVoidShutdown) {
      throw new Error(`Builder safety gate rejected ${changed.path}: the patch appears to disable an existing capability instead of fixing it.`);
    }
  }
}

async function selectFiles(apiKey: string, finding: Finding, paths: string[]) {
  const schema = {
    type: "object",
    additionalProperties: false,
    properties: { files: { type: "array", minItems: 1, maxItems: 5, items: { type: "string" } } },
    required: ["files"],
  };
  const result = await openAIJson(apiKey, {
    instructions:
      "You are the Project You+ Builder file selector. Choose only files from the supplied repository path list that are most likely necessary for a minimal fix. Prefer existing product code and tests. Never select secrets, migrations, lockfiles, generated files, or workflow files.",
    input: `Root issue: ${JSON.stringify(finding)}\n\nEditable repository paths:\n${paths.join("\n")}`,
    schema,
    name: "builder_file_selection",
    maxOutputTokens: 700,
    role: "builder-selector",
  });
  return Array.isArray(result.files) ? result.files.map(String) : [];
}

async function proposeChanges(apiKey: string, finding: Finding, sources: FileSource[]) {
  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      can_fix: { type: "boolean" },
      blocker: { type: "string" },
      summary: { type: "string" },
      changes: {
        type: "array",
        maxItems: 5,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            path: { type: "string" },
            replacements: {
              type: "array",
              maxItems: 8,
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  old_text: { type: "string" },
                  new_text: { type: "string" },
                  reason: { type: "string" },
                },
                required: ["old_text", "new_text", "reason"],
              },
            },
          },
          required: ["path", "replacements"],
        },
      },
      tests: { type: "array", maxItems: 8, items: { type: "string" } },
    },
    required: ["can_fix", "blocker", "summary", "changes", "tests"],
  };

  const sourceText = sources.map((file) => `\n--- FILE: ${file.path} ---\n${file.content}`).join("\n");
  return openAIJson(apiKey, {
    instructions:
      "You are the Project You+ Builder. Produce the smallest safe code fix for the supplied root issue. Preserve existing working capabilities and the locked Project You+ Owner/AI Operations designs. Never make an issue disappear by disabling analytics, telemetry, authentication, navigation, tests, error reporting, or another existing feature. Do not add secrets, weaken auth/RLS, bypass errors, edit migrations, or change deployment controls. If the root issue requires an owner/product/privacy policy decision or the supplied code is insufficient to implement the full requirement safely, set can_fix=false, explain the blocker, and return no changes. If evidence is insufficient, prefer a narrow test or instrumentation improvement over speculative behavior changes. old_text must be copied verbatim from the supplied source and uniquely identify the code to replace.",
    input: `Root issue: ${JSON.stringify(finding)}\n${sourceText}`,
    schema,
    name: "builder_fix_proposal",
    maxOutputTokens: 12000,
    role: "builder",
  });
}

async function reviewProposal(
  apiKey: string,
  finding: Finding,
  sources: FileSource[],
  changedFiles: ChangedFile[],
  proposal: Proposal
) {
  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      approved: { type: "boolean" },
      verdict: { type: "string" },
      reasons: { type: "array", maxItems: 8, items: { type: "string" } },
      required_tests: { type: "array", maxItems: 8, items: { type: "string" } },
    },
    required: ["approved", "verdict", "reasons", "required_tests"],
  };

  const beforeAfter = changedFiles
    .map((file) => {
      const before = sources.find((source) => source.path === file.path)?.content ?? "";
      return `\n--- ${file.path}: BEFORE ---\n${before}\n--- ${file.path}: AFTER ---\n${file.nextContent}`;
    })
    .join("\n");

  return openAIJson(apiKey, {
    instructions:
      "You are an independent senior reviewer for Project You+. Reject any patch that disables an existing capability, weakens security/privacy, merely hides the reported symptom, changes locked Owner/AI Operations visual design without explicit need, or claims to solve governance/policy work with a code shortcut. Approve only if the patch is narrowly scoped, preserves functionality, materially addresses the root issue, and has credible validation steps. Be conservative.",
    input: `Root issue: ${JSON.stringify(finding)}\nProposal: ${JSON.stringify(proposal)}\n${beforeAfter}`,
    schema,
    name: "builder_safety_review",
    maxOutputTokens: 1800,
    role: "builder-reviewer",
  });
}

async function openAIJson(
  apiKey: string,
  args: { instructions: string; input: string; schema: any; name: string; maxOutputTokens: number; role: string }
) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      instructions: args.instructions,
      input: args.input,
      reasoning: { effort: "medium" },
      max_output_tokens: args.maxOutputTokens,
      store: false,
      text: {
        verbosity: "low",
        format: { type: "json_schema", name: args.name, strict: true, schema: args.schema },
      },
      metadata: { app: "project-you-plus", agent: args.role },
    }),
    signal: AbortSignal.timeout(55_000),
  });
  const raw = await response.json();
  if (!response.ok) throw new Error(raw?.error?.message || `OpenAI request failed with status ${response.status}`);
  const text = extractOutputText(raw);
  if (!text) throw new Error("OpenAI returned no structured Builder output.");
  return JSON.parse(text);
}

async function getFile(path: string, ref: string, token: string): Promise<FileSource | null> {
  const data = await githubJson(`${API}/contents/${encodePath(path)}?ref=${encodeURIComponent(ref)}`, token);
  if (data?.type !== "file" || typeof data.content !== "string" || typeof data.sha !== "string") return null;
  return {
    path,
    sha: data.sha,
    content: Buffer.from(data.content.replace(/\n/g, ""), "base64").toString("utf8"),
  };
}

async function githubJson(url: string, token: string, options: { method?: string; body?: unknown } = {}) {
  const response = await fetch(url, {
    method: options.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.message || `GitHub request failed with status ${response.status}`);
  return data;
}

function isAllowedSourcePath(path: string) {
  if (!/\.(ts|tsx|js|jsx)$/.test(path)) return false;
  if (!/^(app|components|lib|tests)\//.test(path)) return false;
  if (path.includes("node_modules") || path.includes(".next") || path.includes("/generated/")) return false;
  return true;
}

function encodePath(path: string) {
  return path.split("/").map(encodeURIComponent).join("/");
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

function uniqueStrings(values: string[]) {
  return [...new Set(values.map((value) => String(value).trim()).filter(Boolean))];
}

async function markBlocked(supabase: SupabaseClient, runId: number, message: string) {
  const now = new Date().toISOString();
  await supabase
    .from("ai_agent_runs")
    .update({ status: "blocked", summary: message.slice(0, 4000), finished_at: now })
    .eq("id", runId);
  await supabase
    .from("ai_agents")
    .update({ status: "blocked", last_error: message.slice(0, 4000), updated_at: now })
    .eq("agent_key", "builder");
  return { ok: false as const, blocked: true as const, message };
}

async function markPassed(
  supabase: SupabaseClient,
  runId: number,
  summary: string,
  metadata: Record<string, unknown>
) {
  const now = new Date().toISOString();
  await supabase
    .from("ai_agent_runs")
    .update({ status: "passed", summary, metadata, finished_at: now })
    .eq("id", runId);
  await supabase
    .from("ai_agents")
    .update({ status: "idle", last_success_at: now, last_error: null, updated_at: now })
    .eq("agent_key", "builder");
  return { ok: true as const, noOp: true as const };
}
