import { requireAdmin } from "@/lib/owner/access";
import { getOwnerApprovalCount } from "@/lib/owner/approval-count";
import { OwnerPanel, OwnerSectionShell, EmptyState } from "@/components/owner/owner-section-shell";

export const dynamic = "force-dynamic";

type UserRow = { user_id:string; email:string|null; full_name:string|null; provider:string|null; created_at:string; last_sign_in_at:string|null; email_confirmed_at:string|null; onboarding_completed:boolean };
type MetaRow = { user_id:string; access_tier:string|null; cohort:string|null; tags:string[]|null; last_seen_at:string|null; last_path:string|null };
type LoginRow = { user_id:string; city:string|null; region:string|null; country:string|null; device_family:string|null; browser:string|null; os:string|null; occurred_at:string };

export default async function OwnerUsersPage() {
  const { supabase, user } = await requireAdmin();
  const [usersRes, metaRes, loginRes, approvalCount] = await Promise.all([
    supabase.from("user_directory").select("user_id,email,full_name,provider,created_at,last_sign_in_at,email_confirmed_at,onboarding_completed").order("created_at", { ascending:false }),
    supabase.from("user_admin_metadata").select("user_id,access_tier,cohort,tags,last_seen_at,last_path"),
    supabase.from("login_events").select("user_id,city,region,country,device_family,browser,os,occurred_at").order("occurred_at", { ascending:false }).limit(2000),
    getOwnerApprovalCount(supabase),
  ]);
  const users = (usersRes.data ?? []) as UserRow[];
  const metas = (metaRes.data ?? []) as MetaRow[];
  const logins = (loginRes.data ?? []) as LoginRow[];
  const metaByUser = new Map(metas.map((m)=>[m.user_id,m]));
  const loginByUser = new Map<string,LoginRow>();
  for (const login of logins) if (!loginByUser.has(login.user_id)) loginByUser.set(login.user_id, login);
  const displayName=(user.user_metadata?.full_name as string|undefined)||user.email||"Owner";
  const onboarded=users.filter((u)=>u.onboarding_completed).length;
  const active24=metas.filter((m)=>m.last_seen_at && Date.now()-new Date(m.last_seen_at).getTime()<86_400_000).length;

  return <OwnerSectionShell active="users" title="Users" subtitle="Real Project You+ accounts and their latest product activity." displayName={displayName} approvalCount={approvalCount}>
    <section className="grid gap-3 sm:grid-cols-3">
      <Metric label="Total Users" value={users.length}/><Metric label="Active 24h" value={active24}/><Metric label="Onboarding Complete" value={users.length?`${Math.round(onboarded/users.length*100)}%`:"0%"}/>
    </section>
    <div className="mt-4"><OwnerPanel title="User Directory" subtitle="No demo rows are shown.">
      <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[980px] text-left text-[9px]"><thead className="border-y border-[#243149] bg-[#111a28] text-[#8f9bb0]"><tr><th className="px-3 py-2">User</th><th>Email</th><th>Joined</th><th>Last Sign In</th><th>Last Seen</th><th>Location</th><th>Device</th><th>Onboarding</th><th>Last Screen</th></tr></thead><tbody className="divide-y divide-[#1e2a3f]">{users.map((u)=>{const m=metaByUser.get(u.user_id);const l=loginByUser.get(u.user_id);return <tr key={u.user_id}><td className="px-3 py-3 font-semibold">{u.full_name||"Unnamed"}</td><td className="text-[#aab4c8]">{u.email||"—"}</td><td>{date(u.created_at)}</td><td>{relative(u.last_sign_in_at)}</td><td>{relative(m?.last_seen_at||null)}</td><td>{l?[l.city,l.region,l.country].filter(Boolean).join(", ")||"—":"—"}</td><td>{l?[l.device_family,l.browser,l.os].filter(Boolean).join(" · ")||"—":"—"}</td><td><span className={u.onboarding_completed?"text-emerald-300":"text-amber-300"}>{u.onboarding_completed?"Completed":"Incomplete"}</span></td><td className="max-w-[160px] truncate text-[#8895aa]">{m?.last_path||"—"}</td></tr>})}{users.length===0?<tr><td colSpan={9}><EmptyState>No real users yet.</EmptyState></td></tr>:null}</tbody></table></div>
    </OwnerPanel></div>
  </OwnerSectionShell>;
}

function Metric({label,value}:{label:string;value:string|number}){return <div className="rounded-xl border border-[#1d315e] bg-[linear-gradient(145deg,#0d1831,#0b1221)] p-4"><div className="text-[9px] text-[#9aa6bc]">{label}</div><div className="mt-1 text-[27px] font-bold">{value}</div></div>}
function date(v:string){return new Date(v).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}
function relative(v:string|null){if(!v)return "Never";const ms=Date.now()-new Date(v).getTime();if(ms<60e3)return "Just now";if(ms<36e5)return `${Math.floor(ms/60e3)}m ago`;if(ms<864e5)return `${Math.floor(ms/36e5)}h ago`;return `${Math.floor(ms/864e5)}d ago`}
