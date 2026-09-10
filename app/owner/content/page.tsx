import { requireAdmin } from "@/lib/owner/access";
import { getOwnerApprovalCount } from "@/lib/owner/approval-count";
import { OwnerPanel, OwnerSectionShell, EmptyState } from "@/components/owner/owner-section-shell";

export const dynamic = "force-dynamic";

type Notification={id:string;user_id:string;title:string;body:string;read_at:string|null;created_at:string};

export default async function OwnerContentPage(){
  const {supabase,user}=await requireAdmin();
  const [notificationsRes,approvalCount]=await Promise.all([
    supabase.from("notifications").select("id,user_id,title,body,read_at,created_at").order("created_at",{ascending:false}).limit(100),
    getOwnerApprovalCount(supabase),
  ]);
  const notifications=(notificationsRes.data??[]) as Notification[];
  const unread=notifications.filter((n)=>!n.read_at).length;
  const displayName=(user.user_metadata?.full_name as string|undefined)||user.email||"Owner";
  return <OwnerSectionShell active="content" title="Content & Messaging" subtitle="Real in-app notification activity. No campaign data is invented." displayName={displayName} approvalCount={approvalCount}>
    <section className="grid gap-3 sm:grid-cols-3"><Metric label="Recent Notifications" value={notifications.length}/><Metric label="Unread" value={unread}/><Metric label="Read" value={notifications.length-unread}/></section>
    <div className="mt-4"><OwnerPanel title="Notification Feed" subtitle="Latest records from the notifications table."><div className="mt-3 divide-y divide-[#1e2a3f]">{notifications.map((n)=><div key={n.id} className="py-3"><div className="flex items-start justify-between gap-3"><div><div className="text-[10px] font-semibold">{n.title}</div><div className="mt-1 max-w-3xl text-[9px] leading-relaxed text-[#9da8bc]">{n.body}</div></div><span className={`rounded px-2 py-1 text-[8px] ${n.read_at?"bg-white/5 text-[#7f8aa0]":"bg-[#24164c] text-[#cdbdff]"}`}>{n.read_at?"Read":"Unread"}</span></div><div className="mt-2 text-[8px] text-[#66748b]">Created {new Date(n.created_at).toLocaleString()}</div></div>)}{notifications.length===0?<EmptyState>No notifications have been created yet.</EmptyState>:null}</div></OwnerPanel></div>
  </OwnerSectionShell>;
}
function Metric({label,value}:{label:string;value:number}){return <div className="rounded-xl border border-[#1d315e] bg-[linear-gradient(145deg,#0d1831,#0b1221)] p-4"><div className="text-[9px] text-[#9aa6bc]">{label}</div><div className="mt-1 text-[27px] font-bold">{value}</div></div>}
