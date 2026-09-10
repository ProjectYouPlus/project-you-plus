import { requireAdmin } from "@/lib/owner/access";
import { getOwnerApprovalCount } from "@/lib/owner/approval-count";
import { OwnerPanel, OwnerSectionShell, EmptyState } from "@/components/owner/owner-section-shell";
import { updateBooleanSetting } from "@/lib/actions/owner";

export const dynamic = "force-dynamic";

type Setting={setting_key:string;label:string;description:string|null;category:string|null;value:unknown;public_readable:boolean;updated_at:string};
const TOGGLE_KEYS=new Set(["signup_enabled","maintenance_mode","onboarding_required","analytics_enabled","location_analytics_enabled"]);

export default async function OwnerSettingsPage(){
  const {supabase,user}=await requireAdmin();
  const [settingsRes,approvalCount]=await Promise.all([
    supabase.from("app_settings").select("setting_key,label,description,category,value,public_readable,updated_at").order("category").order("label"),
    getOwnerApprovalCount(supabase),
  ]);
  const settings=(settingsRes.data??[]) as Setting[];
  const displayName=(user.user_metadata?.full_name as string|undefined)||user.email||"Owner";
  return <OwnerSectionShell active="settings" title="Settings" subtitle="Operational Project You+ settings backed by the live app_settings table." displayName={displayName} approvalCount={approvalCount}>
    <OwnerPanel title="Application Settings" subtitle="Only supported boolean settings can be changed here; all other values are shown read-only.">
      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{settings.map((s)=>{const isToggle=TOGGLE_KEYS.has(s.setting_key)&&typeof s.value==="boolean";return <article key={s.setting_key} className="rounded-xl border border-[#26344b] bg-[#0a1320] p-4"><div className="flex items-start justify-between gap-3"><div><div className="text-[11px] font-semibold">{s.label}</div><div className="mt-1 text-[8px] uppercase tracking-[.12em] text-[#71809a]">{s.setting_key}</div></div><span className="rounded bg-white/5 px-2 py-1 text-[8px] text-[#8f9bb0]">{s.category||"general"}</span></div><p className="mt-3 min-h-[35px] text-[9px] leading-relaxed text-[#9da8bc]">{s.description||"No description configured."}</p>{isToggle?<form action={updateBooleanSetting} className="mt-3"><input type="hidden" name="settingKey" value={s.setting_key}/><input type="hidden" name="value" value={String(!s.value)}/><button className={`w-full rounded-lg border px-3 py-2 text-[9px] ${s.value?"border-emerald-500/25 bg-emerald-500/10 text-emerald-300":"border-[#43536f] bg-[#101a29] text-[#aeb7ca]"}`}>{s.value?"Enabled — click to disable":"Disabled — click to enable"}</button></form>:<div className="mt-3 rounded-lg border border-[#2a3851] bg-[#09111d] px-3 py-2 text-[9px] text-[#b8c1d2]">{formatValue(s.value)}</div>}<div className="mt-2 text-[8px] text-[#617087]">{s.public_readable?"Public-readable setting":"Admin-only setting"} · Updated {new Date(s.updated_at).toLocaleString()}</div></article>})}{settings.length===0?<EmptyState>No app settings are configured.</EmptyState>:null}</div>
    </OwnerPanel>
  </OwnerSectionShell>;
}
function formatValue(v:unknown){if(v===null||v===undefined)return "—";if(typeof v==="string"||typeof v==="number")return String(v);return JSON.stringify(v)}
