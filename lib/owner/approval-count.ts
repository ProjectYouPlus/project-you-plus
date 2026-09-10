import type { SupabaseClient } from "@supabase/supabase-js";

export async function getOwnerApprovalCount(supabase: SupabaseClient) {
  const { data } = await supabase
    .from("ai_agent_findings")
    .select("metadata")
    .eq("status", "open")
    .limit(200);

  return (data ?? []).filter((row) => {
    const metadata = (row.metadata ?? {}) as Record<string, unknown>;
    return ["needs_owner", "draft_pr_open", "pr_open"].includes(String(metadata.fix_status ?? ""));
  }).length;
}
