import Link from "next/link";
import { NavIcon } from "@/components/layout/nav-icon";
import { isGoogleCalendarConfigured } from "@/lib/integrations/google-calendar";
import { isPlaidConfigured } from "@/lib/integrations/plaid";
import { createClient } from "@/lib/supabase/server";

type ConnectionStatus="connected"|"available"|"setup"|"native";

export default async function IntegrationsPage(){
  const supabase=await createClient();
  const {data:integrationRows}=await supabase.from("integrations").select("provider,status,connected_at,metadata");
  const connected=new Map((integrationRows??[]).map((row)=>[row.provider,row]));
  const google=connected.get("google_calendar");
  const plaid=connected.get("plaid");
  const items=[
    {name:"Google Calendar",icon:"calendar",status:google?.status==="connected"?"connected":isGoogleCalendarConfigured()?"available":"setup" as ConnectionStatus,desc:google?.status==="connected"?"Read-only calendar context is connected to Project You+.":"Connect your primary Google Calendar so Dashboard and Coach understand real commitments.",href:google?.status==="connected"?"/calendar":"/api/integrations/google-calendar/start",action:google?.status==="connected"?"View":"Connect"},
    {name:"Plaid",icon:"finance",status:plaid?.status==="connected"?"connected":isPlaidConfigured()?"available":"setup" as ConnectionStatus,desc:plaid?.status==="connected"?"Bank and investment data is connected through Plaid.":"Securely connect supported bank and investment accounts. Project You+ never receives your bank password.",href:"/money/connect",action:plaid?.status==="connected"?"Manage":"Connect"},
    {name:"Apple Calendar",icon:"calendar",status:"native" as ConnectionStatus,desc:"EventKit belongs in the native iPhone build. The data model is ready, but the web app will not fake this connection."},
    {name:"Apple Health",icon:"health",status:"native" as ConnectionStatus,desc:"HealthKit will connect workouts, sleep, movement, and other approved signals in the native iOS build."},
  ];
  return <main className="py-mobile-shell md:py-shell-narrow">
    <header className="mb-7"><h1 className="py-title">Connections</h1><p className="py-subtitle">Bring outside context into Project You+ only when the integration is real, permissioned, and useful.</p></header>
    <section className="py-glass-soft px-4">{items.map((item)=>{const content=<><span className="py-icon-tile"><NavIcon name={item.icon} className="h-[18px] w-[18px]"/></span><span className="min-w-0 flex-1"><span className="block text-[13.5px] font-semibold text-text-1">{item.name}</span><span className="mt-0.5 block text-[10.8px] leading-relaxed text-text-3">{item.desc}</span></span><span className="flex flex-col items-end gap-1.5"><StatusPill status={item.status}/>{item.href&&<span className="text-[10px] font-semibold text-accent-text">{item.action}</span>}</span></>;return item.href?<Link key={item.name} href={item.href} className="py-list-row py-pressable">{content}</Link>:<div key={item.name} className="py-list-row">{content}</div>})}</section>
    {(!isGoogleCalendarConfigured()||!isPlaidConfigured())&&<section className="py-glass-soft mt-4 p-4"><h2 className="m-0 text-[14px] font-semibold text-text-1">Developer setup remaining</h2><p className="m-0 mt-2 text-[11.5px] leading-relaxed text-text-3">The integration code is in place. Credentials still have to be added securely to the deployment before any connection labeled “Setup required” can start.</p></section>}
    <section className="mt-4 px-1"><p className="m-0 text-[10.5px] leading-relaxed text-text-3">Project You+ stores provider tokens server-side and keeps connection secrets out of the browser and normal user-accessible database policies.</p></section>
  </main>
}

function StatusPill({status}:{status:ConnectionStatus}){const styles=status==="connected"?"text-positive border-positive/20 bg-positive-soft":status==="available"?"text-accent-text border-accent/20 bg-accent-soft":"text-text-3 border-white/[.06] bg-white/[.025]";const label=status==="connected"?"Connected":status==="available"?"Ready":status==="setup"?"Setup required":"Native iOS";return <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[9px] font-semibold ${styles}`}>{label}</span>}
