"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/owner/access";

async function requireOwner() {
  const ctx = await requireAdmin();
  if (ctx.role !== "owner") throw new Error("Owner approval is required for this action.");
  return ctx;
}

export async function approveOwnerDecision(formData: FormData) {
  const { supabase, user } = await requireOwner();
  const findingId = Number(formData.get("finding_id"));
  const decision = String(formData.get("decision") ?? "").slice(0, 500);
  if (!Number.isFinite(findingId) || !decision) throw new Error("Invalid approval request.");

  const { data: finding, error } = await supabase
    .from("ai_agent_findings")
    .select("id,metadata")
    .eq("id", findingId)
    .maybeSingle();
  if (error || !finding) throw error ?? new Error("Finding not found.");

  const metadata = (finding.metadata ?? {}) as Record<string, unknown>;
  await supabase
    .from("ai_agent_findings")
    .update({
      metadata: {
        ...metadata,
        fix_status: "ready_for_builder",
        owner_decision: decision,
        owner_decision_at: new Date().toISOString(),
        owner_decision_by: user.id,
      },
    })
    .eq("id", findingId);

  revalidatePath("/owner/approvals");
  revalidatePath("/owner/agents");
}

export async function approveDraftFix(formData: FormData) {
  const { supabase, user } = await requireOwner();
  const findingId = Number(formData.get("finding_id"));
  if (!Number.isFinite(findingId)) throw new Error("Invalid approval request.");

  const { data: finding, error } = await supabase
    .from("ai_agent_findings")
    .select("id,metadata")
    .eq("id", findingId)
    .maybeSingle();
  if (error || !finding) throw error ?? new Error("Finding not found.");

  const metadata = (finding.metadata ?? {}) as Record<string, unknown>;
  await supabase
    .from("ai_agent_findings")
    .update({
      metadata: {
        ...metadata,
        fix_status: "owner_approved",
        owner_approval: "approved",
        owner_approved_at: new Date().toISOString(),
        owner_approved_by: user.id,
      },
    })
    .eq("id", findingId);

  revalidatePath("/owner/approvals");
  revalidatePath("/owner/agents");
}

export async function rejectDraftFix(formData: FormData) {
  const { supabase, user } = await requireOwner();
  const findingId = Number(formData.get("finding_id"));
  if (!Number.isFinite(findingId)) throw new Error("Invalid rejection request.");

  const { data: finding, error } = await supabase
    .from("ai_agent_findings")
    .select("id,metadata")
    .eq("id", findingId)
    .maybeSingle();
  if (error || !finding) throw error ?? new Error("Finding not found.");

  const metadata = (finding.metadata ?? {}) as Record<string, unknown>;
  const prNumber = Number(metadata.fix_pr_number);
  const token = process.env.GITHUB_AGENT_TOKEN;
  if (token && Number.isFinite(prNumber) && prNumber > 0) {
    await fetch(`https://api.github.com/repos/ProjectYouPlus/project-you-plus/pulls/${prNumber}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ state: "closed" }),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    }).catch(() => null);
  }

  await supabase
    .from("ai_agent_findings")
    .update({
      metadata: {
        ...metadata,
        fix_status: "owner_rejected",
        owner_approval: "rejected",
        owner_rejected_at: new Date().toISOString(),
        owner_rejected_by: user.id,
      },
    })
    .eq("id", findingId);

  revalidatePath("/owner/approvals");
  revalidatePath("/owner/agents");
}
