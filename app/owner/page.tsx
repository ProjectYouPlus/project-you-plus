import Link from "next/link";
import { requireAdmin } from "@/lib/owner/access";
import { updateModuleControl } from "@/lib/actions/owner";
import { getOwnerApprovalCount } from "@/lib/owner/approval-count";

export const dynamic = "force-dynamic";
const DAY = 86_400_000;

type User = { user_id:string; email:string|null; full_name:string|null; created_at:string; last_sign_in_at:string|null; onboarding_completed:boolean };
type Meta = { user_id:string; last_seen_at:string|null; last_path:string|null };
type Login = { id:string; user_id:string; occurred_at:string; city:string|null; region:string|null; country:string|null; device_family:string|null; browser:string|null; os:string|null };
type Module = { module_key:string; label:string; enabled:boolean; rollout_percent:number; locked:boolean };

export default async function OwnerPage(){
  const { supabase, user } = await requireAdmin();
  const now = Date.now();

  const [usersRes,metaRes,loginsRes,modulesRes,totalSigninsRes,approvalCount] = await Promise.all([
    supabase.from("user_directory").select("user_id,email,full_name,created_at,last_sign_in_at,onboarding_completed").order("created_at",{ascending:false}),
    supabase.from("user_admin_metadata").select("user_id,last_seen_at,last_path"),
    supabase.from("login_events").select("id,user_id,occurred_at,city,region,country,device_family,browser,os").order("occurred_at",{ascending:false}).limit(2000),
    supabase.from("app_modules").select("module_key,label,enabled,rollout_percent,locked").order("label"),
    supabase.from("login_events").select("id",{count:"exact",head:true}),
    getOwnerApprovalCount(supabase),
  ]);

  const users=(usersRes.data??[]) as User[];
  const metadata=(metaRes.data??[]) as Meta[];
  const logins=(loginsRes.data??[]) as Login[];
  const modules=(modulesRes.data??[]) as Module[];
  const metaByUser=new Map(metadata.map(m=>[m.user_id,m]));
  const latestLogin=new Map<string,Login>();
  for(const l of logins) if(!latestLogin.has(l.user_id)) latestLogin.set(l.user_id,l);

  const total=users.length;
  const active7=users.filter(u=>recent(metaByUser.get(u.user_id)?.last_seen_at,now-7*DAY)).length;
  const new30=users.filter(u=>new Date(u.created_at).getTime()>=now-30*DAY).length;
  const countries=unique(logins.map(l=>l.country).filter(Boolean) as string[]).length;
  const totalSignins=totalSigninsRes.count??logins.length;
  const growth=buildGrowth(users,now);
  const locations=rank(logins.map(locationLabel).filter(v=>v!=="Unknown")).slice(0,6);
  const devices=rank(logins.map(l=>l.device_family).filter(Boolean) as string[]).slice(0,5);
  const systemHealthy=!usersRes.error&&!metaRes.error&&!loginsRes.error&&!modulesRes.error;
  const displayName=(user.user_metadata?.full_name as string|undefined) || user.email || "Owner";

  return <main className="min-h-screen bg-[#050914] text-[#f5f7ff]">
    <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(circle_at_62%_-12%,rgba(82,79,255,.12),transparent_38%)]"/>
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[205px] border-r border-[#172033] bg-[#070b15]/95 lg:flex lg:flex-col">
      <div className="px-7 pt-5"><div className="text-[12px] tracking-[.45em] text-[#c6cbed]">PROJECT</div><div className="-mt-1 text-[39px] font-black leading-none tracking-[-.06em]">YOU<span className="text-[#8b5cf6]">+</span></div><div className="mt-3 text-[7px] font-semibold uppercase tracking-[.35em] leading-[1.8] text-[#a98dff]">Discipline today.<br/>A better tomorrow.</div></div>
      <nav className="mt-7 space-y-1 px-2 text-[13px] text-[#c4cbe0]"><Nav href="/dashboard" icon="◷" label="Today"/><Nav href="/plan" icon="□" label="Plan"/><Nav href="/coach" icon="◇" label="Coach"/><Nav href="/you" icon="♙" label="You"/></nav>
      <div className="mt-5 border-t border-[#172033] px-2 pt-4"><div className="rounded-xl border border-[#7248ff] bg-[linear-gradient(90deg,rgba(100,60,255,.32),rgba(121,75,255,.17))] px-3 py-2.5 text-[13px] font-semibold">♣ <span className="ml-2">Owner</span></div></div>
      <nav className="mt-2 space-y-1 px-2 text-[12px] text-[#b7bfd3]"><Nav href="/owner" icon="◈" label="Overview" active/><Nav href="/owner/users" icon="♙" label="Users"/><Nav href="/owner/analytics" icon="▥" label="Analytics"/><Nav href="/owner/agents" icon="✣" label="AI Operations"/><Nav href="/owner/controls" icon="⚙" label="Feature Controls"/><Nav href="/owner/content" icon="□" label="Content & Messaging"/><Nav href="/owner/integrations" icon="⌘" label="Integrations"/><Nav href="/owner/audit" icon="▤" label="Audit Log"/><Nav href="/owner/settings" icon="⚙" label="Settings"/></nav>
      <div className="mt-auto p-3"><div className="rounded-xl border border-[#24304a] bg-[#0b1220] p-3 text-[10px] text-[#cbd2e3]"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#2a214e] text-xl">★</div><div>Build Better Humans<br/>A Stronger Future.</div></div></div><div className="mt-4 px-3 text-[10px] text-[#7f899f]">Project You+<br/>v1.0.0</div></div>
    </aside>

    <div className="relative lg:pl-[205px]">
      <header className="flex h-[65px] items-center gap-4 border-b border-[#172033] px-4 sm:px-5">
        <div className="flex h-9 max-w-[860px] flex-1 items-center rounded-lg border border-[#31405a] bg-[#0c1321] px-3 text-[12px] text-[#7f8aa3]">⌕&nbsp;&nbsp;Search users, email, location, device...</div>
        <div className="ml-auto flex items-center gap-3"><Link href="/owner/approvals" className="relative rounded-lg border border-[#6942d8] bg-[#160f2d] px-3 py-2 text-[10px] font-semibold text-[#d2c4ff]">✓ Approvals{approvalCount>0?<span className="ml-2 rounded-full bg-[#7c4dff] px-1.5 py-0.5 text-[8px] text-white">{approvalCount}</span>:null}</Link><span className="hidden rounded-lg border border-[#263249] bg-[#0b111c] px-3 py-2 text-[11px] sm:inline"><span className="mr-2 text-emerald-400">●</span>Live</span><div className="hidden h-9 w-9 items-center justify-center rounded-full bg-[#4b2c9a] text-[11px] font-bold sm:flex">{initials(displayName)}</div><div className="hidden text-[11px] sm:block"><div className="font-semibold">{displayName}</div><div className="text-[#8c96ab]">Owner</div></div></div>
      </header>

      <div className="px-4 py-5 sm:px-5">
        <div className="mb-4 flex items-start justify-between gap-4"><div><h1 className="text-[27px] font-bold tracking-[-.035em]">Owner Command Center</h1><p className="text-[13px] text-[#8995ae]">Real users. Real data. A better tomorrow.</p></div><div className="hidden gap-3 md:flex"><button className="rounded-lg border border-[#35415a] bg-[#0d1422] px-4 py-2 text-[11px]">Last 30 days⌄</button><Link href="/owner/analytics" className="rounded-lg border border-[#6942d8] bg-[#160f2d] px-4 py-2 text-[11px] text-[#c8b6ff]">View Analytics</Link></div></div>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6"><Metric icon="♙" label="Total Users" value={total} detail={`${new30} new this month`}/><Metric icon="ϟ" label="Active Users (7d)" value={active7} detail={`${pct(active7,total)}% activation rate`}/><Metric icon="♙" label="New Sign Ups (30d)" value={new30} detail={new30?`Avg. ${(new30/30).toFixed(1)}/day`:"No signups yet"}/><Metric icon="↪" label="Total Sign-ins" value={totalSignins} detail="Tracked authentication events"/><Metric icon="◎" label="Countries" value={countries} detail={locations[0]?.label?`Top: ${locations[0].label}`:"No location data yet"}/><Metric icon="▥" label="Avg. Daily Usage" value="—" detail="Session duration not tracked yet"/></section>

        <section className="mt-3 grid gap-3 xl:grid-cols-[1.45fr_1.4fr_.95fr]">
          <Panel title="User Growth"><div className="mt-4 flex h-[160px] items-end gap-1.5 border-b border-[#28344b] pb-1">{growth.map(g=><div key={g.key} className="flex flex-1 items-end gap-[2px]" title={`${g.label}: ${g.count}`}><div className="w-1/2 rounded-t bg-[#8b5cf6]" style={{height:`${Math.max(g.height,3)}%`}}/><div className="w-1/2 rounded-t bg-[#4f6df5]/75" style={{height:`${Math.max(g.height*.72,2)}%`}}/></div>)}</div><div className="mt-3 flex justify-between text-[9px] text-[#8d97aa]"><span>30 days ago</span><span>15 days ago</span><span>Today</span></div><div className="mt-3 flex justify-center gap-4 text-[9px] text-[#b8c0d2]"><span><b className="text-[#8b5cf6]">●</b> New Users</span><span><b className="text-[#4f6df5]">●</b> Active Users</span></div></Panel>
          <Panel title="Sign-ins by Location"><div className="mt-2 grid gap-4 md:grid-cols-[1fr_180px]"><div className="relative min-h-[190px] overflow-hidden rounded-xl bg-[radial-gradient(circle_at_18%_55%,rgba(125,79,255,.55)_0_3%,transparent_4%),radial-gradient(circle_at_53%_53%,rgba(108,74,255,.5)_0_2%,transparent_3%),radial-gradient(circle_at_78%_66%,rgba(113,74,255,.45)_0_2%,transparent_3%),linear-gradient(145deg,#1a2232,#0a101b)]"><div className="absolute inset-0 opacity-25 [background-image:radial-gradient(circle,#77829b_1px,transparent_1px)] [background-size:11px_11px]"/></div><Rank rows={locations}/></div></Panel>
          <Panel title="Device & Browser"><div className="mt-5 flex items-center gap-5"><div className="relative flex h-32 w-32 shrink-0 items-center justify-center rounded-full bg-[conic-gradient(#8b5cf6_0_52%,#22a8f2_52%_76%,#64748b_76%_100%)]"><div className="flex h-20 w-20 flex-col items-center justify-center rounded-full bg-[#0a101b]"><div className="text-xl font-bold">{total}</div><div className="text-[9px] text-[#a9b2c6]">Users</div></div></div><Rank rows={devices}/></div></Panel>
        </section>

        <section className="mt-3 grid gap-3 xl:grid-cols-[1fr_308px]">
          <Panel title="Recent Users"><div className="mt-3 overflow-x-auto"><table className="w-full min-w-[820px] text-left text-[10px]"><thead className="border-y border-[#243149] bg-[#131b29] text-[#a5aec0]"><tr><th className="px-3 py-2">User</th><th>Email</th><th>Location</th><th>Device</th><th>Last Sign In</th><th>Status</th><th>Onboarding</th></tr></thead><tbody className="divide-y divide-[#1e2a3f]">{users.slice(0,5).map(u=>{const l=latestLogin.get(u.user_id);const m=metaByUser.get(u.user_id);return <tr key={u.user_id}><td className="px-3 py-3 font-semibold"><span className="mr-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#5036b0] text-[9px]">{initials(u.full_name||u.email||"U")}</span>{u.full_name||"Unnamed"}</td><td className="text-[#aab4c8]">{u.email||"—"}</td><td>{l?locationLabel(l):"—"}</td><td>{[l?.device_family,l?.browser].filter(Boolean).join(" · ")||"—"}<div className="text-[8px] text-[#77829a]">{l?.os||""}</div></td><td>{relative(u.last_sign_in_at,now)}</td><td><span className={`rounded-full px-2 py-1 ${recent(m?.last_seen_at,now-DAY)?"bg-emerald-500/10 text-emerald-300":"bg-white/5 text-[#8d97aa]"}`}>{recent(m?.last_seen_at,now-DAY)?"● Active":"Inactive"}</span></td><td><span className={`rounded-full px-2 py-1 ${u.onboarding_completed?"bg-[#3c246a] text-[#d7c6ff]":"bg-blue-500/15 text-blue-300"}`}>{u.onboarding_completed?"Completed":"In Progress"}</span></td></tr>})}{users.length===0?<tr><td colSpan={7} className="px-3 py-8 text-center text-[#738098]">No real users yet.</td></tr>:null}</tbody></table><div className="mt-3 text-right"><Link href="/owner/users" className="text-[9px] text-[#bba7ff]">View all users →</Link></div></div></Panel>
          <Panel title="Feature Controls"><div className="mt-3 space-y-2">{modules.slice(0,8).map(m=><form key={m.module_key} action={updateModuleControl} className="flex items-center gap-3 rounded-lg px-1 py-1.5"><input type="hidden" name="moduleKey" value={m.module_key}/><input type="hidden" name="intent" value="toggle"/><div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#1e2048] text-[#9b77ff]">◇</div><div className="min-w-0 flex-1"><div className="truncate text-[10px] font-medium">{m.label}</div><div className={`text-[8px] ${m.enabled?"text-emerald-300":"text-[#7f899e]"}`}>{m.enabled?(m.rollout_percent<100?`Beta (${m.rollout_percent}%)`:"Enabled"):"Disabled"}</div></div><button disabled={m.locked} className={`relative h-5 w-9 rounded-full ${m.enabled?"bg-[#7b4cf6]":"bg-[#4a5568]"} disabled:opacity-35`}><span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition ${m.enabled?"right-0.5":"left-0.5"}`}/></button></form>)}</div><div className="mt-3 text-right"><Link href="/owner/controls" className="text-[9px] text-[#bba7ff]">Manage controls →</Link></div></Panel>
        </section>

        <section className="mt-3 grid gap-3 xl:grid-cols-[.9fr_1.45fr_.75fr]"><Panel title="System Status"><div className="mt-4 flex items-center gap-3"><div className={`h-9 w-9 rounded-full border p-2 ${systemHealthy?"border-emerald-500/30 bg-emerald-500/10":"border-red-500/30 bg-red-500/10"}`}><div className={`h-full w-full rounded-full ${systemHealthy?"bg-emerald-400":"bg-red-400"}`}/></div><div><div className={`text-[11px] font-semibold ${systemHealthy?"text-emerald-300":"text-red-300"}`}>{systemHealthy?"All Systems Operational":"Data source issue detected"}</div><div className="text-[9px] text-[#7f8aa0]">Checked on this page load</div></div></div></Panel><Panel title="Quick Actions"><div className="mt-4 grid gap-2 sm:grid-cols-4"><Action href="/owner/agents" label="AI Operations"/><Action href="/owner/approvals" label={`Approvals${approvalCount?` (${approvalCount})`:""}`}/><Action href="/owner/controls" label="Feature Controls"/><Action href="/dashboard" label="Open App"/></div></Panel><div className="flex min-h-[110px] items-center justify-center rounded-xl border border-[#251f4f] bg-[linear-gradient(135deg,#171033,#0c1220)] p-5 text-center"><div><div className="text-[18px] font-semibold italic text-[#9b5dff]">“You vs 24.<br/>Win Every Day.”</div><div className="mt-4 text-[8px] tracking-[.28em] text-[#c9d0e0]">PROJECT YOU+</div></div></div></section>
      </div>
    </div>
  </main>
}

function Nav({href,icon,label,active=false}:{href:string;icon:string;label:string;active?:boolean}){return <Link href={href} className={`flex items-center gap-3 rounded-lg px-3 py-2 ${active?"bg-[#1c153b] text-[#cebfff]":"hover:bg-white/[.03]"}`}><span className="w-4 text-center text-[14px]">{icon}</span>{label}</Link>}
function Metric({icon,label,value,detail}:{icon:string;label:string;value:string|number;detail:string}){return <div className="rounded-xl border border-[#1d315e] bg-[linear-gradient(145deg,#0d1831,#0b1221)] p-4"><div className="flex items-center gap-2 text-[10px]"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#282268] text-[#9e84ff]">{icon}</span>{label}</div><div className="mt-2 text-[27px] font-bold tracking-[-.04em]">{value}</div><div className="mt-1 text-[10px] text-[#9aa6bc]">{detail}</div></div>}
function Panel({title,children}:{title:string;children:React.ReactNode}){return <div className="rounded-xl border border-[#1b293f] bg-[linear-gradient(180deg,#0b121f,#09101a)] p-3.5"><div className="text-[12px] font-semibold">{title}</div>{children}</div>}
function Rank({rows}:{rows:{label:string;count:number}[]}){const max=Math.max(1,...rows.map(r=>r.count));return <div className="space-y-2 text-[9px]">{rows.length?rows.map(r=><div key={r.label}><div className="flex justify-between"><span className="truncate pr-2">{r.label}</span><span>{r.count}</span></div><div className="mt-1 h-1 rounded bg-[#202b40]"><div className="h-full rounded bg-[#7c4dff]" style={{width:`${Math.max(6,r.count/max*100)}%`}}/></div></div>):<div className="pt-8 text-center text-[#718098]">No real data yet</div>}</div>}
function Action({href,label}:{href:string;label:string}){return <Link href={href} className="rounded-lg border border-[#354560] bg-[#111a29] px-3 py-3 text-center text-[9px] font-medium hover:border-[#664bd2]">{label}</Link>}
function locationLabel(l:Pick<Login,"city"|"region"|"country">){return [l.city,l.region].filter(Boolean).join(", ")||l.country||"Unknown"}
function recent(value:string|null|undefined,cutoff:number){return !!value&&new Date(value).getTime()>=cutoff}
function unique<T>(a:T[]){return [...new Set(a)]}
function pct(a:number,b:number){return b?Math.round(a/b*100):0}
function rank(values:string[]){const m=new Map<string,number>();values.forEach(v=>m.set(v,(m.get(v)||0)+1));return [...m.entries()].map(([label,count])=>({label,count})).sort((a,b)=>b.count-a.count)}
function initials(v:string){return v.split(/[\s@._-]+/).filter(Boolean).slice(0,2).map(x=>x[0]?.toUpperCase()).join("")||"OU"}
function relative(v:string|null,now:number){if(!v)return "Never";const ms=now-new Date(v).getTime();if(ms<60e3)return "Just now";if(ms<36e5)return `${Math.floor(ms/60e3)} min ago`;if(ms<DAY)return `${Math.floor(ms/36e5)}h ago`;return `${Math.floor(ms/DAY)}d ago`}
function buildGrowth(users:User[],now:number){const days=30;const counts=Array.from({length:days},()=>0);for(const u of users){const age=Math.floor((now-new Date(u.created_at).getTime())/DAY);if(age>=0&&age<days)counts[days-1-age]++}const max=Math.max(1,...counts);return counts.map((count,i)=>({key:i,label:new Date(now-(days-1-i)*DAY).toLocaleDateString("en-US",{month:"short",day:"numeric"}),count,height:count/max*100}))}
