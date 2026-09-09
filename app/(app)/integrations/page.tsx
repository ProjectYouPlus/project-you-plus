import Link from "next/link";
import { NavIcon } from "@/components/layout/nav-icon";
import { isGoogleCalendarConfigured } from "@/lib/integrations/google-calendar";
import { isPlaidConfigured } from "@/lib/integrations/plaid";
import { isOpenAIConfigured } from "@/lib/ai/openai";
import { createClient } from "@/lib/supabase/server";

type ConnectionStatus="connected"|"available"|"setup"|"native";

export default async function IntegrationsPage(){
  const supabase=await createClient();
  const{data:integrationRows}=await supabase.from("integrations").select("provider,status,connected_at,metadata");
  const connected=new Map((integrationRows??[]).map((row)=>[row.provider,row]));
  const google=connected.get("google_calendar"),plaid=connected.get("plaid");
  const secureStoreReady=Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const googleReady=isGoogleCalendarConfigured()&&secureStoreReady;
  const plaidReady=isPlaidConfigured()&&secureStoreReady;
  const openAIReady=isOpenAIConfigured();
  const items=[
    {name:"OpenAI Intelligence",icon:"coach",status:(openAIReady?"connected":"setup") as ConnectionStatus,desc:openAIReady?"Coach, Nutrition AI, workout planning, daily planning, and reviews can use cloud intelligence.":"Add the OpenAI API key to replace local fallback intelligence with the primary cloud AI layer.",action:openAIReady?"Ready":"Setup"},
    {name:"Google Calendar",icon:"calendar",status:(google?.status==="connected"?"connected":googleReady?"available":"setup") as ConnectionStatus,desc:google?.status==="connected"?"Read-only schedule context is feeding Dashboard and Coach.":"Connect your primary calendar so Project You+ can see meetings, appointments, and open time.",href:google?.status==="connected"?"/calendar":"/api/integrations/google-calendar/start",action:google?.status==="connected"?"View":"Connect"},
    {name:"Plaid",icon:"finance",status:(plaid?.status==="connected"?"connected":plaidReady?"available":"setup") as ConnectionStatus,desc:plaid?.status==="connected"?"Accounts, transactions, and supported investment holdings can sync through Plaid.":"Connect supported bank and investment accounts without giving Project You+ your bank password.",href:"/money/connect",action:plaid?.status==="connected"?"Manage":"Connect"},
    {name:"Apple Calendar",icon:"calendar",status:"native" as ConnectionStatus,desc:"Prepared for EventKit in the native iPhone app. We will use the same Project You+ calendar model rather than fake Apple access on the web."},
    {name:"Apple Health",icon:"health",status:"native" as ConnectionStatus,desc:"Prepared for HealthKit in the native iOS build for permissioned workout, sleep, movement, and health signals."},
  ];
  const readyCount=items.filter((item)=>item.status==="connected").length;
  return <main className="py-mobile-shell md:py-shell-narrow">
    <header className="mb-7"><div className="text-[11px] text-text-3">Connected Life</div><h1 className="py-title mt-1">Connections</h1><p className="py-subtitle">Every real connection gives the same Project You+ intelligence more context. Nothing is labeled connected unless it actually is.</p></header>
    <section className="py-trajectory-card p-5"><div className="flex items-end justify-between gap-4"><div><div className="text-[37px] font-bold tracking-[-.055em] text-white">{readyCount}<span className="text-[16px] font-medium text-white/35"> / {items.length}</span></div><div className="mt-1 text-[12px] font-medium text-white">intelligence sources active</div></div><div className="max-w-[190px] text-right text-[10.5px] leading-relaxed text-white/48">Start with OpenAI + Google Calendar. Add Plaid only after the financial flow is tested in Sandbox.</div></div></section>
    <section className="py-glass-soft mt-4 px-4">{items.map((item)=>{const content=<><span className="py-icon-tile"><NavIcon name={item.icon} className="h-[18px] w-[18px]"/></span><span className="min-w-0 flex-1"><span className="block text-[13.5px] font-semibold text-text-1">{item.name}</span><span className="mt-0.5 block text-[10.8px] leading-relaxed text-text-3">{item.desc}</span></span><span className="flex flex-col items-end gap-1.5"><StatusPill status={item.status}/>{item.href&&<span className="text-[10px] font-semibold text-accent-text">{item.action}</span>}</span></>;return item.href?<Link key={item.name} href={item.href} className="py-list-row py-pressable">{content}</Link>:<div key={item.name} className="py-list-row">{content}</div>})}</section>
    {(!openAIReady||!googleReady||!plaidReady)&&<section className="py-glass-soft mt-4 p-4"><h2 className="m-0 text-[14px] font-semibold text-text-1">Developer setup remaining</h2><p className="m-0 mt-2 text-[11.5px] leading-relaxed text-text-3">The application code is ready for the services above. Anything marked Setup still needs its secret credentials added to Vercel. Provider keys stay server-side and never belong in GitHub or NEXT_PUBLIC variables.</p></section>}
    <p className="m-0 mt-4 px-1 text-[10px] leading-relaxed text-text-3">Apple Calendar and Apple Health become real when Project You+ moves into the native iPhone phase, where EventKit and HealthKit can request Apple permissions directly.</p>
  </main>
}
function StatusPill({status}:{status:ConnectionStatus}){const styles=status==="connected"?"text-positive border-positive/20 bg-positive-soft":status==="available"?"text-accent-text border-accent/20 bg-accent-soft":"text-text-3 border-white/[.06] bg-white/[.025]";const label=status==="connected"?"Connected":status==="available"?"Ready":status==="setup"?"Setup required":"Native iOS";return <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[9px] font-semibold ${styles}`}>{label}</span>}
