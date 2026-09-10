import Link from "next/link";
import { requireAdmin } from "@/lib/owner/access";
import { OwnerPanel, OwnerSectionShell, EmptyState } from "@/components/owner/owner-section-shell";
import { approveDraftFix, approveOwnerDecision, rejectDraftFix } from "@/lib/actions/approvals";

export const dynamic = "force-dynamic";

type Finding = {
  id: number;
  severity: string;
  title: string;
  detail: string | null;
  status: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type Run = {
  id: number;
  title: string;
  status: string;
  summary: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export default async function ApprovalsPage() {
  const { supabase, user, role } = await requireAdmin();
  const [findingsRes, runsRes] = await Promise.all([
    supabase.from("ai_agent_findings").select("id,severity,title,detail,status,metadata,created_at").eq("status", "open").order("created_at", { ascending: false }).limit(100),
    supabase.from("ai_agent_runs").select("id,title,status,summary,metadata,created_at").eq("agent_key", "builder").order("created_at", { ascending: false }).limit(40),
  ]);

  const findings = (findingsRes.data ?? []) as Finding[];
  const runs = (runsRes.data ?? []) as Run[];
  const needsOwner = findings.filter((f) => String(f.metadata?.fix_status ?? "") === "needs_owner");
  const draftFixes = findings.filter((f) => ["draft_pr_open", "pr_open"].includes(String(f.metadata?.fix_status ?? "")));
  const approvedFixes = findings.filter((f) => String(f.metadata?.fix_status ?? "") === "owner_approved");
  const attentionCount = needsOwner.length + draftFixes.length;
  const displayName = (user.user_metadata?.full_name as string | undefined) || user.email || "Owner";

  return (
    <OwnerSectionShell
      active="approvals"
      title="Approval Center"
      subtitle="Review agent decisions and code changes before anything can advance toward production."
      displayName={displayName}
      approvalCount={attentionCount}
      actions={<Link href="/owner/agents" className="rounded-lg border border-[#43536f] bg-[#101a29] px-4 py-2 text-[10px]">← AI Operations</Link>}
    >
      <div className="grid gap-4 xl:grid-cols-[1.1fr_.9fr]">
        <OwnerPanel title="Needs Your Decision" subtitle={`${needsOwner.length} issue${needsOwner.length === 1 ? "" : "s"} waiting for owner direction`}>
          <div className="mt-3 space-y-3">
            {needsOwner.length ? needsOwner.map((finding) => (
              <article key={finding.id} className="rounded-xl border border-amber-400/20 bg-amber-400/[.035] p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded px-2 py-1 text-[8px] font-bold uppercase ${severityClass(finding.severity)}`}>{finding.severity}</span>
                  <span className="text-[9px] text-amber-300">Needs owner input</span>
                </div>
                <h2 className="mt-2 text-[13px] font-semibold">{finding.title}</h2>
                <p className="mt-2 text-[10px] leading-relaxed text-[#9da8bc]">{finding.detail || "No additional detail was supplied."}</p>
                {finding.metadata?.automation_blocker ? <div className="mt-3 rounded-lg border border-[#2a3851] bg-[#09111d] p-3 text-[9px] text-[#aab4c7]"><b className="text-[#d7ddeb]">Why Builder stopped:</b><div className="mt-1">{String(finding.metadata.automation_blocker)}</div></div> : null}
                {finding.id === 82 ? (
                  <div className="mt-3 rounded-lg border border-[#332956] bg-[#120d25] p-3">
                    <div className="text-[9px] font-semibold text-[#d7cbff]">Recommended direction</div>
                    <p className="mt-1 text-[9px] leading-relaxed text-[#aeb7ca]">Keep privacy-safe product analytics, do not store raw IP addresses, and implement explicit analytics controls, retention/deletion handling, and access restrictions instead of shutting telemetry off.</p>
                    {role === "owner" ? <form action={approveOwnerDecision} className="mt-3"><input type="hidden" name="finding_id" value={finding.id} /><input type="hidden" name="decision" value="Keep privacy-safe analytics enabled; do not store raw IP addresses; implement consent/control, retention/deletion, minimization, and admin-only access safeguards without disabling product observability." /><button className="rounded-lg border border-[#7445ef] bg-[#2a1858] px-4 py-2 text-[9px] font-semibold text-[#d8cdff]">Approve Recommended Direction</button></form> : null}
                  </div>
                ) : <div className="mt-3 text-[9px] text-[#7f8aa0]">This item needs a product or architecture decision before Builder can safely change code.</div>}
              </article>
            )) : <EmptyState>No owner decisions are waiting right now.</EmptyState>}
          </div>
        </OwnerPanel>

        <OwnerPanel title="Code Fix Approvals" subtitle={`${draftFixes.length} draft fix${draftFixes.length === 1 ? "" : "es"} waiting for review`}>
          <div className="mt-3 space-y-3">
            {draftFixes.length ? draftFixes.map((finding) => {
              const prUrl = String(finding.metadata?.fix_pr_url ?? "");
              const prNumber = Number(finding.metadata?.fix_pr_number ?? 0);
              return <article key={finding.id} className="rounded-xl border border-[#2a3851] bg-[#0a1320] p-4">
                <div className="flex items-center justify-between gap-3"><div><div className="text-[9px] text-[#8f9bb0]">Draft PR #{prNumber || "—"}</div><h3 className="mt-1 text-[12px] font-semibold">{finding.title}</h3></div><span className="rounded bg-[#24164c] px-2 py-1 text-[8px] text-[#cdbdff]">Owner review</span></div>
                <p className="mt-2 text-[9px] leading-relaxed text-[#9da8bc]">{finding.detail || "No detail supplied."}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {prUrl ? <a href={prUrl} target="_blank" rel="noreferrer" className="rounded-lg border border-[#43536f] bg-[#101a29] px-3 py-2 text-[9px]">Open GitHub PR ↗</a> : null}
                  {role === "owner" ? <form action={approveDraftFix}><input type="hidden" name="finding_id" value={finding.id} /><button className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[9px] font-semibold text-emerald-300">✓ Approve Fix</button></form> : null}
                  {role === "owner" ? <form action={rejectDraftFix}><input type="hidden" name="finding_id" value={finding.id} /><button className="rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-[9px] text-red-300">Reject</button></form> : null}
                </div>
                <p className="mt-2 text-[8px] text-[#66748b]">Approval records your owner decision. It does not bypass QA and does not automatically merge production.</p>
              </article>;
            }) : <EmptyState>No draft agent PR is waiting for approval.</EmptyState>}
          </div>
        </OwnerPanel>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <OwnerPanel title="Approved, Awaiting QA / Merge" subtitle={`${approvedFixes.length} owner-approved fix${approvedFixes.length === 1 ? "" : "es"}`}>
          <div className="mt-3 space-y-2">{approvedFixes.length ? approvedFixes.map((f) => <div key={f.id} className="rounded-lg border border-emerald-500/15 bg-emerald-500/[.035] p-3"><div className="text-[10px] font-semibold">{f.title}</div><div className="mt-1 text-[8px] text-emerald-300">Owner approved · QA/merge gate still required</div></div>) : <EmptyState>No approved fixes are waiting.</EmptyState>}</div>
        </OwnerPanel>
        <OwnerPanel title="Recent Builder Decisions" subtitle="Latest real Builder runs">
          <div className="mt-3 divide-y divide-[#1e2a3f]">{runs.slice(0, 8).map((run) => <div key={run.id} className="py-2.5"><div className="flex justify-between gap-3"><div className="text-[9px] font-semibold">{run.title}</div><span className={`text-[8px] ${statusClass(run.status)}`}>{run.status}</span></div><div className="mt-1 line-clamp-2 text-[8px] leading-relaxed text-[#7f8aa0]">{run.summary || "No summary recorded."}</div></div>)}{runs.length === 0 ? <EmptyState>No Builder runs yet.</EmptyState> : null}</div>
        </OwnerPanel>
      </div>
    </OwnerSectionShell>
  );
}

function severityClass(s: string) { return ["critical", "high"].includes(s) ? "bg-red-500/15 text-red-300" : s === "medium" ? "bg-amber-500/15 text-amber-300" : "bg-blue-500/15 text-blue-300"; }
function statusClass(s: string) { return ["passed", "success", "completed"].includes(s) ? "text-emerald-300" : ["blocked", "queued"].includes(s) ? "text-amber-300" : ["failed", "error"].includes(s) ? "text-red-300" : "text-blue-300"; }
