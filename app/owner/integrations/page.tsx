import { requireAdmin } from "@/lib/owner/access";
import { getOwnerApprovalCount } from "@/lib/owner/approval-count";
import Link from "next/link";
import { OwnerPanel, OwnerSectionShell, EmptyState } from "@/components/owner/owner-section-shell";

export const dynamic = "force-dynamic";

type Integration={id:string;user_id:string;provider:string;status:string;connected_at:string|null;metadata:Record<string,unknown>|null};

type PageProps={searchParams?:Record<string,string|string[]|undefined>};

export default async function OwnerIntegrationsPage({searchParams}:PageProps){
  const {supabase,user}=await requireAdmin();
  const [integrationsRes,approvalCount]=await Promise.all([
    supabase.from("integrations").select("id,user_id,provider,status,connected_at,metadata").order("connected_at",{ascending:false}),
    getOwnerApprovalCount(supabase),
  ]);
  const integrations=(integrationsRes.data??[]) as Integration[];
  const connected=integrations.filter((i)=>["connected","active","healthy"].includes(i.status)).length;
  const providers=[...new Set(integrations.map((i)=>i.provider))];
  const instagram=integrations.find((i)=>i.provider==="instagram");
  const higgsfield=integrations.find((i)=>i.provider==="higgsfield");
  const displayName=(user.user_metadata?.full_name as string|undefined)||user.email||"Owner";
  const hfNotice=typeof searchParams?.higgsfield==="string"?searchParams.higgsfield:null;
  const hfError=typeof searchParams?.higgsfield_error==="string"?searchParams.higgsfield_error:null;
  return <OwnerSectionShell active="integrations" title="Integrations" subtitle="Connected services recorded by Project You+. Secrets are never displayed here." displayName={displayName} approvalCount={approvalCount}>
    <section className="grid gap-3 sm:grid-cols-3"><Metric label="Integration Records" value={integrations.length}/><Metric label="Connected" value={connected}/><Metric label="Providers" value={providers.length}/></section>
    {hfNotice?<div className="mt-4 rounded-lg border border-emerald-400/20 bg-emerald-500/[.06] px-4 py-3 text-[10px] text-emerald-200">Higgsfield is {hfNotice}.</div>:null}
    {hfError?<div className="mt-4 rounded-lg border border-red-400/20 bg-red-500/[.07] px-4 py-3 text-[10px] text-red-200">Higgsfield connection failed: {hfError}</div>:null}

    <div className="mt-4 grid gap-4 xl:grid-cols-2">
      <OwnerPanel title="Instagram Growth Connection" subtitle="Feeds approved publishing, Echo community workflows, and Vector learning inside the existing Growth Department."><div className="mt-3 flex flex-col gap-3 rounded-xl border border-[#26344b] bg-[#0a1320] p-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="text-[12px] font-semibold">{instagram?.status==="connected"?`@${String(instagram.metadata?.username||"Instagram")}`:"Instagram is not connected"}</div><div className="mt-1 text-[9px] text-[#8b96aa]">{instagram?.status==="connected"?"Professional account connected securely. Tokens are hidden.":"Connect the Project You+ professional account through Meta OAuth."}</div></div><div className="flex gap-2">{instagram?.status==="connected"?<><form action="/api/integrations/instagram/sync" method="post"><button className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-[9px] text-emerald-300">Sync insights</button></form><Link href="/owner/marketing" className="rounded-lg border border-[#5f47b7] bg-[#211644] px-4 py-2 text-[9px] text-[#d7cbff]">Open Growth Department</Link></>:<a href="/api/integrations/instagram/start" className="rounded-lg border border-[#5f47b7] bg-[#211644] px-4 py-2 text-[9px] text-[#d7cbff]">Connect Instagram</a>}</div></div></OwnerPanel>

      <OwnerPanel title="Higgsfield Creative Engine" subtitle="Server-side image and video generation for Frame and Muse. Credentials stay in the private integration secret store.">
        {higgsfield?.status==="connected"?<div className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-500/[.045] p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="text-[12px] font-semibold text-emerald-200">Higgsfield Cloud connected</div><div className="mt-1 text-[9px] leading-4 text-[#8b96aa]">Image: {String(higgsfield.metadata?.image_model_path||"configured")}<br/>Video: {String(higgsfield.metadata?.video_model_path||"configured")}</div></div><div className="flex gap-2"><Link href="/owner/marketing" className="rounded-lg border border-[#5f47b7] bg-[#211644] px-4 py-2 text-[9px] text-[#d7cbff]">Open production</Link><form action="/api/integrations/higgsfield/connect" method="post"><input type="hidden" name="action" value="disconnect"/><button className="rounded-lg border border-red-400/20 bg-red-500/[.06] px-4 py-2 text-[9px] text-red-200">Disconnect</button></form></div></div></div>:<div className="mt-3 rounded-xl border border-[#26344b] bg-[#0a1320] p-4"><div className="text-[10px] leading-5 text-[#9aa6ba]">For true autonomous generation, Project You+ needs Higgsfield Cloud server credentials. Your ChatGPT Higgsfield connection cannot be reused by Vercel.</div><form action="/api/integrations/higgsfield/connect" method="post" className="mt-4 grid gap-3"><label className="text-[9px] text-[#8793a8]">API key ID<input name="apiKeyId" required autoComplete="off" className="mt-1 w-full rounded-lg border border-[#2b3950] bg-[#070d16] px-3 py-2.5 text-[10px] text-white outline-none focus:border-[#7153d4]"/></label><label className="text-[9px] text-[#8793a8]">API key secret<input name="apiKeySecret" type="password" required autoComplete="new-password" className="mt-1 w-full rounded-lg border border-[#2b3950] bg-[#070d16] px-3 py-2.5 text-[10px] text-white outline-none focus:border-[#7153d4]"/></label><div className="flex flex-wrap items-center gap-2"><button className="rounded-lg border border-[#8b63ff] bg-[linear-gradient(180deg,#4a2c9c,#2b195f)] px-4 py-2.5 text-[9px] font-semibold text-white">Connect & test</button><a href="https://cloud.higgsfield.ai" target="_blank" rel="noreferrer" className="rounded-lg border border-[#30405a] bg-[#0b1422] px-4 py-2.5 text-[9px] text-[#aab5c7]">Create API credentials ↗</a></div></form></div>}
      </OwnerPanel>
    </div>

    <div className="mt-4"><OwnerPanel title="Connected Integrations" subtitle="Only non-secret integration metadata is shown."><div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{integrations.map((i)=><article key={i.id} className="rounded-xl border border-[#26344b] bg-[#0a1320] p-4"><div className="flex items-center justify-between gap-3"><div className="text-[12px] font-semibold capitalize">{i.provider.replaceAll("_"," ")}</div><span className={`rounded-full px-2 py-1 text-[8px] ${["connected","active","healthy"].includes(i.status)?"bg-emerald-500/10 text-emerald-300":"bg-amber-500/10 text-amber-300"}`}>{i.status}</span></div><div className="mt-3 text-[9px] text-[#8b96aa]">Connected: {i.connected_at?new Date(i.connected_at).toLocaleString():"—"}</div><div className="mt-1 text-[8px] text-[#64718a]">User: {i.user_id.slice(0,8)}…</div></article>)}{integrations.length===0?<EmptyState>No user integrations are connected yet.</EmptyState>:null}</div></OwnerPanel></div>
  </OwnerSectionShell>;
}
function Metric({label,value}:{label:string;value:number}){return <div className="rounded-xl border border-[#1d315e] bg-[linear-gradient(145deg,#0d1831,#0b1221)] p-4"><div className="text-[9px] text-[#9aa6bc]">{label}</div><div className="mt-1 text-[27px] font-bold">{value}</div></div>}
