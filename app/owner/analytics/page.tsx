import { requireAdmin } from "@/lib/owner/access";
import { getOwnerApprovalCount } from "@/lib/owner/approval-count";
import { OwnerPanel, OwnerSectionShell, EmptyState } from "@/components/owner/owner-section-shell";

export const dynamic = "force-dynamic";
const DAY=86_400_000;

type Activity={event_name:string;path:string|null;occurred_at:string};
type Login={event_type:string;city:string|null;region:string|null;country:string|null;device_family:string|null;browser:string|null;occurred_at:string};

export default async function OwnerAnalyticsPage(){
  const {supabase,user}=await requireAdmin();
  const [activityRes,loginRes,usersRes,approvalCount]=await Promise.all([
    supabase.from("activity_events").select("event_name,path,occurred_at").order("occurred_at",{ascending:false}).limit(5000),
    supabase.from("login_events").select("event_type,city,region,country,device_family,browser,occurred_at").order("occurred_at",{ascending:false}).limit(5000),
    supabase.from("user_directory").select("user_id,created_at,onboarding_completed"),
    getOwnerApprovalCount(supabase),
  ]);
  const activity=(activityRes.data??[]) as Activity[]; const logins=(loginRes.data??[]) as Login[]; const users=usersRes.data??[]; const now=Date.now();
  const activity7=activity.filter((e)=>now-new Date(e.occurred_at).getTime()<=7*DAY);
  const logins7=logins.filter((e)=>now-new Date(e.occurred_at).getTime()<=7*DAY);
  const paths=rank(activity7.map((e)=>e.path||"Unknown")).slice(0,10); const locations=rank(logins7.map((l)=>[l.city,l.region,l.country].filter(Boolean).join(", ")||"Unknown")).slice(0,8); const devices=rank(logins7.map((l)=>l.device_family||"Unknown")).slice(0,8);
  const displayName=(user.user_metadata?.full_name as string|undefined)||user.email||"Owner";
  return <OwnerSectionShell active="analytics" title="Analytics" subtitle="Live product telemetry only. Empty panels mean no real events have been captured yet." displayName={displayName} approvalCount={approvalCount}>
    <section className="grid gap-3 sm:grid-cols-4"><Metric label="Users" value={users.length}/><Metric label="Activity Events (7d)" value={activity7.length}/><Metric label="Auth Events (7d)" value={logins7.length}/><Metric label="Onboarded" value={users.length?`${Math.round(users.filter((u:any)=>u.onboarding_completed).length/users.length*100)}%`:"0%"}/></section>
    <section className="mt-4 grid gap-4 xl:grid-cols-3">
      <OwnerPanel title="Top Screens (7d)"><Rank rows={paths}/></OwnerPanel>
      <OwnerPanel title="Sign-ins by Location (7d)"><Rank rows={locations}/></OwnerPanel>
      <OwnerPanel title="Device Mix (7d)"><Rank rows={devices}/></OwnerPanel>
    </section>
    <div className="mt-4"><OwnerPanel title="Telemetry Health" subtitle="This panel reflects the actual event tables."><div className="mt-3 grid gap-3 sm:grid-cols-2"><Status label="Activity collection" ok={activity.length>0} detail={activity.length>0?`Latest event ${relative(activity[0].occurred_at)}`:"No activity_events rows yet"}/><Status label="Authentication telemetry" ok={logins.length>0} detail={logins.length>0?`Latest event ${relative(logins[0].occurred_at)}`:"No login_events rows yet"}/></div>{activity.length===0&&logins.length===0?<EmptyState>Telemetry is currently empty. The AI Operations findings should remain open until real events are verified.</EmptyState>:null}</OwnerPanel></div>
  </OwnerSectionShell>;
}
function Metric({label,value}:{label:string;value:string|number}){return <div className="rounded-xl border border-[#1d315e] bg-[linear-gradient(145deg,#0d1831,#0b1221)] p-4"><div className="text-[9px] text-[#9aa6bc]">{label}</div><div className="mt-1 text-[27px] font-bold">{value}</div></div>}
function rank(values:string[]){const m=new Map<string,number>();values.forEach(v=>m.set(v,(m.get(v)||0)+1));return [...m.entries()].map(([label,count])=>({label,count})).sort((a,b)=>b.count-a.count)}
function Rank({rows}:{rows:{label:string;count:number}[]}){const max=Math.max(1,...rows.map(r=>r.count));return <div className="mt-3 space-y-2">{rows.length?rows.map((r)=><div key={r.label}><div className="flex justify-between gap-3 text-[9px]"><span className="truncate">{r.label}</span><span>{r.count}</span></div><div className="mt-1 h-1 rounded bg-[#202b40]"><div className="h-full rounded bg-[#7c4dff]" style={{width:`${Math.max(5,r.count/max*100)}%`}}/></div></div>):<EmptyState>No real data yet.</EmptyState>}</div>}
function Status({label,ok,detail}:{label:string;ok:boolean;detail:string}){return <div className={`rounded-lg border p-3 ${ok?"border-emerald-500/20 bg-emerald-500/[.035]":"border-amber-500/20 bg-amber-500/[.035]"}`}><div className={`text-[10px] font-semibold ${ok?"text-emerald-300":"text-amber-300"}`}>{ok?"●":"●"} {label}</div><div className="mt-1 text-[8px] text-[#8c98ad]">{detail}</div></div>}
function relative(v:string){const ms=Date.now()-new Date(v).getTime();if(ms<60e3)return "just now";if(ms<36e5)return `${Math.floor(ms/60e3)}m ago`;if(ms<864e5)return `${Math.floor(ms/36e5)}h ago`;return `${Math.floor(ms/864e5)}d ago`}
