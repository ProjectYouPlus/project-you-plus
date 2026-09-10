import { requireAdmin } from "@/lib/owner/access";
import { getOwnerApprovalCount } from "@/lib/owner/approval-count";
import { OwnerPanel, OwnerSectionShell, EmptyState } from "@/components/owner/owner-section-shell";

export const dynamic = "force-dynamic";

type AuditRow={id:number;admin_user_id:string|null;action:string;target_type:string|null;target_id:string|null;before_data:unknown;after_data:unknown;created_at:string};

export default async function OwnerAuditPage(){
  const {supabase,user}=await requireAdmin();
  const [auditRes,approvalCount]=await Promise.all([
    supabase.from("admin_audit_log").select("id,admin_user_id,action,target_type,target_id,before_data,after_data,created_at").order("created_at",{ascending:false}).limit(250),
    getOwnerApprovalCount(supabase),
  ]);
  const rows=(auditRes.data??[]) as AuditRow[];
  const displayName=(user.user_metadata?.full_name as string|undefined)||user.email||"Owner";
  return <OwnerSectionShell active="audit" title="Audit Log" subtitle="Recorded administrative changes to Project You+ controls and settings." displayName={displayName} approvalCount={approvalCount}>
    <OwnerPanel title="Administrative Activity" subtitle={`${rows.length} recent recorded change${rows.length===1?"":"s"}`}>
      <div className="mt-3 divide-y divide-[#1e2a3f]">{rows.map((r)=><details key={r.id} className="group"><summary className="grid cursor-pointer list-none grid-cols-[150px_1fr_160px_16px] gap-3 py-3 text-[9px] [&::-webkit-details-marker]:hidden"><span className="text-[#7f8aa0]">{new Date(r.created_at).toLocaleString()}</span><span className="font-semibold">{r.action}</span><span className="truncate text-[#8e9aaf]">{[r.target_type,r.target_id].filter(Boolean).join(" · ")||"—"}</span><span className="transition-transform group-open:rotate-180">⌄</span></summary><div className="mb-3 grid gap-3 rounded-lg border border-[#26354d] bg-[#0a1320] p-3 text-[8px] md:grid-cols-2"><JsonBlock label="Before" value={r.before_data}/><JsonBlock label="After" value={r.after_data}/></div></details>)}{rows.length===0?<EmptyState>No admin audit events have been recorded yet.</EmptyState>:null}</div>
    </OwnerPanel>
  </OwnerSectionShell>;
}
function JsonBlock({label,value}:{label:string;value:unknown}){return <div><div className="text-[#71809a]">{label}</div><pre className="mt-1 max-h-52 overflow-auto whitespace-pre-wrap rounded-md bg-[#070d16] p-2 text-[#aeb7ca]">{value?JSON.stringify(value,null,2):"—"}</pre></div>}
